const express = require('express');
const pool    = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

/* ─── helpers ───────────────────────────────────────────────── */
const parseSlabs = (raw) => {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) || []; } catch { return []; }
};

/**
 * Calculate commission for a given revenue amount + structure.
 * Slab-wise: entire revenue gets the rate of the slab it falls into
 * (not bracket/tax style). Last slab covers everything above its min.
 */
const calcCommission = (revenue, structure) => {
  if (!structure) return 0;
  const rev = Number(revenue) || 0;
  if (rev <= 0) return 0;

  if (structure.type === 'flat') {
    return rev * (Number(structure.flat_rate) / 100);
  }

  // slab
  const slabs = parseSlabs(structure.slabs);
  if (!slabs.length) return 0;
  const sorted = [...slabs]
    .map((s) => ({
      min:  Number(s.min)  || 0,
      max:  s.max != null && s.max !== '' ? Number(s.max) : null,
      rate: Number(s.rate) || 0,
    }))
    .sort((a, b) => a.min - b.min);

  for (let i = sorted.length - 1; i >= 0; i--) {
    const slab = sorted[i];
    const topOk = slab.max == null || rev < slab.max;
    if (rev >= slab.min && topOk) return rev * (slab.rate / 100);
    // last slab: use it if rev >= min and no max defined
    if (i === sorted.length - 1 && slab.max == null && rev >= slab.min)
      return rev * (slab.rate / 100);
  }
  return 0;
};

/* ─────────────────────────────────────────────────────────────
   GET /api/commissions?year=&month=
   Returns all active associates with structure + monthly actuals
─────────────────────────────────────────────────────────────── */
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

    // 2. Commission structures
    const strRes = await pool.query(
      `SELECT employee_id, type, flat_rate, slabs FROM commission_structures`
    );
    const strMap = Object.fromEntries(strRes.rows.map((r) => [r.employee_id, r]));

    // 3. Accepted revenue this month
    const revRes = await pool.query(`
      SELECT employee_id,
             COALESCE(SUM(total_amount), 0)  AS accepted_revenue,
             COUNT(*)::int                    AS accepted_quotes
      FROM quotes
      WHERE status = 'accepted'
        AND EXTRACT(YEAR  FROM created_at) = $1
        AND EXTRACT(MONTH FROM created_at) = $2
      GROUP BY employee_id
    `, [year, month]);
    const revMap = Object.fromEntries(revRes.rows.map((r) => [r.employee_id, r]));

    // 4. All-quotes revenue (for reference)
    const allRevRes = await pool.query(`
      SELECT employee_id,
             COALESCE(SUM(total_amount), 0) AS total_quoted,
             COUNT(*)::int                   AS total_quotes
      FROM quotes
      WHERE EXTRACT(YEAR  FROM created_at) = $1
        AND EXTRACT(MONTH FROM created_at) = $2
      GROUP BY employee_id
    `, [year, month]);
    const allRevMap = Object.fromEntries(allRevRes.rows.map((r) => [r.employee_id, r]));

    const rows = empRes.rows.map((e) => {
      const str             = strMap[e.id] || null;
      const rev             = revMap[e.id]    || {};
      const allRev          = allRevMap[e.id] || {};
      const accepted_revenue = +Number(rev.accepted_revenue || 0).toFixed(2);
      const commission_earned = +calcCommission(accepted_revenue, str).toFixed(2);

      return {
        employee_id:       e.id,
        employee_code:     e.employee_code,
        name:              e.name,
        region:            e.region,
        has_structure:     !!str,
        commission_type:   str?.type    || null,
        flat_rate:         str ? +Number(str.flat_rate).toFixed(2) : null,
        slabs:             str ? parseSlabs(str.slabs) : [],
        accepted_revenue,
        accepted_quotes:   Number(rev.accepted_quotes  || 0),
        total_quoted:      +Number(allRev.total_quoted  || 0).toFixed(2),
        total_quotes:      Number(allRev.total_quotes   || 0),
        commission_earned,
      };
    });

    const totalCommission = +rows.reduce((s, r) => s + r.commission_earned, 0).toFixed(2);
    const totalRevenue    = +rows.reduce((s, r) => s + r.accepted_revenue, 0).toFixed(2);

    res.json({ year, month, rows, totalCommission, totalRevenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/commissions/quotes/:empId?year=&month=
   Returns accepted quotes for an associate in a given month
─────────────────────────────────────────────────────────────── */
router.get('/quotes/:empId', async (req, res) => {
  try {
    const now   = new Date();
    const year  = Number(req.query.year)  || now.getFullYear();
    const month = Number(req.query.month) || (now.getMonth() + 1);

    const { rows } = await pool.query(`
      SELECT id, quote_number, client_name, client_business_name,
             client_type, total_amount, created_at
      FROM quotes
      WHERE employee_id = $1
        AND status = 'accepted'
        AND EXTRACT(YEAR  FROM created_at) = $2
        AND EXTRACT(MONTH FROM created_at) = $3
      ORDER BY created_at DESC
    `, [req.params.empId, year, month]);

    res.json({ quotes: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/commissions/structure
   Upsert commission structure for one associate
   Body: { employee_id, type, flat_rate, slabs }
─────────────────────────────────────────────────────────────── */
router.post('/structure', async (req, res) => {
  try {
    const { employee_id, type, flat_rate, slabs } = req.body || {};
    if (!employee_id) return res.status(400).json({ error: 'employee_id required' });
    if (!['flat', 'slab'].includes(type)) return res.status(400).json({ error: 'type must be flat or slab' });

    const slabsJson = JSON.stringify(Array.isArray(slabs) ? slabs : []);

    await pool.query(`
      INSERT INTO commission_structures
        (employee_id, type, flat_rate, slabs, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (employee_id) DO UPDATE SET
        type       = EXCLUDED.type,
        flat_rate  = EXCLUDED.flat_rate,
        slabs      = EXCLUDED.slabs,
        updated_at = NOW()
    `, [employee_id, type, Number(flat_rate) || 0, slabsJson]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
