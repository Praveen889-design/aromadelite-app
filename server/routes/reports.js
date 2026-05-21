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

// P&L breakdown — converted leads only
router.get('/pnl', async (req, res) => {
  try {
    const { from, to } = req.query;
    const vals = [];
    const $v = (v) => { vals.push(v); return `$${vals.length}`; };
    const where = [`l.status = 'converted'`, `l.quote_id IS NOT NULL`];
    if (from) where.push(`l.created_at::date >= ${$v(from)}::date`);
    if (to)   where.push(`l.created_at::date <= ${$v(to)}::date`);
    const whereSql = 'WHERE ' + where.join(' AND ');

    // Fetch converted leads with quote items + associate + city
    const leadsRes = await pool.query(`
      SELECT l.id, e.name AS associate_name,
             q.client_city, q.items
      FROM leads l
      JOIN employees e ON e.id = l.employee_id
      JOIN quotes q ON q.id = l.quote_id
      ${whereSql}
    `, vals);

    if (!leadsRes.rows.length) {
      return res.json({ by_category: [], by_product: [], by_associate: [], by_city: [] });
    }

    // Collect all product ids
    const productIdSet = new Set();
    const parsedLeads = leadsRes.rows.map((row) => {
      let items = [];
      try { items = JSON.parse(row.items) || []; } catch {/* */}
      if (Array.isArray(items)) {
        for (const it of items) if (it.product_id) productIdSet.add(it.product_id);
      }
      return { ...row, items: Array.isArray(items) ? items : [] };
    });

    // Fetch product details: name, category, manufacturing_cost
    let productMap = {};
    if (productIdSet.size) {
      const ids = [...productIdSet];
      const ph = ids.map((_, i) => `$${vals.length + i + 1}`).join(',');
      const prodRes = await pool.query(`
        SELECT p.id, p.name AS product_name, p.manufacturing_cost,
               c.name AS category_name
        FROM products p JOIN product_categories c ON c.id = p.category_id
        WHERE p.id IN (${ph})
      `, [...vals, ...ids]);
      productMap = Object.fromEntries(prodRes.rows.map((r) => [r.id, r]));
    }

    // Aggregate P&L
    const catAgg      = new Map();
    const prodAgg     = new Map();
    const assocAgg    = new Map();
    const cityAgg     = new Map();

    const upsert = (map, key, delta) => {
      const cur = map.get(key) || { revenue: 0, cogs: 0 };
      cur.revenue += delta.revenue;
      cur.cogs    += delta.cogs;
      map.set(key, cur);
    };

    for (const lead of parsedLeads) {
      for (const it of lead.items) {
        const qty   = Number(it.quantity) || 0;
        const price = Number(it.unit_price) || 0;
        const prod  = productMap[it.product_id] || {};
        const mfg   = Number(prod.manufacturing_cost) || 0;
        const delta = { revenue: qty * price, cogs: qty * mfg };

        const cat   = prod.category_name || 'Uncategorized';
        const pname = prod.product_name || it.product_name || `Product #${it.product_id}`;
        const city  = lead.client_city || 'Unknown';
        const assoc = lead.associate_name || 'Unknown';

        upsert(catAgg,   cat,   delta);
        upsert(prodAgg,  pname, delta);
        upsert(assocAgg, assoc, delta);
        upsert(cityAgg,  city,  delta);
      }
    }

    const fmt = (map) =>
      [...map.entries()]
        .map(([name, v]) => ({
          name,
          revenue: +v.revenue.toFixed(2),
          cogs:    +v.cogs.toFixed(2),
          profit:  +(v.revenue - v.cogs).toFixed(2),
          margin:  v.revenue > 0 ? +(((v.revenue - v.cogs) / v.revenue) * 100).toFixed(1) : 0,
        }))
        .sort((a, b) => b.profit - a.profit);

    res.json({
      by_category:  fmt(catAgg),
      by_product:   fmt(prodAgg),
      by_associate: fmt(assocAgg),
      by_city:      fmt(cityAgg),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/top-clients?limit=10&period=all|month|quarter|year
router.get('/top-clients', async (req, res) => {
  try {
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const period = req.query.period || 'all';

    const periodWhere = {
      all:     '',
      month:   "AND q.created_at >= DATE_TRUNC('month',  CURRENT_DATE)",
      quarter: "AND q.created_at >= DATE_TRUNC('quarter', CURRENT_DATE)",
      year:    "AND q.created_at >= DATE_TRUNC('year',   CURRENT_DATE)",
    }[period] || '';

    // Top clients by total quoted revenue
    const { rows } = await pool.query(`
      SELECT
        COALESCE(NULLIF(TRIM(q.client_business_name), ''), q.client_name) AS client,
        q.client_name,
        q.client_business_name,
        q.client_type,
        q.client_city,
        COUNT(*)::int                                                         AS quote_count,
        COUNT(CASE WHEN q.status = 'accepted' THEN 1 END)::int               AS accepted_count,
        COALESCE(SUM(q.total_amount), 0)                                      AS total_revenue,
        COALESCE(SUM(CASE WHEN q.status = 'accepted' THEN q.total_amount ELSE 0 END), 0)
                                                                              AS accepted_revenue,
        MAX(q.created_at)                                                     AS last_quote_at,
        -- most active associate for this client
        MODE() WITHIN GROUP (ORDER BY e.name)                                 AS top_associate
      FROM quotes q
      JOIN employees e ON e.id = q.employee_id
      WHERE 1=1 ${periodWhere}
      GROUP BY
        COALESCE(NULLIF(TRIM(q.client_business_name), ''), q.client_name),
        q.client_name, q.client_business_name, q.client_type, q.client_city
      ORDER BY total_revenue DESC
      LIMIT $1
    `, [limit]);

    const clients = rows.map((r, i) => ({
      rank:             i + 1,
      client:           r.client,
      client_name:      r.client_name,
      client_type:      r.client_type,
      client_city:      r.client_city,
      quote_count:      Number(r.quote_count),
      accepted_count:   Number(r.accepted_count),
      total_revenue:    +Number(r.total_revenue).toFixed(2),
      accepted_revenue: +Number(r.accepted_revenue).toFixed(2),
      win_rate:         r.quote_count > 0
        ? +(( r.accepted_count / r.quote_count) * 100).toFixed(1)
        : 0,
      last_quote_at:    r.last_quote_at,
      top_associate:    r.top_associate,
    }));

    res.json({ period, clients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
