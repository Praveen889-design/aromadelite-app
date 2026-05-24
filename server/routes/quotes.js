const express = require('express');
const pool = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { deductStockForQuote } = require('./units');

const router = express.Router();
router.use(requireAuth);

const parseJSON = (s, fallback = null) => {
  if (s == null) return fallback;
  if (typeof s === 'object') return s;   // pg already parsed JSONB columns
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

// Both modes compute the same totals (base + GST = final amount).
// 'without_gst' only affects display: GST is absorbed into the quoted price,
// not shown as a separate line to the client — but the seller still files GST.
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

// ── Discount approval helpers ────────────────────────────────────────────────

// Returns the max discount % across all items in a quote (0 if no system_price)
const maxItemDiscount = (items) => {
  let max = 0;
  for (const it of items) {
    const sys    = Number(it.system_price) || 0;
    const quoted = Number(it.unit_price)   || 0;
    if (sys > 0 && quoted < sys) {
      const pct = ((sys - quoted) / sys) * 100;
      if (pct > max) max = pct;
    }
  }
  return +max.toFixed(1);
};

// Fetch the discount threshold from app_settings (default 10%)
const getDiscountThreshold = async () => {
  try {
    const { rows } = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'discount_approval_threshold_pct'"
    );
    return rows[0] ? Number(rows[0].value) : 10;
  } catch { return 10; }
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

    const gst_mode = ['with_gst', 'without_gst'].includes(b.gst_mode) ? b.gst_mode : 'with_gst';
    const totals = computeTotals(b.items);
    const quote_number = await nextQuoteNumber();
    const validity_days = Number(b.validity_days) || 7;
    const estMonthly = b.requirement_type === 'Monthly Contract'
      ? totals.total_amount
      : +(totals.total_amount / 3).toFixed(2);

    const nextFollowUp    = b.next_follow_up_date || null;
    const expectedOrder   = b.expected_order_date || null;

    // Discount approval check
    const threshold    = await getDiscountThreshold();
    const maxDisc      = maxItemDiscount(b.items);
    const needsApproval = maxDisc > threshold;
    const approvalStatus = needsApproval ? 'pending' : null;

    await client.query('BEGIN');

    const qRes = await client.query(`
      INSERT INTO quotes
        (quote_number, employee_id, client_name, client_business_name, client_type,
         client_phone, client_email, client_city, requirement_type, items,
         subtotal, gst_amount, total_amount, validity_days, notes,
         next_follow_up_date, expected_order_date, gst_mode, status,
         discount_approval_status, max_discount_pct)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'draft',$19,$20)
      RETURNING id
    `, [
      quote_number, req.user.id, b.client_name, b.client_business_name || null, b.client_type,
      b.client_phone || null, b.client_email || null, b.client_city || null,
      b.requirement_type, JSON.stringify(b.items),
      totals.subtotal, totals.gst_amount, totals.total_amount, validity_days, b.notes || null,
      nextFollowUp, expectedOrder, gst_mode,
      approvalStatus, maxDisc,
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

// GET /api/quotes/aging  — admin-only, quotes ≥7 days old still in draft/sent
router.get('/aging', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const threshold = Math.max(1, Number(req.query.threshold) || 7);
    // Detect optional columns added by migration (safe fallback to NULL if missing)
    const colCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'quotes'
        AND column_name IN ('next_follow_up_date','expected_order_date')
    `);
    const cols = new Set(colCheck.rows.map(r => r.column_name));
    const followupSel = cols.has('next_follow_up_date')
      ? 'q.next_follow_up_date' : 'NULL::date AS next_follow_up_date';
    const orderDateSel = cols.has('expected_order_date')
      ? 'q.expected_order_date' : 'NULL::date AS expected_order_date';

    const { rows } = await pool.query(`
      SELECT
        q.id, q.quote_number, q.status, q.total_amount,
        q.client_name, q.client_business_name, q.client_city, q.client_type,
        ${followupSel}, ${orderDateSel},
        q.created_at,
        (CURRENT_DATE - q.created_at::date) AS age_days,
        e.name  AS employee_name,
        e.employee_id AS employee_code,
        e.region
      FROM quotes q
      JOIN employees e ON e.id = q.employee_id
      WHERE q.status IN ('draft', 'sent')
        AND q.created_at::date <= CURRENT_DATE - ($1 * INTERVAL '1 day')
      ORDER BY age_days DESC
    `, [threshold]);

    const bucket = (d) =>
      d >= 30 ? 'critical' : d >= 14 ? 'warning' : 'notice';

    const quotes = rows.map((r) => ({
      ...r,
      age_days: Number(r.age_days),
      total_amount: +Number(r.total_amount).toFixed(2),
      bucket: bucket(Number(r.age_days)),
    }));

    const summary = {
      critical: quotes.filter((q) => q.bucket === 'critical').length,
      warning:  quotes.filter((q) => q.bucket === 'warning').length,
      notice:   quotes.filter((q) => q.bucket === 'notice').length,
      total:    quotes.length,
    };

    res.json({ threshold, summary, quotes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quotes/pending-discount-approval — admin: quotes awaiting discount approval
router.get('/pending-discount-approval', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows } = await pool.query(`
      SELECT q.*, e.name AS employee_name, e.employee_id AS employee_code, e.region
      FROM quotes q JOIN employees e ON e.id = q.employee_id
      WHERE q.discount_approval_status = 'pending'
      ORDER BY q.created_at DESC
    `);
    res.json({ quotes: rows.map(hydrate) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes/:id/discount-approval — admin approves or rejects
router.post('/:id/discount-approval', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { action, note } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' });
    }
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found' });
    if (rows[0].discount_approval_status !== 'pending') {
      return res.status(400).json({ error: 'Quote is not pending discount approval' });
    }
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await pool.query(`
      UPDATE quotes
      SET discount_approval_status = $1,
          discount_approval_note   = $2,
          discount_approval_by     = $3,
          discount_approval_at     = NOW()
      WHERE id = $4
    `, [newStatus, note || null, req.user.id, req.params.id]);
    const { rows: updated } = await pool.query(`
      SELECT q.*, e.name AS employee_name FROM quotes q
      JOIN employees e ON e.id = q.employee_id WHERE q.id = $1
    `, [req.params.id]);
    res.json({ quote: hydrate(updated[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quotes/discount-settings — get threshold
router.get('/discount-settings', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const threshold = await getDiscountThreshold();
    res.json({ threshold_pct: threshold });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/quotes/discount-settings — update threshold
router.patch('/discount-settings', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const pct = Number(req.body?.threshold_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: 'threshold_pct must be 0–100' });
    }
    await pool.query(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('discount_approval_threshold_pct', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [String(pct)]);
    res.json({ threshold_pct: pct });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes/:id/repeat — clone an existing quote as a new draft
router.post('/:id/repeat', async (req, res) => {
  const pgClient = await pool.connect();
  try {
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found' });
    const src = hydrate(rows[0]);

    if (req.user.role !== 'admin' && src.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const quote_number = await nextQuoteNumber();
    const gst_mode     = src.gst_mode || 'with_gst';
    const totals       = computeTotals(src.items);
    const validity_days = Number(src.validity_days) || 7;
    const estMonthly = src.requirement_type === 'Monthly Contract'
      ? totals.total_amount
      : +(totals.total_amount / 3).toFixed(2);

    await pgClient.query('BEGIN');

    const qRes = await pgClient.query(`
      INSERT INTO quotes
        (quote_number, employee_id, client_name, client_business_name, client_type,
         client_phone, client_email, client_city, requirement_type, items,
         subtotal, gst_amount, total_amount, validity_days, gst_mode, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'draft')
      RETURNING id
    `, [
      quote_number, req.user.id,
      src.client_name, src.client_business_name || null, src.client_type,
      src.client_phone || null, src.client_email || null, src.client_city || null,
      src.requirement_type, JSON.stringify(src.items),
      totals.subtotal, totals.gst_amount, totals.total_amount,
      validity_days, gst_mode,
    ]);
    const quote_id = qRes.rows[0].id;

    const lRes = await pgClient.query(`
      INSERT INTO leads
        (quote_id, employee_id, client_name, client_business_name, client_type,
         client_phone, client_email, client_city, requirement_type,
         estimated_monthly_value, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new')
      RETURNING id
    `, [
      quote_id, req.user.id,
      src.client_name, src.client_business_name || null, src.client_type,
      src.client_phone || null, src.client_email || null, src.client_city || null,
      src.requirement_type, estMonthly,
    ]);

    await pgClient.query('COMMIT');

    const { rows: newRows } = await pool.query(`
      SELECT q.*, e.name AS employee_name, e.employee_id AS employee_code, e.region
      FROM quotes q JOIN employees e ON e.id = q.employee_id
      WHERE q.id = $1
    `, [quote_id]);

    res.status(201).json({ quote: hydrate(newRows[0]), lead_id: lRes.rows[0].id });
  } catch (err) {
    await pgClient.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    pgClient.release();
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
    if (!['draft', 'sent', 'accepted', 'modifications_required', 'hold', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found' });
    if (req.user.role !== 'admin' && rows[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    // Block sending if discount approval is still pending
    if (status === 'sent' && rows[0].discount_approval_status === 'pending') {
      return res.status(400).json({
        error: 'This quote has a discount above the approval threshold. Wait for admin approval before sending.',
        discount_approval_required: true,
      });
    }

    await client.query('BEGIN');
    await client.query('UPDATE quotes SET status = $1 WHERE id = $2', [status, req.params.id]);

    if (status === 'accepted') {
      await client.query(
        "UPDATE leads SET status = 'converted', updated_at = NOW() WHERE quote_id = $1",
        [req.params.id]
      );
      // Auto-deduct stock from the unit in this associate's region (best-effort)
      const quoteItems = parseJSON(rows[0].items, []);
      await deductStockForQuote(client, Number(req.params.id), rows[0].employee_id, quoteItems);
    } else if (status === 'rejected') {
      await client.query(
        "UPDATE leads SET status = 'lost', updated_at = NOW() WHERE quote_id = $1",
        [req.params.id]
      );
    } else if (status === 'modifications_required' || status === 'hold') {
      await client.query(
        "UPDATE leads SET status = 'negotiating', updated_at = NOW() WHERE quote_id = $1 AND status NOT IN ('lost','converted')",
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

// PATCH /api/quotes/:id/modification  — Associate submits modified items for admin approval
router.patch('/:id/modification', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found' });
    const q = rows[0];

    // Only the owning associate (or admin) can submit modifications
    if (req.user.role !== 'admin' && q.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    // Can only modify when status is modifications_required
    if (q.status !== 'modifications_required') {
      return res.status(400).json({ error: 'Quote must be in "modifications_required" status to submit modifications' });
    }

    const { items, modification_note } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    // Recompute totals from modified items
    const totals = computeTotals(items);

    await pool.query(`
      UPDATE quotes
      SET modified_items      = $1,
          modification_status = 'pending_approval',
          modification_note   = $2,
          modified_at         = NOW()
      WHERE id = $3
    `, [JSON.stringify(items), modification_note || null, req.params.id]);

    const updated = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    res.json({ quote: hydrate(updated.rows[0]), modified_totals: totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/quotes/:id/modification/review  — Admin approves or rejects modification
router.patch('/:id/modification/review', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { decision, admin_note } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be "approved" or "rejected"' });
    }

    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found' });
    if (rows[0].modification_status !== 'pending_approval') {
      return res.status(400).json({ error: 'No pending modification to review' });
    }

    await pool.query(`
      UPDATE quotes
      SET modification_status = $1,
          admin_note          = $2,
          modified_at         = NOW()
      WHERE id = $3
    `, [decision, admin_note || null, req.params.id]);

    const updated = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    res.json({ quote: hydrate(updated.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/quotes/:id/dates  — update follow-up & expected-order dates
router.patch('/:id/dates', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found' });
    if (req.user.role !== 'admin' && rows[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const nextFollowUp  = req.body.next_follow_up_date  || null;
    const expectedOrder = req.body.expected_order_date  || null;
    await pool.query(
      'UPDATE quotes SET next_follow_up_date = $1, expected_order_date = $2 WHERE id = $3',
      [nextFollowUp, expectedOrder, req.params.id]
    );
    // Also sync lead follow-up date
    if (nextFollowUp) {
      await pool.query(
        'UPDATE leads SET follow_up_date = $1 WHERE quote_id = $2',
        [nextFollowUp, req.params.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
        SELECT p.id, p.hsn_code, p.unit,
               c.name AS category_name, c.icon_emoji AS category_icon
        FROM products p JOIN product_categories c ON c.id = p.category_id
        WHERE p.id IN (${placeholders})
      `, productIds);
      productCatMap = Object.fromEntries(catRows.rows.map((r) => [r.id, r]));
    }

    const created = new Date(q.created_at);
    const validUntil = new Date(created.getTime() + (q.validity_days || 7) * 86400_000);
    const gst_mode = q.gst_mode || 'with_gst';

    // For approved/pending modifications, expose modified_items so BillBuilder can use them
    const modification_status = q.modification_status || null;
    const rawModItems = parseJSON(q.modified_items, null);

    const mapItems = (arr) => arr.map((it) => {
      const cat = productCatMap[it.product_id] || {};
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unit_price) || 0;
      const gst = Number(it.gst_percent) || 0;
      return {
        product_id: it.product_id,
        product_name: it.product_name || it.name,
        hsn_code: it.hsn_code || cat.hsn_code || null,
        unit: it.unit || cat.unit || 'Nos',
        category_name: cat.category_name || it.category_name || 'Items',
        category_icon: cat.category_icon || it.category_icon || null,
        variant: it.variant || null,
        pack_size: it.pack_size || it.size || null,
        quantity: qty,
        unit_price: price,
        system_price: it.system_price ?? price,
        gst_percent: gst,
        line_total: +(qty * price * (1 + gst / 100)).toFixed(2),
      };
    });

    const originalItems = mapItems(items);
    const modifiedItemsMapped = rawModItems ? mapItems(rawModItems) : null;

    const computeTotalsForItems = (arr) => {
      let sub = 0, gstAmt = 0;
      for (const it of arr) {
        const line = it.quantity * it.unit_price;
        sub += line;
        gstAmt += (line * it.gst_percent) / 100;
      }
      return { subtotal: +sub.toFixed(2), gst_amount: +gstAmt.toFixed(2), total_amount: +(sub + gstAmt).toFixed(2) };
    };

    res.json({
      pdf: {
        company: {
          name: 'Aromadelite',
          legal: 'Sri Vemuri Sai Enterprises',
          tagline: 'B2B Cleaning Products & Hygiene Solutions',
          address: 'SAI NAGAR HNO 8-229/8, NVV NAGAR, CHINTAL, QUTHBULLAPUR, MALKAJGIRI – 500054',
          state: 'Telangana, State Code: 36',
          phone: '+91 63043 82947',
          email: 'contact@aromadelite.in',
          gstin: '36AQJPV7026L2Z5',
        },
        quote: {
          number: q.quote_number, status: q.status, gst_mode,
          created_at: created.toISOString().slice(0, 10),
          valid_until: validUntil.toISOString().slice(0, 10),
          validity_days: q.validity_days, notes: q.notes,
          next_follow_up_date: q.next_follow_up_date ? String(q.next_follow_up_date).slice(0, 10) : null,
          expected_order_date: q.expected_order_date ? String(q.expected_order_date).slice(0, 10) : null,
          modification_status,
          modification_note: q.modification_note || null,
          admin_note: q.admin_note || null,
          modified_at: q.modified_at ? new Date(q.modified_at).toISOString() : null,
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
        // Original items — always the original quote items
        items: originalItems,
        totals: { subtotal: q.subtotal, gst_amount: q.gst_amount, total_amount: q.total_amount },
        // Modified items — set when modification is pending or approved
        modified_items: modifiedItemsMapped,
        modified_totals: modifiedItemsMapped ? computeTotalsForItems(modifiedItemsMapped) : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
