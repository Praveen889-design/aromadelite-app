const express = require('express');
const pool = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    const vals = [];
    const $v = (v) => { vals.push(v); return `$${vals.length}`; };
    const where = [];
    if (from) where.push(`q.created_at::date >= ${$v(from)}::date`);
    if (to)   where.push(`q.created_at::date <= ${$v(to)}::date`);
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const totalsRes = await pool.query(`
      SELECT COUNT(*) AS quotes_count,
             COALESCE(SUM(subtotal), 0)     AS subtotal,
             COALESCE(SUM(gst_amount), 0)   AS gst_amount,
             COALESCE(SUM(total_amount), 0) AS total_amount
      FROM quotes q ${whereSql}
    `, vals);
    const totals = totalsRes.rows[0];

    const assocRes = await pool.query(`
      SELECT e.id, e.employee_id, e.name, e.region,
             COUNT(q.id) AS quotes_count,
             COALESCE(SUM(q.total_amount), 0) AS total_amount
      FROM employees e
      LEFT JOIN quotes q ON q.employee_id = e.id ${whereSql.replace('WHERE', 'AND')}
      GROUP BY e.id, e.employee_id, e.name, e.region
      ORDER BY total_amount DESC
    `, vals);

    const bizRes = await pool.query(`
      SELECT q.client_type,
             COUNT(q.id) AS quotes_count,
             COALESCE(SUM(q.total_amount), 0) AS total_amount
      FROM quotes q ${whereSql}
      GROUP BY q.client_type
      ORDER BY total_amount DESC
    `, vals);

    // Product category breakdown — aggregate in JS from items JSON
    const quotesRes = await pool.query(`SELECT items FROM quotes q ${whereSql}`, vals);
    const productIdSet = new Set();
    const parsed = quotesRes.rows.map((row) => {
      try {
        const items = JSON.parse(row.items);
        if (Array.isArray(items)) {
          for (const it of items) if (it.product_id) productIdSet.add(it.product_id);
          return items;
        }
      } catch {/* ignore */}
      return [];
    });

    let catMap = {};
    if (productIdSet.size) {
      const ids = [...productIdSet];
      const placeholders = ids.map((_, i) => `$${vals.length + i + 1}`).join(',');
      const catRes = await pool.query(`
        SELECT p.id, c.name AS category_name
        FROM products p JOIN product_categories c ON c.id = p.category_id
        WHERE p.id IN (${placeholders})
      `, [...vals, ...ids]);
      catMap = Object.fromEntries(catRes.rows.map((r) => [r.id, r.category_name]));
    }

    const byCategoryAgg = new Map();
    for (const items of parsed) {
      for (const it of items) {
        const cat = catMap[it.product_id] || 'Uncategorized';
        const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
        const cur = byCategoryAgg.get(cat) || { category_name: cat, units: 0, subtotal: 0, line_count: 0 };
        cur.units += Number(it.quantity) || 0;
        cur.subtotal += line;
        cur.line_count += 1;
        byCategoryAgg.set(cat, cur);
      }
    }
    const byCategory = [...byCategoryAgg.values()]
      .sort((a, b) => b.subtotal - a.subtotal)
      .map((c) => ({ ...c, subtotal: +c.subtotal.toFixed(2) }));

    res.json({
      range: { from: from || null, to: to || null },
      totals: {
        quotes_count: Number(totals.quotes_count),
        subtotal: +Number(totals.subtotal).toFixed(2),
        gst_amount: +Number(totals.gst_amount).toFixed(2),
        total_amount: +Number(totals.total_amount).toFixed(2),
      },
      by_associate: assocRes.rows.map((a) => ({ ...a, total_amount: +Number(a.total_amount).toFixed(2) })),
      by_business_type: bizRes.rows.map((b) => ({ ...b, total_amount: +Number(b.total_amount).toFixed(2) })),
      by_category: byCategory,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
