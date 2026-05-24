const express = require('express');
const pool    = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * Client identity key: (normalised phone, normalised business_name)
 * We match existing quotes/bills to the clients table via these keys.
 * Associates see only their own clients; admins see all.
 */

// ── helpers ──────────────────────────────────────────────────
const clientKey = (phone, biz) =>
  `${(phone || '').toLowerCase().trim()}|${(biz || '').toLowerCase().trim()}`;

// Upsert a client record from a quote row (called lazily on first view)
const upsertClient = async (q) => {
  const { rows } = await pool.query(`
    INSERT INTO clients (business_name, contact_name, phone, email, city, client_type, gstin)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT ON CONSTRAINT idx_clients_phone_biz DO UPDATE
      SET contact_name = EXCLUDED.contact_name,
          email        = COALESCE(EXCLUDED.email, clients.email),
          city         = COALESCE(EXCLUDED.city,  clients.city),
          client_type  = COALESCE(EXCLUDED.client_type, clients.client_type),
          gstin        = COALESCE(EXCLUDED.gstin, clients.gstin),
          updated_at   = NOW()
    RETURNING *
  `, [
    q.client_business_name || null,
    q.client_name,
    q.client_phone || null,
    q.client_email || null,
    q.client_city  || null,
    q.client_type  || null,
    q.client_gstin || null,
  ]);
  return rows[0];
};

