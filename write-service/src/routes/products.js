import express from "express";
import pool from "../db.js";

const router = express.Router();

/*
  Helper: format a product row to camelCase per API contract
*/
function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: parseFloat(row.price),
    category: row.category,
    stock: row.stock,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
  };
}

/*
  CREATE PRODUCT
  POST /api/products
*/
router.post("/", async (req, res) => {
  try {
    const { name, price, category, stock } = req.body;

    if (!name || price === undefined || !category || stock === undefined) {
      return res.status(400).json({ error: "Missing required fields: name, price, category, stock" });
    }

    const result = await pool.query(
      `INSERT INTO products (name, price, category, stock)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, price, category, stock]
    );

    res.status(201).json(formatProduct(result.rows[0]));
  } catch (err) {
    console.error("Create product error:", err.message);
    res.status(500).json({ error: "Failed to create product" });
  }
});

/*
  UPDATE PRODUCT
  PUT /api/products/:id
*/
router.put("/:id", async (req, res) => {
  try {
    const { name, price, category, stock } = req.body;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE products
       SET name = $1, price = $2, category = $3, stock = $4
       WHERE id = $5
       RETURNING *`,
      [name, price, category, stock, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(formatProduct(result.rows[0]));
  } catch (err) {
    console.error("Update product error:", err.message);
    res.status(500).json({ error: "Update failed" });
  }
});

/*
  SOFT DELETE PRODUCT
  DELETE /api/products/:id
*/
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE products
       SET deleted_at = NOW()
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(204).send();
  } catch (err) {
    console.error("Delete product error:", err.message);
    res.status(500).json({ error: "Delete failed" });
  }
});

export default router;