import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import productRoutes from "./routes/products.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "write-service" });
});

app.get("/", (req, res) => {
  res.json({ message: "Write Service is running 🚀" });
});

const PORT = process.env.WRITE_SERVICE_PORT || 8080;

app.listen(PORT, () => {
  console.log(`Write Service running on port ${PORT}`);
});