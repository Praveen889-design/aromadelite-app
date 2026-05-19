const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/db');
const { requireAuth, blacklistToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { employee_id, password } = req.body || {};
    if (!employee_id || !password) {
      return res.status(400).json({ error: 'employee_id and password are required' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM employees WHERE employee_id = $1 AND is_active = 1',
      [employee_id]
    );
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, employee_id: user.employee_id, name: user.name, role: user.role, region: user.region },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id, employee_id: user.employee_id, name: user.name,
        email: user.email, phone: user.phone, role: user.role, region: user.region,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', requireAuth, (req, res) => {
  blacklistToken(req.token, req.user.exp);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, employee_id, name, email, phone, role, region, is_active, created_at FROM employees WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
