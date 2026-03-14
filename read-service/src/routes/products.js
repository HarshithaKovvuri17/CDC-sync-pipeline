import express from "express";
import { getDB } from "../mongo.js";

const router = express.Router();

/*
  SEARCH PRODUCTS by name or category
  GET /api/products/search?query=...
*/
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: "query parameter is required" });
    }

    const db = getDB();
    const results = await db.collection("products").find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
      ],
      deleted_at: null,
    }).toArray();

    // Remove MongoDB _id from response
    res.json(results.map(({ _id, ...rest }) => rest));
  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

/*
  FILTER BY CATEGORY
  GET /api/products/category/:category
*/
router.get("/category/:category", async (req, res) => {
  try {
    const db = getDB();
    const results = await db.collection("products").find({
      category: req.params.category,
      deleted_at: null,
    }).toArray();

    res.json(results.map(({ _id, ...rest }) => rest));
  } catch (err) {
    console.error("Category filter error:", err.message);
    res.status(500).json({ error: "Category filter failed" });
  }
});

export default router;