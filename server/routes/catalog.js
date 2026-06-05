/**
 * Public Catalog Route — NO auth required
 * GET /api/catalog   →  All active products grouped by category with GST-inclusive prices
 *
 * Used by the public price list page shared with prospects before any quote is created.
 * Manufacturing cost is NEVER exposed here.
 */
const express = require('express');
const pool    = require('../database/db');

const router = express.Router();

const parseJSON = (s, fallback = []) => {
  if (s == null) return fallback;
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return fallback; }
};

/* GET /api/catalog */
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id, p.name, p.description, p.base_price, p.unit,
        p.gst_percent, p.hsn_code, p.variants, p.pack_sizes,
        c.name        AS category_name,
        c.icon_emoji  AS category_icon,
        c.sort_order  AS category_sort
      FROM products p
      JOIN product_categories c ON c.id = p.category_id
      WHERE p.is_active = 1
      ORDER BY c.sort_order NULLS LAST, c.name, p.name
    `);

    // Group by category
    const map = new Map();
    for (const p of rows) {
      if (!map.has(p.category_name)) {
        map.set(p.category_name, { name: p.category_name, icon: p.category_icon, products: [] });
      }
      map.get(p.category_name).products.push({
        id:          p.id,
        name:        p.name,
        description: p.description || null,
        unit:        p.unit || 'Nos',
        base_price:  Number(p.base_price) || 0,
        gst_percent: Number(p.gst_percent) || 0,
        hsn_code:    p.hsn_code || null,
        variants:    parseJSON(p.variants,   []),
        pack_sizes:  parseJSON(p.pack_sizes, []),
      });
    }

    res.json({ catalog: [...map.values()] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
