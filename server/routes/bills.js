const express = require('express');
const pool = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// bills.items is JSONB — pg driver returns it already parsed as a JS array/object.
// TEXT columns (like quotes.items) still come as strings needing JSON.parse.
// This function handles both cases.
const parseJSON = (s, fallback = null) => {
  if (s == null) return fallback;
  if (typeof s !== 'string') return s; // already parsed by pg (JSONB column)
  try { return JSON.parse(s); } catch { return fallback; }
};

const hydrate = (b) => ({ ...b, items: parseJSON(b.items, []) });

const nextBillNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `ARO-BILL-${year}-`;
  const { rows } = await pool.query(
    "SELECT bill_number FROM bills WHERE bill_number LIKE $1 ORDER BY id DESC LIMIT 1",
    [`${prefix}%`]
  );
  let next = 1;
  if (rows[0]) {
    const parts = rows[0].bill_number.split('-');
    const seq = parseInt(parts[parts.length - 1], 10);
    if (Number.isFinite(seq)) next = seq + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
};

/**
 * computeTotals — calculates subtotal/gst/total from items.
 * gst_mode:
 *   'with_gst'    → unit_price is BASE price; GST shown separately
 *   'without_gst' → unit_price is already INCLUSIVE (base + gst absorbed);
 *                    stored as-is, gst_amount = 0, total = subtotal
 */
const computeTotals = (items, gst_mode) => {
  let subtotal = 0, gst_amount = 0;
  if (gst_mode === 'without_gst') {
    // Prices already inclusive; no separate GST line
    for (const it of items) {
      subtotal += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    }
    return {
      subtotal: +subtotal.toFixed(2),
      gst_amount: 0,
      total_amount: +subtotal.toFixed(2),
    };
  }
  // with_gst (default)
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    subtotal += line;
    gst_amount += (line * (Number(it.gst_percent) || 0)) / 100;
  }
  return {
    subtotal: +subtotal.toFixed(2),
    gst_amount: +gst_amount.toFixed(2),
    total_amount: +(subtotal + gst_amount).toFixed(2),
  };
};

