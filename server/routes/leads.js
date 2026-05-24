const express = require('express');
const pool = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/leads
router.get('/', async (req, res) => {
  try {
    const { status, from, to, client_type, region } = req.query;
    const vals = [];
    const $v = (v) => { vals.push(v); return `$${vals.length}`; };
    const where = [];

    if (req.user.role !== 'admin') where.push(`l.employee_id = ${$v(req.user.id)}`);
    if (status)      where.push(`l.status = ${$v(status)}`);
    if (client_type) where.push(`l.client_type = ${$v(client_type)}`);
    if (region)      where.push(`e.region = ${$v(region)}`);
    if (from)        where.push(`l.created_at::date >= ${$v(from)}::date`);
    if (to)          where.push(`l.created_at::date <= ${$v(to)}::date`);

    const { rows } = await pool.query(`
      SELECT l.*, e.name AS employee_name, e.employee_id AS employee_code, e.region,
             q.quote_number, q.total_amount AS quote_total
      FROM leads l
      JOIN employees e ON e.id = l.employee_id
      LEFT JOIN quotes q ON q.id = l.quote_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY l.created_at DESC
    `, vals);
    res.json({ leads: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/summary
router.get('/summary', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = isAdmin
      ? await pool.query('SELECT status, COUNT(*) AS count FROM leads GROUP BY status')
      : await pool.query('SELECT status, COUNT(*) AS count FROM leads WHERE employee_id = $1 GROUP BY status', [req.user.id]);

    const byStatus = { new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 };
    for (const r of rows) byStatus[r.status] = Number(r.count);
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const conversion_rate = total ? +((byStatus.converted / total) * 100).toFixed(2) : 0;

    res.json({ summary: { ...byStatus, total, conversion_rate } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/followups/due
// Returns leads where follow_up_date <= today and status not converted/lost
// NOTE: must be before /:id to avoid route conflict
router.get('/followups/due', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = isAdmin
      ? await pool.query(`
          SELECT l.*, e.name AS employee_name, e.employee_id AS employee_code, e.region,
                 q.quote_number, q.total_amount AS quote_total
          FROM leads l
          JOIN employees e ON e.id = l.employee_id
          LEFT JOIN quotes q ON q.id = l.quote_id
          WHERE l.follow_up_date IS NOT NULL
            AND l.follow_up_date::date <= CURRENT_DATE
            AND l.status NOT IN ('converted', 'lost')
          ORDER BY l.follow_up_date ASC, l.created_at DESC
        `)
      : await pool.query(`
          SELECT l.*, e.name AS employee_name, e.employee_id AS employee_code, e.region,
                 q.quote_number, q.total_amount AS quote_total
          FROM leads l
          JOIN employees e ON e.id = l.employee_id
          LEFT JOIN quotes q ON q.id = l.quote_id
          WHERE l.follow_up_date IS NOT NULL
            AND l.follow_up_date::date <= CURRENT_DATE
            AND l.status NOT IN ('converted', 'lost')
            AND l.employee_id = $1
          ORDER BY l.follow_up_date ASC, l.created_at DESC
        `, [req.user.id]);

    res.json({ leads: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT l.*, e.name AS employee_name, e.employee_id AS employee_code, e.region,
             q.quote_number, q.total_amount AS quote_total, q.status AS quote_status
      FROM leads l
      JOIN employees e ON e.id = l.employee_id
      LEFT JOIN quotes q ON q.id = l.quote_id
      WHERE l.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });
    if (req.user.role !== 'admin' && rows[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ lead: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Lead not found' });
    if (req.user.role !== 'admin' && existing[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { status, notes, follow_up_date, follow_up_note, estimated_monthly_value, employee_id } = req.body || {};
    const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (employee_id !== undefined && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can reassign leads' });
    }

    const vals = [];
    const $v = (v) => { vals.push(v); return `$${vals.length}`; };
    const setClauses = [];

    if (status !== undefined)                  setClauses.push(`status = ${$v(status)}`);
    if (notes !== undefined)                   setClauses.push(`notes = ${$v(notes)}`);
    if (follow_up_date !== undefined)          setClauses.push(`follow_up_date = ${$v(follow_up_date)}`);
    if (follow_up_note !== undefined)          setClauses.push(`follow_up_note = ${$v(follow_up_note)}`);
    if (estimated_monthly_value !== undefined) setClauses.push(`estimated_monthly_value = ${$v(estimated_monthly_value)}`);
    if (employee_id !== undefined)             setClauses.push(`employee_id = ${$v(employee_id)}`);
    if (!setClauses.length) return res.status(400).json({ error: 'No updatable fields provided' });

    setClauses.push(`updated_at = NOW()`);
    vals.push(req.params.id);
    await pool.query(`UPDATE leads SET ${setClauses.join(', ')} WHERE id = $${vals.length}`, vals);

    const { rows } = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    res.json({ lead: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
