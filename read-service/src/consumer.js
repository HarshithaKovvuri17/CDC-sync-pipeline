import { Kafka } from "kafkajs";
import { getDB } from "./mongo.js";
import dotenv from "dotenv";

dotenv.config();

/*
  Kafka configuration
*/
const kafka = new Kafka({
  clientId: "read-service",
  brokers: [process.env.KAFKA_BROKERS || "kafka:29092"],
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

const admin = kafka.admin();

/*
  Kafka consumer - single instance shared across the module
*/
const consumer = kafka.consumer({
  groupId: process.env.CONSUMER_GROUP || "products-sync-group",
  // At-least-once delivery: disable auto-commit and commit after processing
  autoCommit: false,
});

/*
  Metrics for monitoring
*/
let totalEventsProcessed = 0;
let lastProcessedOffset = -1;
let consumerLag = 0;

/*
  Idempotency tracking:
  We store the last-processed LSN per product ID in MongoDB to handle
  duplicate messages without causing data inconsistencies.
  LSN is extracted from the Debezium source.lsn field.
  We use an in-memory Set as a fast first-pass filter; MongoDB upsert
  with { id: product.id } ensures idempotency even after restarts.
*/
const processedLSNs = new Set();
const MAX_LSN_CACHE = 10_000;

/*
  Convert Debezium microsecond timestamps to ISO strings
  Debezium emits TIMESTAMP columns as microseconds-since-epoch
*/
function microToISO(micro) {
  if (micro === null || micro === undefined) return null;
  return new Date(Math.floor(micro / 1000)).toISOString();
}

/*
  Update consumer lag from Kafka admin
*/
async function updateConsumerLag() {
  try {
    await admin.connect();
    const topic = process.env.KAFKA_TOPIC || "pg-server.public.products";
    const group = process.env.CONSUMER_GROUP || "products-sync-group";

    const [groupOffsets, topicOffsets] = await Promise.all([
      admin.fetchOffsets({ groupId: group, topics: [topic] }),
      admin.fetchTopicOffsets(topic),
    ]);

    let lag = 0;
    for (const partition of topicOffsets) {
      const groupPartition = groupOffsets
        .find((t) => t.topic === topic)
        ?.partitions?.find((p) => p.partition === partition.partition);

      const groupOffset = groupPartition ? Number(groupPartition.offset) : 0;
      const highWatermark = Number(partition.high);
      lag += Math.max(0, highWatermark - groupOffset);
    }
    consumerLag = lag;
    await admin.disconnect();
  } catch {
    // Non-fatal: admin connection may not be available immediately
  }
}

/*
  Process a single Debezium change event
*/
async function processEvent(message, collection) {
  // Tombstone records have null value - handle graceful deletion if needed
  if (!message.value) {
    // Tombstone: key still has the product id in Debezium default format
    try {
      const keyRaw = message.key?.toString();
      if (keyRaw) {
        const key = JSON.parse(keyRaw);
        const productId = key?.id ?? key?.payload?.id;
        if (productId !== undefined) {
          await collection.deleteOne({ id: productId });
          console.log(`[TOMBSTONE] Removed product id=${productId} from MongoDB`);
        }
      }
    } catch {
      // Key may not be parseable; ignore tombstone
    }
    return;
  }

  const raw = message.value.toString();
  let event;
  try {
    event = JSON.parse(raw);
  } catch (parseErr) {
    console.error("Failed to parse Kafka message as JSON:", parseErr.message);
    return;
  }

  const payload = event.payload ?? event;
  if (!payload) return;

  const op = payload.op;
  const after = payload.after;
  const before = payload.before;
  const source = payload.source;

  /*
    Idempotency: use lsn + op + record id as a unique dedup key.
    The upsert below is idempotent automatically, but LSN tracking
    prevents wasted work and guarantees correct handling.
  */
  const lsn = source?.lsn;
  const recordId = after?.id ?? before?.id;
  const dedupKey = lsn != null ? `${lsn}-${op}-${recordId}` : null;

  if (dedupKey && processedLSNs.has(dedupKey)) {
    console.log(`[DEDUP] Skipping already-processed event: ${dedupKey}`);
    return;
  }

  /*
    CREATE / UPDATE / SNAPSHOT (read)
  */
  if (op === "c" || op === "u" || op === "r") {
    if (!after) return;

    const product = {
      id: after.id,
      name: after.name,
      price: typeof after.price === "number" ? after.price : parseFloat(after.price),
      category: after.category,
      stock: after.stock,
      created_at: microToISO(after.created_at),
      updated_at: microToISO(after.updated_at),
      deleted_at: microToISO(after.deleted_at),
    };

    // Upsert by id - idempotent by nature
    await collection.updateOne(
      { id: product.id },
      { $set: product },
      { upsert: true }
    );

    console.log(`[${op.toUpperCase()}] Synced product id=${product.id}`);
  }

  /*
    DELETE EVENT (soft delete captured as 'd' op if hard deleted in PG)
  */
  if (op === "d") {
    if (!before) return;
    await collection.deleteOne({ id: before.id });
    console.log(`[DELETE] Removed product id=${before.id}`);
  }

  // Track dedup key
  if (dedupKey) {
    processedLSNs.add(dedupKey);
    // Evict oldest entries to cap memory usage
    if (processedLSNs.size > MAX_LSN_CACHE) {
      const oldest = processedLSNs.values().next().value;
      processedLSNs.delete(oldest);
    }
  }

  totalEventsProcessed++;
  lastProcessedOffset = Number(message.offset);
}

/*
  Start Kafka consumer
*/
export async function startConsumer() {
  try {
    console.log("Connecting to Kafka...");
    await consumer.connect();

    const topic = process.env.KAFKA_TOPIC || "pg-server.public.products";
    console.log("Subscribing to topic:", topic);

    await consumer.subscribe({ topic, fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ message, heartbeat }) => {
        const db = getDB();
        const collection = db.collection("products");

        await processEvent(message, collection);
        await consumer.commitOffsets([
          {
            topic: process.env.KAFKA_TOPIC || "pg-server.public.products",
            partition: message.partition ?? 0,
            offset: (Number(message.offset) + 1).toString(),
          },
        ]);
        await heartbeat();
      },
    });

    // Update lag every 30 seconds
    setInterval(updateConsumerLag, 30_000);

    console.log("Kafka consumer started successfully");
  } catch (err) {
    console.error("Kafka consumer failed to start:", err.message);
    // Retry after delay
    setTimeout(startConsumer, 5000);
  }
}

