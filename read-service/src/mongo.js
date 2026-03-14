import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);

let db;

export async function connectMongo() {
  await client.connect();
  db = client.db(process.env.MONGO_DB);
  console.log("MongoDB connected");
}

export function getDB() {
  return db;
}