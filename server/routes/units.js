const express = require('express');
const pool    = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

/* ─── helpers ───────────────────────────────────────────────── */
const parseJSON = (v, fallback = []) => {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v) || fallback; } catch { return fallback; }
};

/* ═══════════════════════════════════════════════════════════════
   UNITS CRUD
═══════════════════════════════════════════════════════════════ */

/* GET /api/units  — all active units + stock summary */
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id, u.name, u.region, u.address, u.contact_person, u.contact_phone,
        u.is_active, u.created_at,
        COUNT(DISTINCT s.id)::int                          AS sku_count,
        COALESCE(SUM(s.quantity), 0)::numeric              AS total_quantity,
        COALESCE(SUM(s.quantity * s.unit_price * (1 + s.gst_percent / 100.0)), 0)::numeric
                                                           AS stock_value,
        MAX(d.deployed_at)                                 AS last_deployed
      FROM units u
      LEFT JOIN unit_stock     s ON s.unit_id = u.id AND s.quantity > 0
      LEFT JOIN unit_stock_deployments d ON d.unit_id = u.id
      WHERE u.is_active = true
      GROUP BY u.id
      ORDER BY u.region, u.name
    `);
    res.json({ units: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/units  — create a unit */
router.post('/', async (req, res) => {
  try {
    const { name, region, address, contact_person, contact_phone } = req.body || {};
    if (!name || !region) return res.status(400).json({ error: 'name and region required' });

    const { rows } = await pool.query(`
      INSERT INTO units (name, region, address, contact_person, contact_phone)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [name, region, address || null, contact_person || null, contact_phone || null]);

    res.status(201).json({ unit: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/units/:id  — update unit details */
router.patch('/:id', async (req, res) => {
  try {
    const { name, region, address, contact_person, contact_phone } = req.body || {};
    const { rows } = await pool.query(`
      UPDATE units SET
        name            = COALESCE($1, name),
        region          = COALESCE($2, region),
        address         = COALESCE($3, address),
        contact_person  = COALESCE($4, contact_person),
        contact_phone   = COALESCE($5, contact_phone),
        updated_at      = NOW()
      WHERE id = $6 RETURNING *
    `, [name, region, address, contact_person, contact_phone, req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Unit not found' });
    res.json({ unit: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/units/:id  — soft-delete */
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE units SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   STOCK
═══════════════════════════════════════════════════════════════ */

/* GET /api/units/region-stock?region=Nizamabad
   Returns aggregated available qty per product across all active
   units in the given region — used by the quote builder to show
   in-stock / no-stock status on every product card.
   Must be declared BEFORE /:id routes to avoid "region-stock"
   being matched as an :id param.
*/
router.get('/region-stock', async (req, res) => {
  try {
    const region = (req.query.region || '').trim();
    if (!region) return res.status(400).json({ error: 'region query param required' });

    const { rows } = await pool.query(`
      SELECT
        s.product_id,
        s.product_name,
        SUM(s.quantity)::numeric AS available_qty
      FROM unit_stock s
      JOIN units u ON u.id = s.unit_id
      WHERE u.region = $1
        AND u.is_active = true
        AND s.quantity > 0
      GROUP BY s.product_id, s.product_name
      ORDER BY s.product_name
    `, [region]);

    res.json({ region, stock: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/units/:id/stock  — current stock + recent adjustments */
router.get('/:id/stock', async (req, res) => {
  try {
    const unitId = req.params.id;

    const [unitRes, stockRes, adjRes] = await Promise.all([
      pool.query('SELECT * FROM units WHERE id = $1', [unitId]),
      pool.query(`
        SELECT s.*, p.name AS catalog_name
        FROM unit_stock s
        LEFT JOIN products p ON p.id = s.product_id
        WHERE s.unit_id = $1
        ORDER BY s.product_name
      `, [unitId]),
      pool.query(`
        SELECT a.*, e.name AS adjusted_by_name, q.quote_number
        FROM unit_stock_adjustments a
        LEFT JOIN employees e ON e.id = a.adjusted_by
        LEFT JOIN quotes    q ON q.id = a.quote_id
        WHERE a.unit_id = $1
        ORDER BY a.adjusted_at DESC
        LIMIT 50
      `, [unitId]),
    ]);

    if (!unitRes.rows[0]) return res.status(404).json({ error: 'Unit not found' });

    res.json({ unit: unitRes.rows[0], stock: stockRes.rows, adjustments: adjRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   DEPLOY STOCK  (bulk upsert + history)
═══════════════════════════════════════════════════════════════ */

/* POST /api/units/:id/deploy
   Body: { note, items: [{ product_id?, product_name, quantity, unit_price, gst_percent }] }
*/
router.post('/:id/deploy', async (req, res) => {
  const client = await pool.connect();
  try {
    const unitId = Number(req.params.id);
    const { note, items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    // Validate each row
    for (const it of items) {
      if (!it.product_name || !it.product_name.trim()) {
        return res.status(400).json({ error: 'Each item must have a product_name' });
      }
      if (Number(it.quantity) <= 0) {
        return res.status(400).json({ error: `Quantity must be > 0 for ${it.product_name}` });
      }
    }

    const totalAmount = items.reduce((s, it) => {
      const qty   = Number(it.quantity)   || 0;
      const price = Number(it.unit_price) || 0;
      const gst   = Number(it.gst_percent) || 0;
      return s + qty * price * (1 + gst / 100);
    }, 0);

    await client.query('BEGIN');

    // 1. Create deployment header
    const depRes = await client.query(`
      INSERT INTO unit_stock_deployments (unit_id, deployed_by, note, total_amount)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [unitId, req.user.id, note || null, +totalAmount.toFixed(2)]);
    const deploymentId = depRes.rows[0].id;

    for (const it of items) {
      const qty   = Number(it.quantity)    || 0;
      const price = Number(it.unit_price)  || 0;
      const gst   = Number(it.gst_percent) || 18;
      const total = +(qty * price * (1 + gst / 100)).toFixed(2);
      const pid   = it.product_id ? Number(it.product_id) : null;
      const pname = it.product_name.trim();

      // 2. Deployment line item
      await client.query(`
        INSERT INTO unit_stock_deployment_items
          (deployment_id, product_id, product_name, quantity, unit_price, gst_percent, total_amount)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [deploymentId, pid, pname, qty, price, gst, total]);

      // 3. Upsert unit_stock (add to existing quantity; update price to latest)
      await client.query(`
        INSERT INTO unit_stock (unit_id, product_id, product_name, quantity, unit_price, gst_percent, last_updated)
        VALUES ($1,$2,$3,$4,$5,$6, NOW())
        ON CONFLICT (unit_id, product_name) DO UPDATE SET
          quantity     = unit_stock.quantity + EXCLUDED.quantity,
          unit_price   = EXCLUDED.unit_price,
          gst_percent  = EXCLUDED.gst_percent,
          last_updated = NOW()
      `, [unitId, pid, pname, qty, price, gst]);

      // 4. Adjustment log
      await client.query(`
        INSERT INTO unit_stock_adjustments
          (unit_id, product_id, product_name, quantity_delta, reason, adjusted_by)
        VALUES ($1,$2,$3,$4,'deployment',$5)
      `, [unitId, pid, pname, qty, req.user.id]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, deployment_id: deploymentId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   DEPLOYMENT HISTORY
═══════════════════════════════════════════════════════════════ */

/* GET /api/units/:id/deployments */
router.get('/:id/deployments', async (req, res) => {
  try {
    const depRes = await pool.query(`
      SELECT d.*, e.name AS deployed_by_name
      FROM unit_stock_deployments d
      LEFT JOIN employees e ON e.id = d.deployed_by
      WHERE d.unit_id = $1
      ORDER BY d.deployed_at DESC
      LIMIT 30
    `, [req.params.id]);

    const ids = depRes.rows.map((r) => r.id);
    let items = [];
    if (ids.length) {
      const itemRes = await pool.query(
        `SELECT * FROM unit_stock_deployment_items WHERE deployment_id = ANY($1) ORDER BY product_name`,
        [ids]
      );
      items = itemRes.rows;
    }

    res.json({
      deployments: depRes.rows.map((d) => ({
        ...d,
        items: items.filter((i) => i.deployment_id === d.id),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   INTERNAL helper (called from quotes route on acceptance)
   Deduct sold items from the unit(s) in the associate's region.
═══════════════════════════════════════════════════════════════ */
const deductStockForQuote = async (dbClient, quoteId, employeeId, items) => {
  try {
    // ── Idempotency guard: skip if this quote was already deducted ──────────
    const already = await dbClient.query(
      `SELECT 1 FROM unit_stock_adjustments WHERE quote_id = $1 AND reason = 'sale' LIMIT 1`,
      [quoteId]
    );
    if (already.rows.length > 0) {
      console.log(`[unit-stock-deduct] quote ${quoteId} already deducted — skipping`);
      return;
    }

    // Get the associate's region
    const empRes = await dbClient.query(
      'SELECT region FROM employees WHERE id = $1', [employeeId]
    );
    const region = empRes.rows[0]?.region;
    if (!region) {
      console.log(`[unit-stock-deduct] employee ${employeeId} has no region — skipping`);
      return;
    }

    // Find active units in that region
    const unitRes = await dbClient.query(
      'SELECT id FROM units WHERE region = $1 AND is_active = true ORDER BY id', [region]
    );
    if (!unitRes.rows.length) {
      console.log(`[unit-stock-deduct] no active units in region "${region}" — skipping`);
      return;
    }

    const unitIds = unitRes.rows.map((r) => r.id);
    let deductedCount = 0;

    for (const it of items) {
      const qty   = Number(it.quantity) || 0;
      if (qty <= 0) continue;
      const pname = (it.product_name || it.name || '').trim();
      const pid   = it.product_id ? Number(it.product_id) : null;

      // Find which unit has stock of this product
      let stockRow = null;
      for (const uid of unitIds) {
        let q;
        if (pid) {
          q = await dbClient.query(
            `SELECT id, unit_id, quantity FROM unit_stock
             WHERE unit_id = $1 AND (product_id = $2 OR LOWER(product_name) = LOWER($3)) AND quantity > 0`,
            [uid, pid, pname]
          );
        } else {
          q = await dbClient.query(
            `SELECT id, unit_id, quantity FROM unit_stock
             WHERE unit_id = $1 AND LOWER(product_name) = LOWER($2) AND quantity > 0`,
            [uid, pname]
          );
        }
        if (q.rows[0]) { stockRow = q.rows[0]; break; }
      }

      if (!stockRow) {
        console.log(`[unit-stock-deduct] "${pname}" not found in any ${region} unit — skipped`);
        continue;
      }

      const deduct = Math.min(qty, Number(stockRow.quantity));

      await dbClient.query(
        'UPDATE unit_stock SET quantity = quantity - $1, last_updated = NOW() WHERE id = $2',
        [deduct, stockRow.id]
      );

      await dbClient.query(`
        INSERT INTO unit_stock_adjustments
          (unit_id, product_id, product_name, quantity_delta, reason, quote_id, adjusted_by)
        VALUES ($1,$2,$3,$4,'sale',$5,$6)
      `, [stockRow.unit_id, pid, pname, -deduct, quoteId, employeeId]);

      deductedCount++;
    }

    console.log(`[unit-stock-deduct] quote ${quoteId}: deducted ${deductedCount}/${items.length} products from region "${region}"`);
  } catch (e) {
    // Best-effort — do not bubble up to fail the quote acceptance
    console.error('[unit-stock-deduct]', e.message);
  }
};

module.exports = router;
module.exports.deductStockForQuote = deductStockForQuote;
