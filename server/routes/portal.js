/**
 * Public client portal routes — NO auth required (token-based)
 * GET  /api/portal/:token        — load client info, products, past orders
 * POST /api/portal/:token/order  — place an order (creates quote as order_placed)
 */
const express = require('express');
const pool    = require('../database/db');

const router = express.Router();

const parseJSON = (s, fallback = null) => {
  if (s == null) return fallback;
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return fallback; }
};

const WITHOUT_GST_MARKUP = 0.05; // +5% on base, mirrors quotes/bills

const computeTotals = (items, gst_mode = 'with_gst') => {
  let subtotal = 0, gst_amount = 0;
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    subtotal  += line;
    gst_amount += (line * (Number(it.gst_percent) || 0)) / 100;
  }
  if (gst_mode === 'without_gst') {
    return { subtotal: +subtotal.toFixed(2), gst_amount: 0, total_amount: +(subtotal * (1 + WITHOUT_GST_MARKUP)).toFixed(2) };
  }
  return {
    subtotal:     +subtotal.toFixed(2),
    gst_amount:   +gst_amount.toFixed(2),
    total_amount: +(subtotal + gst_amount).toFixed(2),
  };
};

const nextQuoteNumber = async () => {
  const year   = new Date().getFullYear();
  const prefix = `ARO-${year}-`;
  const { rows } = await pool.query(
    'SELECT quote_number FROM quotes WHERE quote_number LIKE $1 ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );
  let next = 1;
  if (rows[0]) {
    const seq = parseInt(rows[0].quote_number.split('-')[2], 10);
    if (Number.isFinite(seq)) next = seq + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
};

/* ── GET /api/portal/:token ──────────────────────────────────────────── */
router.get('/:token', async (req, res) => {
  try {
    // 1. Resolve client by token
    const { rows: clientRows } = await pool.query(
      'SELECT * FROM clients WHERE portal_token = $1',
      [req.params.token]
    );
    if (!clientRows[0]) return res.status(404).json({ error: 'Invalid or expired portal link' });
    const client = clientRows[0];

    // 2. Get last accepted/delivered quote to source negotiated prices + employee
    const { rows: lastQuoteRows } = await pool.query(`
      SELECT q.items, q.employee_id, q.gst_mode
      FROM quotes q
      WHERE (
        (q.client_phone = $1 AND $1 IS NOT NULL AND $1 != '')
        OR (LOWER(TRIM(COALESCE(q.client_business_name,''))) = LOWER(TRIM($2)) AND TRIM($2) != '')
      )
      AND q.status IN ('accepted','final_quoted','order_placed','order_delivered')
      ORDER BY q.created_at DESC
      LIMIT 1
    `, [client.phone || null, client.business_name || '']);

    const lastQuote      = lastQuoteRows[0] || null;
    const lastItems      = lastQuote ? parseJSON(lastQuote.items, []) : [];
    const lastEmployeeId = lastQuote?.employee_id   || null;
    const gst_mode       = lastQuote?.gst_mode      || 'with_gst';

    // Build negotiated price map: product_id|variant|pack_size → unit_price
    const negotiated = {};
    for (const it of lastItems) {
      const key = `${it.product_id}|${it.variant || ''}|${it.pack_size || ''}`;
      negotiated[key] = { unit_price: Number(it.unit_price) || 0, gst_percent: Number(it.gst_percent) || 0 };
      // Also store by product_id alone as fallback
      if (!negotiated[`${it.product_id}||`]) {
        negotiated[`${it.product_id}||`] = { unit_price: Number(it.unit_price) || 0, gst_percent: Number(it.gst_percent) || 0 };
      }
    }

    // 3. Full product catalog
    const { rows: products } = await pool.query(`
      SELECT p.id, p.name, p.description, p.base_price, p.unit, p.hsn_code,
             p.gst_percent, p.variants, p.pack_sizes, p.image_url,
             c.name AS category_name, c.icon_emoji AS category_icon
      FROM products p
      JOIN product_categories c ON c.id = p.category_id
      WHERE p.is_active = 1
      ORDER BY c.sort_order NULLS LAST, c.name, p.name
    `);

    const catalog = products.map(p => {
      const sysPrice = Number(p.base_price) || 0;
      const neg      = negotiated[`${p.id}||`];
      return {
        id:               p.id,
        name:             p.name,
        description:      p.description || null,
        base_price:     sysPrice,
        negotiated_price: neg ? neg.unit_price : null,
        display_price:    neg ? neg.unit_price : sysPrice,
        unit:             p.unit || 'Nos',
        hsn_code:         p.hsn_code || null,
        gst_percent:      Number(p.gst_percent) || 0,
        category_name:    p.category_name,
        category_icon:    p.category_icon || null,
        image_url:        p.image_url || null,
        variants:         parseJSON(p.variants,   []),
        pack_sizes:       parseJSON(p.pack_sizes, []),
      };
    });

    // 4. Past orders (last 5, excluding drafts/rejected)
    const { rows: pastOrders } = await pool.query(`
      SELECT q.id, q.quote_number, q.status, q.source, q.created_at,
             q.total_amount, q.items, q.gst_mode
      FROM quotes q
      WHERE (
        (q.client_phone = $1 AND $1 IS NOT NULL AND $1 != '')
        OR (LOWER(TRIM(COALESCE(q.client_business_name,''))) = LOWER(TRIM($2)) AND TRIM($2) != '')
      )
      AND q.status NOT IN ('draft','rejected')
      ORDER BY q.created_at DESC
      LIMIT 5
    `, [client.phone || null, client.business_name || '']);

    return res.json({
      client: {
        id:            client.id,
        name:          client.contact_name,
        business_name: client.business_name || null,
        phone:         client.phone || null,
        city:          client.city  || null,
        type:          client.client_type || null,
      },
      catalog,
      gst_mode,
      employee_id: lastEmployeeId,
      past_orders: pastOrders.map(o => ({
        id:         o.id,
        number:     o.quote_number,
        status:     o.status,
        source:     o.source || 'associate',
        created_at: o.created_at,
        total:      Number(o.total_amount) || 0,
        items:      parseJSON(o.items, []),
        gst_mode:   o.gst_mode || 'with_gst',
      })),
    });
  } catch (err) {
    console.error('[portal GET]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/portal/:token/order ──────────────────────────────────── */
router.post('/:token/order', async (req, res) => {
  const dbClient = await pool.connect();
  try {
    // Resolve client
    const { rows: clientRows } = await pool.query(
      'SELECT * FROM clients WHERE portal_token = $1',
      [req.params.token]
    );
    if (!clientRows[0]) return res.status(404).json({ error: 'Invalid portal link' });
    const client = clientRows[0];

    const { items, notes, orderer_name } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Please add at least one product to your order' });
    }

    // Find employee + gst_mode from last quote
    const { rows: lq } = await pool.query(`
      SELECT employee_id, gst_mode FROM quotes
      WHERE (
        (client_phone = $1 AND $1 IS NOT NULL AND $1 != '')
        OR (LOWER(TRIM(COALESCE(client_business_name,''))) = LOWER(TRIM($2)) AND TRIM($2) != '')
      )
      ORDER BY created_at DESC LIMIT 1
    `, [client.phone || null, client.business_name || '']);

    let employee_id = lq[0]?.employee_id || null;
    if (!employee_id) {
      // Fall back to first admin
      const { rows: admRows } = await pool.query(
        "SELECT id FROM employees WHERE role = 'admin' ORDER BY id LIMIT 1"
      );
      employee_id = admRows[0]?.id || null;
    }
    if (!employee_id) return res.status(500).json({ error: 'No associate found to handle this order' });

    // Client may choose GST mode in the portal; otherwise use the last quote's
    const gst_mode     = ['with_gst', 'without_gst'].includes(req.body?.gst_mode)
      ? req.body.gst_mode
      : (lq[0]?.gst_mode || 'with_gst');
    const totals       = computeTotals(items, gst_mode);
    const quote_number = await nextQuoteNumber();
    const estMonthly   = +(totals.total_amount / 3).toFixed(2);
    const clientName   = orderer_name || client.contact_name;

    await dbClient.query('BEGIN');

    const qRes = await dbClient.query(`
      INSERT INTO quotes
        (quote_number, employee_id,
         client_name, client_business_name, client_type,
         client_phone, client_email, client_city, requirement_type,
         items, subtotal, gst_amount, total_amount,
         validity_days, notes, gst_mode,
         status, source, portal_ordered_at,
         discount_approval_status, max_discount_pct)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,7,$14,$15,
         'order_placed','portal',NOW(),NULL,0)
      RETURNING id
    `, [
      quote_number, employee_id,
      clientName,
      client.business_name || null,
      client.client_type   || 'Other',
      client.phone  || null,
      client.email  || null,
      client.city   || null,
      'Monthly Contract',
      JSON.stringify(items),
      totals.subtotal, totals.gst_amount, totals.total_amount,
      notes || null,
      gst_mode,
    ]);
    const quote_id = qRes.rows[0].id;

    // Lead is created as 'converted' since client is placing a direct order
    await dbClient.query(`
      INSERT INTO leads
        (quote_id, employee_id,
         client_name, client_business_name, client_type,
         client_phone, client_email, client_city, requirement_type,
         estimated_monthly_value, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'converted',$11)
    `, [
      quote_id, employee_id,
      clientName,
      client.business_name || null,
      client.client_type   || 'Other',
      client.phone  || null,
      client.email  || null,
      client.city   || null,
      'Monthly Contract',
      estMonthly,
      notes || null,
    ]);

    await dbClient.query('COMMIT');

    res.status(201).json({
      success:      true,
      quote_id,
      quote_number,
      total:        totals.total_amount,
      message:      'Your order has been placed successfully! Our team will contact you shortly.',
    });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('[portal POST order]', err);
    res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

module.exports = router;
