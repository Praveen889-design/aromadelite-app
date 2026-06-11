const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.id, e.employee_id, e.name, e.email, e.phone, e.role, e.region, e.is_active, e.created_at,
             COALESCE(q.quotes_count, 0) AS quotes_count,
             COALESCE(q.quote_value, 0)  AS quote_value,
             COALESCE(l.leads_count, 0)  AS leads_count
      FROM employees e
      LEFT JOIN (
        SELECT employee_id, COUNT(*) AS quotes_count, SUM(total_amount) AS quote_value
        FROM quotes GROUP BY employee_id
      ) q ON q.employee_id = e.id
      LEFT JOIN (
        SELECT employee_id, COUNT(*) AS leads_count FROM leads GROUP BY employee_id
      ) l ON l.employee_id = e.id
      ORDER BY e.role DESC, e.created_at ASC
    `);
    res.json({ employees: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/next-code', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT employee_id FROM employees WHERE employee_id LIKE 'ARO-%' AND employee_id != 'ARO-ADMIN'"
    );
    let max = 0;
    for (const r of rows) {
      const n = parseInt(r.employee_id.split('-')[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    res.json({ next_code: `ARO-${String(max + 1).padStart(3, '0')}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { employee_id, name, email, phone, password, role, region } = req.body || {};
    if (!employee_id || !name || !password || !role) {
      return res.status(400).json({ error: 'employee_id, name, password, and role are required' });
    }
    if (!['admin', 'associate', 'central_office'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const VALID_REGIONS = ['Hyderabad', 'Nizamabad', 'Warangal', 'Karimnagar', 'Vijayawada', 'Guntur', 'Medak'];
    if (role === 'associate' && region && !VALID_REGIONS.includes(region)) {
      return res.status(400).json({ error: `Invalid region. Must be one of: ${VALID_REGIONS.join(', ')}` });
    }

    const existing = await pool.query('SELECT id FROM employees WHERE employee_id = $1', [employee_id]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Employee ID already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(`
      INSERT INTO employees (employee_id, name, email, phone, password_hash, role, region, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,1)
      RETURNING id
    `, [employee_id, name, email || null, phone || null, hash, role, role === 'admin' ? null : region || null]);

    res.status(201).json({ employee_id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Employee not found' });

    const { name, email, phone, region, is_active, password } = req.body || {};
    const vals = [];
    const $v = (v) => { vals.push(v); return `$${vals.length}`; };
    const setClauses = [];

    if (name !== undefined)      setClauses.push(`name = ${$v(name)}`);
    if (email !== undefined)     setClauses.push(`email = ${$v(email)}`);
    if (phone !== undefined)     setClauses.push(`phone = ${$v(phone)}`);
    if (region !== undefined)    setClauses.push(`region = ${$v(region || null)}`);
    if (is_active !== undefined) setClauses.push(`is_active = ${$v(is_active ? 1 : 0)}`);
    if (password)                setClauses.push(`password_hash = ${$v(bcrypt.hashSync(password, 10))}`);
    if (!setClauses.length) return res.status(400).json({ error: 'No updatable fields provided' });

    vals.push(req.params.id);
    await pool.query(`UPDATE employees SET ${setClauses.join(', ')} WHERE id = $${vals.length}`, vals);

    const { rows } = await pool.query(
      'SELECT id, employee_id, name, email, phone, role, region, is_active FROM employees WHERE id = $1',
      [req.params.id]
    );
    res.json({ employee: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
