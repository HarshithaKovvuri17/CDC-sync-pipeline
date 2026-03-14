import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import { connectMongo } from "./mongo.js";
import { startConsumer } from "./consumer.js";
import productRoutes from "./routes/products.js";
import syncRoutes from "./routes/sync.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/sync", syncRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "read-service" });
});

app.get("/", (req, res) => {
  res.json({ message: "Read Service is running 🚀" });
});

const PORT = process.env.READ_SERVICE_PORT || 8081;

async function start() {
  await connectMongo();
  await startConsumer();

  app.listen(PORT, () => {
    console.log(`Read service running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start read service:", err);
  process.exit(1);
});