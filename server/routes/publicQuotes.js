/**
 * Public quote routes — NO authentication required.
 * Used for the client-facing approval link.
 */
const express = require('express');
const { randomUUID } = require('crypto');
const pool = require('../database/db');

const router = express.Router();

const parseJSON = (s, fallback = []) => {
  if (s == null) return fallback;
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return fallback; }
};

// ── GET /api/public/quote-approval/:token ─────────────────────────────────────
// Returns the quote data needed for the client approval page.
// Deliberately minimal — no internal employee details, no system_price.
router.get('/quote-approval/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT q.id, q.quote_number, q.status, q.gst_mode,
              q.client_name, q.client_business_name, q.client_type,
              q.client_phone, q.client_city,
              q.requirement_type, q.items, q.notes,
              q.subtotal, q.gst_amount, q.total_amount,
              q.validity_days, q.created_at,
              q.client_approval_status, q.client_approval_at,
              q.client_approval_note, q.client_approved_by_name
       FROM quotes q
       WHERE q.client_approval_token = $1`,
      [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Quote link not found or expired.' });

    const q    = rows[0];
    const items = parseJSON(q.items, []).map((it) => ({
      product_name: it.product_name || it.name || 'Item',
      variant:      it.variant    || null,
      pack_size:    it.pack_size  || it.size || null,
      hsn_code:     it.hsn_code  || null,
      unit:         it.unit      || 'Nos',
      category_name: it.category_name || 'Items',
      quantity:     Number(it.quantity)   || 0,
      unit_price:   Number(it.unit_price) || 0,
      gst_percent:  Number(it.gst_percent) || 0,
      line_total:   +(Number(it.quantity || 0) * Number(it.unit_price || 0) * (1 + (Number(it.gst_percent) || 0) / 100)).toFixed(2),
    }));

    const created    = new Date(q.created_at);
    const validUntil = new Date(created.getTime() + (q.validity_days || 7) * 86400_000);
    const isExpired  = validUntil < new Date();

    res.json({
      quote: {
        quote_number:    q.quote_number,
        status:          q.status,
        gst_mode:        q.gst_mode || 'with_gst',
        created_at:      created.toISOString().slice(0, 10),
        valid_until:     validUntil.toISOString().slice(0, 10),
        is_expired:      isExpired,
        notes:           q.notes || null,
        requirement_type: q.requirement_type,
        client_approval_status:      q.client_approval_status || null,
        client_approval_at:          q.client_approval_at || null,
        client_approval_note:        q.client_approval_note || null,
        client_approved_by_name:     q.client_approved_by_name || null,
      },
      client: {
        name:          q.client_name,
        business_name: q.client_business_name || null,
        type:          q.client_type,
        phone:         q.client_phone || null,
        city:          q.client_city  || null,
      },
      items,
      totals: {
        subtotal:     Number(q.subtotal),
        gst_amount:   Number(q.gst_amount),
        total_amount: Number(q.total_amount),
      },
      company: {
        name:    'Aromadelite',
        legal:   'Sri Vemuri Sai Enterprises',
        phone:   '+91 63043 82947',
        email:   'contact@aromadelite.in',
        address: 'SAI NAGAR HNO 8-229/8, NVV NAGAR, CHINTAL, QUTHBULLAPUR, MALKAJGIRI – 500054',
        gstin:   '36AQJPV7026L2Z5',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/public/quote-approval/:token/respond ───────────────────────────
// Client submits their approval decision.
// Only records the client's response — the associate manually marks the quote Accepted.
router.post('/quote-approval/:token/respond', async (req, res) => {
  try {
    const { decision, note, client_name } = req.body || {};
    if (!['approved', 'changes_requested'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be "approved" or "changes_requested"' });
    }

    const { rows } = await pool.query(
      `SELECT id, status, client_approval_status, quote_number, client_name
       FROM quotes WHERE client_approval_token = $1`,
      [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Quote link not found.' });

    const q = rows[0];

    // Idempotent: already responded — return current state without changes
    if (q.client_approval_status) {
      return res.json({
        already_responded: true,
        client_approval_status: q.client_approval_status,
      });
    }

    await pool.query(
      `UPDATE quotes
       SET client_approval_status  = $1,
           client_approval_note    = $2,
           client_approved_by_name = $3,
           client_approval_at      = NOW()
       WHERE id = $4`,
      [decision, note || null, client_name || q.client_name || null, q.id]
    );

    res.json({
      ok: true,
      quote_number: q.quote_number,
      client_approval_status: decision,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// ── GET /api/public/catalog ─────────────────────────────────────────────────
router.get('/catalog', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.name, p.base_price, p.gst_percent, p.unit, p.description,
             pc.name AS category
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE p.is_active = 1
      ORDER BY pc.name, p.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/public/order-inquiry ─────────────────────────────────────────
router.post('/order-inquiry', async (req, res) => {
  try {
    const { name, business_name, phone, city, message } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

    // Check if existing client — return portal link
    const { rows: clients } = await pool.query(
      `SELECT id, portal_token FROM clients
       WHERE LOWER(TRIM(COALESCE(phone,''))) = LOWER(TRIM($1)) LIMIT 1`,
      [phone]
    );
    if (clients[0]?.portal_token) {
      return res.json({
        type: 'portal',
        url: `${process.env.APP_URL || 'https://aromadelite-app.vercel.app'}/portal/${clients[0].portal_token}`,
        message: 'Welcome back! Here is your personalised order link.',
      });
    }

    // Create lead for follow-up
    await pool.query(
      `INSERT INTO leads (name, company, phone, city, notes, status, source)
       VALUES ($1,$2,$3,$4,$5,'new','website') ON CONFLICT DO NOTHING`,
      [name, business_name || null, phone, city || null,
       message ? `Website inquiry: ${message}` : 'Website landing page inquiry']
    ).catch(() => {});

    res.json({
      type: 'inquiry',
      message: 'Thank you! Our team will contact you within 24 hours to set up your account.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
