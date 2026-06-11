/**
 * Catalog Routes
 *
 * Public:
 *   GET  /api/catalog              → full product catalog grouped by category
 *   GET  /api/catalog/share/:token → personalized catalog (client info + associate)
 *
 * Auth required:
 *   POST /api/catalog/share        → create a catalog share record, returns token
 *   GET  /api/catalog/shares       → list shares (admin: all, associate: own)
 */
const express = require('express');
const pool    = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const crypto  = require('crypto');

const router = express.Router();

const parseJSON = (s, fallback = []) => {
  if (s == null) return fallback;
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return fallback; }
};

/* ── Shared helper: build catalog array from DB rows ─────── */
async function buildCatalog() {
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
  return [...map.values()];
}

/* ── Ensure catalog_shares table exists ──────────────────── */
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalog_shares (
      id            SERIAL PRIMARY KEY,
      token         TEXT UNIQUE NOT NULL,
      associate_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      business_name TEXT,
      poc_name      TEXT,
      contact       TEXT,
      location      TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC ROUTES
═══════════════════════════════════════════════════════════ */

/* GET /api/catalog  — general public catalog */
router.get('/', async (req, res) => {
  try {
    const catalog = await buildCatalog();
    res.json({ catalog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/catalog/share/:token  — personalised catalog */
router.get('/share/:token', async (req, res) => {
  try {
    await ensureTable();
    const shareRes = await pool.query(`
      SELECT
        cs.id, cs.business_name, cs.poc_name, cs.contact, cs.location, cs.created_at,
        e.name  AS associate_name,
        e.phone AS associate_phone
      FROM catalog_shares cs
      LEFT JOIN employees e ON e.id = cs.associate_id
      WHERE cs.token = $1
    `, [req.params.token]);

    if (!shareRes.rows[0]) return res.status(404).json({ error: 'Invalid or expired catalog link' });

    const catalog = await buildCatalog();
    res.json({ share: shareRes.rows[0], catalog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   AUTH ROUTES
═══════════════════════════════════════════════════════════ */

/* POST /api/catalog/share  — create catalog share */
router.post('/share', requireAuth, async (req, res) => {
  try {
    await ensureTable();
    const { business_name, poc_name, contact, location } = req.body || {};
    if (!business_name && !poc_name) {
      return res.status(400).json({ error: 'Business name or POC name is required' });
    }
    const token = crypto.randomBytes(18).toString('hex');
    const { rows } = await pool.query(`
      INSERT INTO catalog_shares (token, associate_id, business_name, poc_name, contact, location)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, token, created_at
    `, [token, req.user.id, business_name || null, poc_name || null, contact || null, location || null]);

    res.status(201).json({ token: rows[0].token, share_id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/catalog/shares  — list shares (admin: all, associate: own) */
router.get('/shares', requireAuth, async (req, res) => {
  try {
    await ensureTable();
    const isAdmin = ['admin', 'central_office'].includes(req.user.role);
    const { rows } = await pool.query(`
      SELECT
        cs.id, cs.token, cs.business_name, cs.poc_name, cs.contact, cs.location, cs.created_at,
        e.name  AS associate_name,
        e.phone AS associate_phone
      FROM catalog_shares cs
      LEFT JOIN employees e ON e.id = cs.associate_id
      WHERE ${isAdmin ? '1=1' : 'cs.associate_id = $1'}
      ORDER BY cs.created_at DESC
    `, isAdmin ? [] : [req.user.id]);

    res.json({ shares: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