/*
  Consumer monitoring stats
*/
export function getConsumerStats() {
  return {
    consumerLag,
    lastProcessedOffset,
    totalEventsProcessed,
  };
}

/*
  Reset offsets: stop the consumer, clear MongoDB, seek to beginning, restart.
  This triggers a full re-sync of the read model from scratch.
*/
export async function resetOffsets() {
  console.log("Resetting consumer offsets to beginning...");

  try {
    // Pause the consumer
    const topic = process.env.KAFKA_TOPIC || "pg-server.public.products";
    const assignments = consumer.assignment();

    consumer.pause(assignments.map((a) => ({ topic: a.topic, partitions: [a.partition] })));

    // Clear MongoDB collection
    const db = getDB();
    await db.collection("products").deleteMany({});
    console.log("Cleared MongoDB products collection");

    // Clear in-memory dedup cache
    processedLSNs.clear();
    totalEventsProcessed = 0;
    lastProcessedOffset = -1;

    // Seek each partition back to the beginning
    for (const assignment of assignments) {
      await consumer.seek({ topic: assignment.topic, partition: assignment.partition, offset: "0" });
    }

    // Resume consumption
    consumer.resume(assignments.map((a) => ({ topic: a.topic, partitions: [a.partition] })));

    console.log("Consumer offset reset complete — re-syncing from beginning");
  } catch (err) {
    console.error("Failed to reset offsets:", err.message);
    throw err;
  }
}