// POST /api/bills  — create a bill (usually from an accepted quote)
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const required = ['client_name', 'items'];
    for (const f of required) {
      if (!b[f]) return res.status(400).json({ error: `${f} is required` });
    }
    if (!Array.isArray(b.items) || b.items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    const gst_mode = ['with_gst', 'without_gst'].includes(b.gst_mode) ? b.gst_mode : 'with_gst';
    const totals = computeTotals(b.items, gst_mode);
    const bill_number = await nextBillNumber();

    const { rows } = await pool.query(`
      INSERT INTO bills
        (bill_number, quote_id, employee_id,
         client_name, client_business_name, client_type,
         client_phone, client_email, client_city, requirement_type,
         client_gstin, client_state, place_of_supply,
         items, gst_mode, subtotal, gst_amount, total_amount, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'draft')
      RETURNING *
    `, [
      bill_number,
      b.quote_id || null,
      req.user.id,
      b.client_name,
      b.client_business_name || null,
      b.client_type || null,
      b.client_phone || null,
      b.client_email || null,
      b.client_city || null,
      b.requirement_type || null,
      b.client_gstin || null,
      b.client_state || '36-Telangana',
      b.place_of_supply || '36-Telangana',
      JSON.stringify(b.items),
      gst_mode,
      totals.subtotal,
      totals.gst_amount,
      totals.total_amount,
      b.notes || null,
    ]);

    res.status(201).json({ bill: hydrate(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bills
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = isAdmin
      ? await pool.query(`
          SELECT b.*, e.name AS employee_name, e.employee_id AS employee_code, e.region
          FROM bills b JOIN employees e ON e.id = b.employee_id
          ORDER BY b.created_at DESC
        `)
      : await pool.query(`
          SELECT b.*, e.name AS employee_name, e.employee_id AS employee_code, e.region
          FROM bills b JOIN employees e ON e.id = b.employee_id
          WHERE b.employee_id = $1
          ORDER BY b.created_at DESC
        `, [req.user.id]);
    res.json({ bills: rows.map(hydrate) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bills/payment-pending  — all bills with pending payment (admin sees all, associate sees own)
// NOTE: must be declared BEFORE /:id to avoid "payment-pending" being parsed as an integer id
router.get('/payment-pending', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = isAdmin
      ? await pool.query(`
          SELECT b.*, e.name AS employee_name, e.employee_id AS employee_code, e.region
          FROM bills b JOIN employees e ON e.id = b.employee_id
          WHERE b.payment_status = 'pending' AND b.status != 'cancelled'
          ORDER BY b.created_at DESC
        `)
      : await pool.query(`
          SELECT b.*, e.name AS employee_name, e.employee_id AS employee_code, e.region
          FROM bills b JOIN employees e ON e.id = b.employee_id
          WHERE b.payment_status = 'pending' AND b.status != 'cancelled'
            AND b.employee_id = $1
          ORDER BY b.created_at DESC
        `, [req.user.id]);

    res.json({ bills: rows.map(hydrate) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bills/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, e.name AS employee_name, e.employee_id AS employee_code,
             e.phone AS employee_phone, e.email AS employee_email, e.region
      FROM bills b JOIN employees e ON e.id = b.employee_id
      WHERE b.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Bill not found' });
    if (req.user.role !== 'admin' && rows[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ bill: hydrate(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/bills/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['draft', 'issued', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await pool.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Bill not found' });
    if (req.user.role !== 'admin' && rows[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query(
      'UPDATE bills SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, req.params.id]
    );
    const updated = await pool.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    res.json({ bill: hydrate(updated.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/bills/:id/payment  — update payment status (any auth'd user owning the bill)
router.patch('/:id/payment', async (req, res) => {
  const client = await pool.connect();
  try {
    const { payment_status } = req.body || {};
    if (!['pending', 'completed'].includes(payment_status)) {
      return res.status(400).json({ error: 'payment_status must be "pending" or "completed"' });
    }

    const { rows } = await pool.query(
      `SELECT b.*, q.employee_id AS quote_employee_id
       FROM bills b LEFT JOIN quotes q ON q.id = b.quote_id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bill not found' });
    const bill = rows[0];
    if (req.user.role !== 'admin' && bill.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE bills
       SET payment_status = $1,
           payment_completed_at = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [
        payment_status,
        payment_status === 'completed' ? new Date() : null,
        req.params.id,
      ]
    );

    // When payment completed → mark lead as converted + quote as accepted
    if (payment_status === 'completed' && bill.quote_id) {
      await client.query(
        `UPDATE leads SET status = 'converted', updated_at = NOW()
         WHERE quote_id = $1 AND status != 'converted'`,
        [bill.quote_id]
      );
      await client.query(
        `UPDATE quotes SET status = 'accepted' WHERE id = $1 AND status != 'accepted'`,
        [bill.quote_id]
      );
    }

    // When reverted to pending → revert lead to 'negotiating' if it was just converted via payment
    if (payment_status === 'pending' && bill.quote_id) {
      await client.query(
        `UPDATE leads SET status = 'negotiating', updated_at = NOW()
         WHERE quote_id = $1 AND status = 'converted'`,
        [bill.quote_id]
      );
    }

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    res.json({ bill: hydrate(updated.rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/bills/:id/pdf-data
router.get('/:id/pdf-data', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, e.name AS employee_name, e.employee_id AS employee_code,
             e.phone AS employee_phone, e.email AS employee_email, e.region
      FROM bills b JOIN employees e ON e.id = b.employee_id
      WHERE b.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Bill not found' });
    const b = rows[0];
    if (req.user.role !== 'admin' && b.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const items = parseJSON(b.items, []);
    const productIds = [...new Set(items.map((it) => it.product_id).filter(Boolean))];
    let productCatMap = {};
    if (productIds.length) {
      const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
      const catRows = await pool.query(`
        SELECT p.id, p.hsn_code, p.unit,
               c.name AS category_name, c.icon_emoji AS category_icon
        FROM products p JOIN product_categories c ON c.id = p.category_id
        WHERE p.id IN (${placeholders})
      `, productIds);
      productCatMap = Object.fromEntries(catRows.rows.map((r) => [r.id, r]));
    }

    const created = new Date(b.created_at);
    const gst_mode = b.gst_mode || 'with_gst';

    res.json({
      pdf: {
        company: {
          name: 'Aromadelite',
          legal: 'Sri Vemuri Sai Enterprises',
          tagline: 'B2B Cleaning Products & Hygiene Solutions',
          address: 'SAI NAGAR H No 8-229/8, NVV NAGAR CHINTAL, QUTHBULLAPUR Hyderabad',
          state: 'Telangana, State Code: 36',
          phone: '6304382947',
          email: 'contact@aromadelite.in',
          gstin: '36AQJPV7026L2Z5',
        },
        bill: {
          number: b.bill_number,
          status: b.status,
          gst_mode,
          created_at: created.toISOString().slice(0, 10),
          quote_id: b.quote_id,
          notes: b.notes,
          place_of_supply: b.place_of_supply || '36-Telangana',
        },
        client: {
          name: b.client_name,
          business_name: b.client_business_name,
          type: b.client_type,
          phone: b.client_phone,
          email: b.client_email,
          city: b.client_city,
          gstin: b.client_gstin || null,
          state: b.client_state || null,
          requirement_type: b.requirement_type,
        },
        employee: {
          employee_id: b.employee_code,
          name: b.employee_name,
          phone: b.employee_phone,
          email: b.employee_email,
          region: b.region,
        },
        items: items.map((it) => {
          const cat = productCatMap[it.product_id] || {};
          const qty = Number(it.quantity) || 0;
          const price = Number(it.unit_price) || 0;
          const gst = gst_mode === 'without_gst' ? 0 : (Number(it.gst_percent) || 0);
          return {
            product_id: it.product_id,
            product_name: it.product_name || it.name,
            hsn_code: it.hsn_code || cat.hsn_code || null,
            unit: it.unit || cat.unit || 'Nos',
            category_name: cat.category_name || 'Items',
            variant: it.variant || null,
            pack_size: it.pack_size || it.size || null,
            quantity: qty,
            unit_price: price,
            gst_percent: gst,
            // line_total = GST-inclusive for with_gst; plain for without_gst
            line_total: gst_mode === 'without_gst'
              ? +(qty * price).toFixed(2)
              : +(qty * price * (1 + gst / 100)).toFixed(2),
          };
        }),
        totals: {
          subtotal: +Number(b.subtotal).toFixed(2),
          gst_amount: +Number(b.gst_amount).toFixed(2),
          total_amount: +Number(b.total_amount).toFixed(2),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
