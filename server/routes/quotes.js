const express = require('express');
const pool = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const parseJSON = (s, fallback = null) => {
  if (s == null) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
};

const hydrate = (q) => ({ ...q, items: parseJSON(q.items, []) });

const nextQuoteNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `ARO-${year}-`;
  const { rows } = await pool.query(
    "SELECT quote_number FROM quotes WHERE quote_number LIKE $1 ORDER BY id DESC LIMIT 1",
    [`${prefix}%`]
  );
  let next = 1;
  if (rows[0]) {
    const seq = parseInt(rows[0].quote_number.split('-')[2], 10);
    if (Number.isFinite(seq)) next = seq + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
};

const computeTotals = (items) => {
  let subtotal = 0, gst_amount = 0;
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

// POST /api/quotes
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const b = req.body || {};
    for (const f of ['client_name', 'client_type', 'requirement_type', 'items']) {
      if (!b[f]) return res.status(400).json({ error: `${f} is required` });
    }
    if (!Array.isArray(b.items) || b.items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    const totals = computeTotals(b.items);
    const quote_number = await nextQuoteNumber();
    const validity_days = Number(b.validity_days) || 30;
    const estMonthly = b.requirement_type === 'Monthly Contract'
      ? totals.total_amount
      : +(totals.total_amount / 3).toFixed(2);

    const nextFollowUp    = b.next_follow_up_date || null;
    const expectedOrder   = b.expected_order_date || null;

    await client.query('BEGIN');

    const qRes = await client.query(`
      INSERT INTO quotes
        (quote_number, employee_id, client_name, client_business_name, client_type,
         client_phone, client_email, client_city, requirement_type, items,
         subtotal, gst_amount, total_amount, validity_days, notes,
         next_follow_up_date, expected_order_date, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'draft')
      RETURNING id
    `, [
      quote_number, req.user.id, b.client_name, b.client_business_name || null, b.client_type,
      b.client_phone || null, b.client_email || null, b.client_city || null,
      b.requirement_type, JSON.stringify(b.items),
      totals.subtotal, totals.gst_amount, totals.total_amount, validity_days, b.notes || null,
      nextFollowUp, expectedOrder,
    ]);
    const quote_id = qRes.rows[0].id;

    const lRes = await client.query(`
      INSERT INTO leads
        (quote_id, employee_id, client_name, client_business_name, client_type,
         client_phone, client_email, client_city, requirement_type,
         estimated_monthly_value, follow_up_date, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'new',$12)
      RETURNING id
    `, [
      quote_id, req.user.id, b.client_name, b.client_business_name || null, b.client_type,
      b.client_phone || null, b.client_email || null, b.client_city || null,
      b.requirement_type, estMonthly, nextFollowUp, b.notes || null,
    ]);
    const lead_id = lRes.rows[0].id;

    await client.query('COMMIT');

    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [quote_id]);
    res.status(201).json({ quote: hydrate(rows[0]), lead_id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/quotes
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = isAdmin
      ? await pool.query(`
          SELECT q.*, e.name AS employee_name, e.employee_id AS employee_code, e.region
          FROM quotes q JOIN employees e ON e.id = q.employee_id
          ORDER BY q.created_at DESC
        `)
      : await pool.query(`
          SELECT q.*, e.name AS employee_name, e.employee_id AS employee_code, e.region
          FROM quotes q JOIN employees e ON e.id = q.employee_id
          WHERE q.employee_id = $1
          ORDER BY q.created_at DESC
        `, [req.user.id]);
    res.json({ quotes: rows.map(hydrate) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT q.*, e.name AS employee_name, e.employee_id AS employee_code, e.region
      FROM quotes q JOIN employees e ON e.id = q.employee_id
      WHERE q.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found' });
    if (req.user.role !== 'admin' && rows[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ quote: hydrate(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  const client = await pool.connect();
  try {
    const { status } = req.body || {};
    if (!['draft', 'sent', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found' });
    if (req.user.role !== 'admin' && rows[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await client.query('BEGIN');
    await client.query('UPDATE quotes SET status = $1 WHERE id = $2', [status, req.params.id]);

    if (status === 'accepted') {
      await client.query(
        "UPDATE leads SET status = 'converted', updated_at = NOW() WHERE quote_id = $1",
        [req.params.id]
      );
    } else if (status === 'rejected') {
      await client.query(
        "UPDATE leads SET status = 'lost', updated_at = NOW() WHERE quote_id = $1",
        [req.params.id]
      );
    } else if (status === 'sent') {
      await client.query(
        "UPDATE leads SET status = 'contacted', updated_at = NOW() WHERE quote_id = $1 AND status = 'new'",
        [req.params.id]
      );
    }
    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    res.json({ quote: hydrate(updated.rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get('/:id/pdf-data', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT q.*, e.name AS employee_name, e.employee_id AS employee_code,
             e.phone AS employee_phone, e.email AS employee_email, e.region
      FROM quotes q JOIN employees e ON e.id = q.employee_id
      WHERE q.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found' });
    const q = rows[0];
    if (req.user.role !== 'admin' && q.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const items = parseJSON(q.items, []);
    const productIds = [...new Set(items.map((it) => it.product_id).filter(Boolean))];
    let productCatMap = {};
    if (productIds.length) {
      const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
      const catRows = await pool.query(`
        SELECT p.id, c.name AS category_name, c.icon_emoji AS category_icon
        FROM products p JOIN product_categories c ON c.id = p.category_id
        WHERE p.id IN (${placeholders})
      `, productIds);
      productCatMap = Object.fromEntries(catRows.rows.map((r) => [r.id, r]));
    }

    const created = new Date(q.created_at);
    const validUntil = new Date(created.getTime() + (q.validity_days || 30) * 86400_000);

    res.json({
      pdf: {
        company: {
          name: 'Aromadelite',
          tagline: 'B2B Cleaning Products & Hygiene Solutions',
          address: 'Hyderabad, Telangana, India',
          gstin: '36AAAAA0000A1Z5',
        },
        quote: {
          number: q.quote_number, status: q.status, created_at: q.created_at,
          valid_until: validUntil.toISOString().slice(0, 10),
          validity_days: q.validity_days, notes: q.notes,
          next_follow_up_date: q.next_follow_up_date || null,
          expected_order_date: q.expected_order_date || null,
        },
        client: {
          name: q.client_name, business_name: q.client_business_name, type: q.client_type,
          phone: q.client_phone, email: q.client_email, city: q.client_city,
          requirement_type: q.requirement_type,
        },
        employee: {
          employee_id: q.employee_code, name: q.employee_name,
          phone: q.employee_phone, email: q.employee_email, region: q.region,
        },
        items: items.map((it) => {
          const cat = productCatMap[it.product_id] || {};
          return {
            product_id: it.product_id, product_name: it.product_name || it.name,
            category_name: cat.category_name || 'Items', category_icon: cat.category_icon || null,
            variant: it.variant || null, pack_size: it.pack_size || it.size || null,
            quantity: it.quantity, unit_price: it.unit_price,
            system_price: it.system_price ?? it.unit_price,
            gst_percent: it.gst_percent,
            line_total: +((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)).toFixed(2),
          };
        }),
        totals: { subtotal: q.subtotal, gst_amount: q.gst_amount, total_amount: q.total_amount },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
