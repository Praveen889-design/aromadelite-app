const express = require('express');
const pool = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/stats', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const scopeWhere = isAdmin ? '' : 'AND employee_id = $1';
    const scopeParams = isAdmin ? [] : [req.user.id];

    const countQ = async (cond) => {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS c, COALESCE(SUM(total_amount), 0) AS v FROM quotes WHERE ${cond} ${scopeWhere}`,
        scopeParams
      );
      return rows[0];
    };

    const [today, yesterday, week, month] = await Promise.all([
      countQ("created_at::date = CURRENT_DATE"),
      countQ("created_at::date = CURRENT_DATE - INTERVAL '1 day'"),
      countQ("created_at::date >= CURRENT_DATE - INTERVAL '6 days'"),
      countQ("created_at::date >= DATE_TRUNC('month', CURRENT_DATE)"),
    ]);

    const leadRes = isAdmin
      ? await pool.query(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted,
            SUM(CASE WHEN status IN ('new','contacted','qualified') THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN follow_up_date IS NOT NULL
                      AND follow_up_date <= CURRENT_DATE
                      AND status NOT IN ('converted','lost') THEN 1 ELSE 0 END) AS follow_ups_today
          FROM leads
        `)
      : await pool.query(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted,
            SUM(CASE WHEN status IN ('new','contacted','qualified') THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN follow_up_date IS NOT NULL
                      AND follow_up_date <= CURRENT_DATE
                      AND status NOT IN ('converted','lost') THEN 1 ELSE 0 END) AS follow_ups_today
          FROM leads WHERE employee_id = $1
        `, [req.user.id]);
    const leadStats = leadRes.rows[0];
    const conversion_rate = leadStats.total
      ? +((leadStats.converted / leadStats.total) * 100).toFixed(2)
      : 0;

    // Top products (aggregate from JSON)
    const quotesRes = isAdmin
      ? await pool.query('SELECT items FROM quotes')
      : await pool.query('SELECT items FROM quotes WHERE employee_id = $1', [req.user.id]);

    const productAgg = new Map();
    for (const row of quotesRes.rows) {
      let items;
      try { items = JSON.parse(row.items); } catch { continue; }
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        const key = it.product_name || it.name || `#${it.product_id || 'unknown'}`;
        const qty = Number(it.quantity) || 0;
        const rev = qty * (Number(it.unit_price) || 0);
        const cur = productAgg.get(key) || { product: key, quantity: 0, revenue: 0, line_count: 0 };
        cur.quantity += qty;
        cur.revenue += rev;
        cur.line_count += 1;
        productAgg.set(key, cur);
      }
    }
    const top_products = [...productAgg.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({ ...p, revenue: +p.revenue.toFixed(2) }));

    // Associate performance
    const perfRes = isAdmin
      ? await pool.query(`
          SELECT e.id, e.employee_id, e.name, e.region,
                 COUNT(DISTINCT q.id) AS quotes_count,
                 COALESCE(SUM(q.total_amount), 0) AS quote_value,
                 COUNT(DISTINCT l.id) AS leads_count,
                 SUM(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END) AS conversions
          FROM employees e
          LEFT JOIN quotes q ON q.employee_id = e.id
          LEFT JOIN leads  l ON l.employee_id = e.id
          WHERE e.role = 'associate' AND e.is_active = 1
          GROUP BY e.id, e.employee_id, e.name, e.region
          ORDER BY quote_value DESC
        `)
      : await pool.query(`
          SELECT e.id, e.employee_id, e.name, e.region,
                 COUNT(DISTINCT q.id) AS quotes_count,
                 COALESCE(SUM(q.total_amount), 0) AS quote_value,
                 COUNT(DISTINCT l.id) AS leads_count,
                 SUM(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END) AS conversions
          FROM employees e
          LEFT JOIN quotes q ON q.employee_id = e.id
          LEFT JOIN leads  l ON l.employee_id = e.id
          WHERE e.id = $1
          GROUP BY e.id, e.employee_id, e.name, e.region
        `, [req.user.id]);

    // Leads by client type
    const clientTypeRes = isAdmin
      ? await pool.query('SELECT client_type, COUNT(*) AS count FROM leads GROUP BY client_type')
      : await pool.query('SELECT client_type, COUNT(*) AS count FROM leads WHERE employee_id = $1 GROUP BY client_type', [req.user.id]);
    const leads_by_client_type = clientTypeRes.rows.reduce((acc, r) => {
      acc[r.client_type || 'other'] = Number(r.count);
      return acc;
    }, {});

    // Pipeline funnel — count + estimated value per status
    const pipelineRes = isAdmin
      ? await pool.query(`
          SELECT status,
                 COUNT(*) AS count,
                 COALESCE(SUM(estimated_monthly_value), 0) AS value
          FROM leads GROUP BY status
        `)
      : await pool.query(`
          SELECT status,
                 COUNT(*) AS count,
                 COALESCE(SUM(estimated_monthly_value), 0) AS value
          FROM leads WHERE employee_id = $1 GROUP BY status
        `, [req.user.id]);
    const PIPELINE_STAGES = ['new', 'contacted', 'qualified', 'converted', 'lost'];
    const pipeline_stages = PIPELINE_STAGES.reduce((acc, s) => {
      acc[s] = { count: 0, value: 0 };
      return acc;
    }, {});
    for (const r of pipelineRes.rows) {
      const key = r.status || 'new';
      if (pipeline_stages[key]) {
        pipeline_stages[key] = { count: Number(r.count), value: +Number(r.value).toFixed(2) };
      }
    }

    // Recent activity
    const activityRes = isAdmin
      ? await pool.query(`
          SELECT q.id, q.quote_number, q.status, q.total_amount, q.created_at,
                 e.name AS employee_name, q.client_name
          FROM quotes q
          JOIN employees e ON e.id = q.employee_id
          ORDER BY q.created_at DESC LIMIT 8
        `)
      : await pool.query(`
          SELECT q.id, q.quote_number, q.status, q.total_amount, q.created_at,
                 e.name AS employee_name, q.client_name
          FROM quotes q
          JOIN employees e ON e.id = q.employee_id
          WHERE q.employee_id = $1
          ORDER BY q.created_at DESC LIMIT 8
        `, [req.user.id]);

    res.json({
      stats: {
        quotes: {
          today:     { count: Number(today.c),     value: +Number(today.v).toFixed(2)     },
          yesterday: { count: Number(yesterday.c), value: +Number(yesterday.v).toFixed(2) },
          week:      { count: Number(week.c),      value: +Number(week.v).toFixed(2)      },
          month:     { count: Number(month.c),     value: +Number(month.v).toFixed(2)     },
        },
        leads: {
          total: Number(leadStats.total) || 0,
          active: Number(leadStats.active) || 0,
          converted: Number(leadStats.converted) || 0,
          follow_ups_today: Number(leadStats.follow_ups_today) || 0,
          conversion_rate,
        },
        top_products,
        associate_performance: perfRes.rows,
        leads_by_client_type,
        pipeline_stages,
        recent_activity: activityRes.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
