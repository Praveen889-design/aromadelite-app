const express = require('express');
const pool    = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

/**
 * POST /api/settings/reset
 * Body: { target: 'quotes' | 'leads' | 'units' | 'products' | 'employees' | 'all' }
 *
 * Deletes test/demo data. Employees target never removes admin accounts.
 * All targets: cascades through related tables in safe order.
 */
router.post('/reset', async (req, res) => {
  const { target } = req.body || {};

  const VALID = ['quotes', 'leads', 'units', 'products', 'employees', 'all'];
  if (!VALID.includes(target)) {
    return res.status(400).json({ error: `target must be one of: ${VALID.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let deleted = {};

    if (target === 'quotes' || target === 'all') {
      // Cascade: adjustments reference quotes, leads reference quotes
      const r = await client.query('DELETE FROM unit_stock_adjustments WHERE quote_id IS NOT NULL');
      await client.query("UPDATE leads SET quote_id = NULL, status = 'new' WHERE quote_id IS NOT NULL");
      const q = await client.query('DELETE FROM quotes');
      deleted.quotes = q.rowCount;
    }

    if (target === 'leads' || target === 'all') {
      const r = await client.query('DELETE FROM leads');
      deleted.leads = r.rowCount;
    }

    if (target === 'units' || target === 'all') {
      // Cascade handled by FK ON DELETE CASCADE on child tables
      const r = await client.query('DELETE FROM units');
      deleted.units = r.rowCount;
    }

    if (target === 'products' || target === 'all') {
      const r = await client.query('DELETE FROM products');
      deleted.products = r.rowCount;
    }

    if (target === 'employees' || target === 'all') {
      // Never delete admin accounts — only remove associates
      await client.query('DELETE FROM commission_structures WHERE employee_id IN (SELECT id FROM employees WHERE role = $1)', ['associate']);
      await client.query('DELETE FROM associate_targets    WHERE employee_id IN (SELECT id FROM employees WHERE role = $1)', ['associate']);
      const r = await client.query("DELETE FROM employees WHERE role = 'associate'");
      deleted.employees = r.rowCount;
    }

    await client.query('COMMIT');

    console.log(`[reset] target=${target} deleted=`, deleted, `by admin=${req.user.id}`);
    res.json({ ok: true, deleted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[reset-error]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
