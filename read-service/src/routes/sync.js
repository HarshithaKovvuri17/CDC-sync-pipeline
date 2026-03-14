import express from "express";
import { getConsumerStats, resetOffsets } from "../consumer.js";

const router = express.Router();

/*
  SYNC STATUS
  GET /api/sync/status
*/
router.get("/status", (req, res) => {
  res.json(getConsumerStats());
});

/*
  RESET OFFSET — triggers full re-sync
  POST /api/sync/reset
*/
router.post("/reset", async (req, res) => {
  try {
    await resetOffsets();
    res.status(202).send();
  } catch (err) {
    console.error("Reset offset error:", err.message);
    res.status(500).json({ error: "Failed to reset offsets" });
  }
});

export default router;