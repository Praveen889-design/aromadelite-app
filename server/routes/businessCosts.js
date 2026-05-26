/**
 * Business Costs — admin only
 * GET  /api/business-costs              → list with filters
 * POST /api/business-costs              → create entry
 * PUT  /api/business-costs/:id          → update entry
 * DELETE /api/business-costs/:id        → delete entry
 * GET  /api/business-costs/summary      → monthly summary + partner profit split
 */
const express = require('express');
const pool    = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
});

const VALID_CATEGORIES = ['personnel', 'logistics', 'inventory', 'marketing', 'technology'];

/* ── GET summary (must be before /:id) ───────────────────────── */
router.get('/summary', async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM, defaults to current month
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const [costsRes, revenueRes, partnersRes] = await Promise.all([
      // Total costs this month (monthly entries for this month + transactions in this month)
      pool.query(`
        SELECT
          category,
          COALESCE(SUM(amount), 0) AS total
        FROM business_costs
        WHERE (entry_type = 'monthly' AND cost_month = $1)
           OR (entry_type = 'transaction' AND TO_CHAR(transaction_date, 'YYYY-MM') = $1)
        GROUP BY category
      `, [targetMonth]),

      // Revenue this month from bills
      pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS revenue,
               COALESCE(SUM(CASE WHEN payment_status='completed' THEN total_amount ELSE 0 END), 0) AS collected
        FROM bills
        WHERE TO_CHAR(created_at, 'YYYY-MM') = $1
      `, [targetMonth]),

      // Partners
      pool.query(`SELECT * FROM partners WHERE is_active = true ORDER BY id ASC`),
    ]);

    const costByCategory = {};
    let totalCosts = 0;
    for (const row of costsRes.rows) {
      costByCategory[row.category] = parseFloat(row.total);
      totalCosts += parseFloat(row.total);
    }

    const revenue   = parseFloat(revenueRes.rows[0].revenue)   || 0;
    const collected = parseFloat(revenueRes.rows[0].collected) || 0;
    const netProfit = collected - totalCosts;

    // Partner profit split
    const partners = partnersRes.rows;
    const totalShare = partners.reduce((s, p) => s + parseFloat(p.share_percent), 0);
    const partnerSplit = partners.map(p => ({
      ...p,
      profit_share: totalShare > 0 ? (parseFloat(p.share_percent) / totalShare) * netProfit : 0,
    }));

    res.json({
      month: targetMonth,
      revenue,
      collected,
      total_costs: totalCosts,
      net_profit: netProfit,
      cost_by_category: costByCategory,
      partner_split: partnerSplit,
    });
  } catch (err) {
    console.error('[business-costs summary]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── GET list ─────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { category, entry_type, month } = req.query;
    let where = [];
    let params = [];
    let idx = 1;

    if (category) { where.push(`category = $${idx++}`); params.push(category); }
    if (entry_type) { where.push(`entry_type = $${idx++}`); params.push(entry_type); }
    if (month) {
      where.push(`((entry_type='monthly' AND cost_month=$${idx}) OR (entry_type='transaction' AND TO_CHAR(transaction_date,'YYYY-MM')=$${idx}))`);
      params.push(month); idx++;
    }

    const sql = `SELECT * FROM business_costs ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY COALESCE(transaction_date, (cost_month || '-01')::date) DESC, id DESC`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[business-costs GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── POST create ──────────────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const { category, subcategory, description, amount, entry_type, cost_month, transaction_date, notes } = req.body;
    if (!category || !description || amount === undefined)
      return res.status(400).json({ error: 'category, description, amount required' });
    if (!VALID_CATEGORIES.includes(category))
      return res.status(400).json({ error: 'Invalid category' });
    if (entry_type === 'monthly' && !cost_month)
      return res.status(400).json({ error: 'cost_month required for monthly entry' });
    if (entry_type === 'transaction' && !transaction_date)
      return res.status(400).json({ error: 'transaction_date required for transaction entry' });

    const { rows } = await pool.query(
      `INSERT INTO business_costs (category, subcategory, description, amount, entry_type, cost_month, transaction_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [category, subcategory || null, description.trim(), amount,
       entry_type || 'monthly', cost_month || null, transaction_date || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[business-costs POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── PUT update ───────────────────────────────────────────────── */
router.put('/:id', async (req, res) => {
  try {
    const { category, subcategory, description, amount, entry_type, cost_month, transaction_date, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE business_costs
       SET category=$1, subcategory=$2, description=$3, amount=$4,
           entry_type=$5, cost_month=$6, transaction_date=$7, notes=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [category, subcategory || null, description.trim(), amount,
       entry_type, cost_month || null, transaction_date || null, notes || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cost entry not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[business-costs PUT]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── DELETE ───────────────────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM business_costs WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
