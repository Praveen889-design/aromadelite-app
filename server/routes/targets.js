const express = require('express');
const pool = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/targets?year=2025&month=5
// Returns all active associates with their targets + actuals for that month
router.get('/', async (req, res) => {
  try {
    const now   = new Date();
    const year  = Number(req.query.year)  || now.getFullYear();
    const month = Number(req.query.month) || (now.getMonth() + 1);

    // 1. All active associates
    const empRes = await pool.query(`
      SELECT id, employee_id AS employee_code, name, region
      FROM employees
      WHERE role = 'associate' AND is_active = 1
      ORDER BY name
    `);

    // 2. Saved targets for this year/month
    const tRes = await pool.query(`
      SELECT employee_id, revenue_target, leads_target, conversions_target
      FROM associate_targets
      WHERE year = $1 AND month = $2
    `, [year, month]);
    const tMap = Object.fromEntries(tRes.rows.map((r) => [r.employee_id, r]));

    // 3. Quote actuals for this year/month
    const qRes = await pool.query(`
      SELECT employee_id,
             COALESCE(SUM(total_amount), 0) AS actual_revenue,
             COUNT(*)                        AS actual_quotes
      FROM quotes
      WHERE EXTRACT(YEAR  FROM created_at) = $1
        AND EXTRACT(MONTH FROM created_at) = $2
      GROUP BY employee_id
    `, [year, month]);
    const qMap = Object.fromEntries(qRes.rows.map((r) => [r.employee_id, r]));

    // 4. Lead actuals for this year/month
    const lRes = await pool.query(`
      SELECT employee_id,
             COUNT(*) AS actual_leads,
             SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS actual_conversions
      FROM leads
      WHERE EXTRACT(YEAR  FROM created_at) = $1
        AND EXTRACT(MONTH FROM created_at) = $2
      GROUP BY employee_id
    `, [year, month]);
    const lMap = Object.fromEntries(lRes.rows.map((r) => [r.employee_id, r]));

    const rows = empRes.rows.map((e) => {
      const t = tMap[e.id] || {};
      const q = qMap[e.id] || {};
      const l = lMap[e.id] || {};
      return {
        employee_id:        e.id,
        employee_code:      e.employee_code,
        name:               e.name,
        region:             e.region,
        revenue_target:     +Number(t.revenue_target     || 0).toFixed(2),
        leads_target:       Number(t.leads_target        || 0),
        conversions_target: Number(t.conversions_target  || 0),
        actual_revenue:     +Number(q.actual_revenue     || 0).toFixed(2),
        actual_quotes:      Number(q.actual_quotes       || 0),
        actual_leads:       Number(l.actual_leads        || 0),
        actual_conversions: Number(l.actual_conversions  || 0),
      };
    });

    res.json({ year, month, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/targets/bulk  — upsert targets for a given year/month
router.post('/bulk', async (req, res) => {
  try {
    const { year, month, targets } = req.body || {};
    if (!year || !month || !Array.isArray(targets) || !targets.length) {
      return res.status(400).json({ error: 'year, month and targets[] are required' });
    }

    for (const t of targets) {
      await pool.query(`
        INSERT INTO associate_targets
          (employee_id, year, month, revenue_target, leads_target, conversions_target, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (employee_id, year, month)
        DO UPDATE SET
          revenue_target     = EXCLUDED.revenue_target,
          leads_target       = EXCLUDED.leads_target,
          conversions_target = EXCLUDED.conversions_target,
          updated_at         = NOW()
      `, [
        t.employee_id, year, month,
        Number(t.revenue_target)     || 0,
        Number(t.leads_target)       || 0,
        Number(t.conversions_target) || 0,
      ]);
    }

    res.json({ ok: true, saved: targets.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
