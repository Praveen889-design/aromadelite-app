/**
 * Partners & Business Costs — admin only
 * /api/partners      → CRUD for partner profiles
 * /api/business-costs → CRUD for cost entries + summary
 */
const express = require('express');
const pool    = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
});

/* ── GET all partners ─────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM partners WHERE is_active = true ORDER BY id ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[partners GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── POST create partner ──────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const { name, share_percent, color, notes } = req.body;
    if (!name || !share_percent) return res.status(400).json({ error: 'name and share_percent required' });

    // Max 4 partners
    const { rows: existing } = await pool.query(`SELECT COUNT(*) FROM partners WHERE is_active = true`);
    if (parseInt(existing[0].count) >= 4) return res.status(400).json({ error: 'Maximum 4 partners allowed' });

    const { rows } = await pool.query(
      `INSERT INTO partners (name, share_percent, color, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), share_percent, color || '#7c3aed', notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[partners POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── PUT update partner ───────────────────────────────────────── */
router.put('/:id', async (req, res) => {
  try {
    const { name, share_percent, color, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE partners SET name=$1, share_percent=$2, color=$3, notes=$4, updated_at=NOW()
       WHERE id=$5 AND is_active=true RETURNING *`,
      [name.trim(), share_percent, color, notes || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Partner not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[partners PUT]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── DELETE (soft) partner ────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE partners SET is_active=false, updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