// ── GET /api/clients ─────────────────────────────────────────
// Returns unique clients with aggregated stats from quotes + bills.
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { q } = req.query; // search term

    // Build where clause for employee scoping
    const empFilter = isAdmin ? '' : `AND q.employee_id = ${isAdmin ? 'ANY(SELECT id FROM employees)' : `'${req.user.id}'`}`;

    const vals = [];
    const $v   = (v) => { vals.push(v); return `$${vals.length}`; };
    const empClause = isAdmin ? '' : `AND q.employee_id = ${$v(req.user.id)}`;
    const searchClause = q
      ? `AND (LOWER(q.client_business_name) LIKE ${$v(`%${q.toLowerCase()}%`)} OR LOWER(q.client_name) LIKE $${vals.length} OR q.client_phone LIKE $${vals.length})`
      : '';

    const { rows } = await pool.query(`
      SELECT
        LOWER(TRIM(COALESCE(q.client_phone,'')))        AS phone_key,
        LOWER(TRIM(COALESCE(q.client_business_name,''))) AS biz_key,
        MAX(q.client_name)            AS contact_name,
        MAX(q.client_business_name)   AS business_name,
        MAX(q.client_phone)           AS phone,
        MAX(q.client_email)           AS email,
        MAX(q.client_city)            AS city,
        MAX(q.client_type)            AS client_type,
        COUNT(DISTINCT q.id)          AS quote_count,
        COALESCE(SUM(q.total_amount), 0) AS total_quoted,
        MAX(q.created_at)             AS last_quote_at,
        MIN(q.created_at)             AS first_quote_at,
        COUNT(DISTINCT b.id)          AS bill_count,
        COALESCE(SUM(b.total_amount), 0)  AS total_billed,
        COALESCE(SUM(CASE WHEN b.payment_status = 'completed' THEN b.total_amount ELSE b.amount_paid END), 0) AS total_paid,
        COUNT(DISTINCT CASE WHEN b.payment_status='completed' THEN b.id END) AS paid_bills,
        COUNT(DISTINCT CASE WHEN b.payment_status='partial'   THEN b.id END) AS partial_bills,
        COUNT(DISTINCT CASE WHEN b.payment_status='pending'   THEN b.id END) AS pending_bills,
        c.id                          AS client_id,
        c.notes                       AS client_notes
      FROM quotes q
      LEFT JOIN bills b ON b.client_phone = q.client_phone
        AND LOWER(TRIM(COALESCE(b.client_business_name,''))) = LOWER(TRIM(COALESCE(q.client_business_name,'')))
      LEFT JOIN clients c ON
        LOWER(TRIM(COALESCE(c.phone,''))) = LOWER(TRIM(COALESCE(q.client_phone,'')))
        AND LOWER(TRIM(COALESCE(c.business_name,''))) = LOWER(TRIM(COALESCE(q.client_business_name,'')))
      WHERE 1=1 ${empClause} ${searchClause}
      GROUP BY phone_key, biz_key, c.id, c.notes
      ORDER BY last_quote_at DESC
    `, vals);

    res.json({ clients: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/clients/:id ──────────────────────────────────────
// Get single client record + full stats
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json({ client: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/clients/upsert ──────────────────────────────────
// Create or update a client record from a quote/bill row
router.post('/upsert', async (req, res) => {
  try {
    const client = await upsertClient(req.body);
    res.json({ client });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/clients/:id ────────────────────────────────────
// Update notes (and optionally other editable fields)
router.patch('/:id', async (req, res) => {
  try {
    const { notes, phone, email, city, gstin } = req.body || {};
    const vals = [];
    const $v   = (v) => { vals.push(v); return `$${vals.length}`; };
    const sets = [];

    if (notes !== undefined) sets.push(`notes = ${$v(notes)}`);
    if (phone !== undefined) sets.push(`phone = ${$v(phone)}`);
    if (email !== undefined) sets.push(`email = ${$v(email)}`);
    if (city  !== undefined) sets.push(`city  = ${$v(city)}`);
    if (gstin !== undefined) sets.push(`gstin = ${$v(gstin)}`);
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    sets.push('updated_at = NOW()');
    vals.push(req.params.id);
    await pool.query(`UPDATE clients SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    res.json({ client: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/clients/:id/history ─────────────────────────────
// All quotes + bills for this client (matched by phone + biz)
router.get('/:id/history', async (req, res) => {
  try {
    const { rows: cRows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!cRows[0]) return res.status(404).json({ error: 'Client not found' });
    const c = cRows[0];

    const isAdmin = req.user.role === 'admin';
    const empClause = isAdmin ? '' : 'AND q.employee_id = $3';
    const empVals   = isAdmin ? [c.phone || '', c.business_name || ''] : [c.phone || '', c.business_name || '', req.user.id];

    // Quotes
    const { rows: quotes } = await pool.query(`
      SELECT q.*, e.name AS employee_name, e.employee_id AS employee_code
      FROM quotes q
      JOIN employees e ON e.id = q.employee_id
      WHERE LOWER(TRIM(COALESCE(q.client_phone,'')))         = LOWER(TRIM($1))
        AND LOWER(TRIM(COALESCE(q.client_business_name,''))) = LOWER(TRIM($2))
        ${empClause}
      ORDER BY q.created_at DESC
    `, empVals);

    // Bills
    const empVals2 = isAdmin ? [c.phone || '', c.business_name || ''] : [c.phone || '', c.business_name || '', req.user.id];
    const empClause2 = isAdmin ? '' : 'AND b.employee_id = $3';
    const { rows: bills } = await pool.query(`
      SELECT b.*, e.name AS employee_name, e.employee_id AS employee_code
      FROM bills b
      JOIN employees e ON e.id = b.employee_id
      WHERE LOWER(TRIM(COALESCE(b.client_phone,'')))         = LOWER(TRIM($1))
        AND LOWER(TRIM(COALESCE(b.client_business_name,''))) = LOWER(TRIM($2))
        ${empClause2}
      ORDER BY b.created_at DESC
    `, empVals2);

    // Top products bought (from quote items)
    const allItems = [];
    for (const q of quotes) {
      let items = q.items;
      if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
      if (Array.isArray(items)) {
        for (const it of items) {
          allItems.push({ name: it.product_name || it.name, qty: Number(it.quantity) || 0, rev: (Number(it.quantity)||0) * (Number(it.unit_price)||0) });
        }
      }
    }
    const prodMap = {};
    for (const it of allItems) {
      if (!it.name) continue;
      if (!prodMap[it.name]) prodMap[it.name] = { name: it.name, total_qty: 0, total_revenue: 0, order_count: 0 };
      prodMap[it.name].total_qty     += it.qty;
      prodMap[it.name].total_revenue += it.rev;
      prodMap[it.name].order_count   += 1;
    }
    const top_products = Object.values(prodMap)
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10);

    res.json({ quotes, bills, top_products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
