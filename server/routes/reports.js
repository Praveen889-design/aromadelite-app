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
    const catAgg      = new Map(); // key: category name
    const prodAgg     = new Map(); // key: product name → stores category too
    const assocAgg    = new Map();
    const cityAgg     = new Map();

    const upsert = (map, key, delta, extra = {}) => {
      const cur = map.get(key) || { revenue: 0, cogs: 0, ...extra };
      cur.revenue += delta.revenue;
      cur.cogs    += delta.cogs;
      Object.assign(cur, extra); // keep latest meta
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
        upsert(prodAgg,  pname, delta, { category: cat });
        upsert(assocAgg, assoc, delta);
        upsert(cityAgg,  city,  delta);
      }
    }

    const fmt = (map, includeCategory = false) =>
      [...map.entries()]
        .map(([name, v]) => ({
          name,
          ...(includeCategory ? { category: v.category || '' } : {}),
          revenue: +v.revenue.toFixed(2),
          cogs:    +v.cogs.toFixed(2),
          profit:  +(v.revenue - v.cogs).toFixed(2),
          margin:  v.revenue > 0 ? +(((v.revenue - v.cogs) / v.revenue) * 100).toFixed(1) : 0,
        }))
        .sort((a, b) => b.profit - a.profit);

    res.json({
      by_category:  fmt(catAgg),
      by_product:   fmt(prodAgg, true),
      by_associate: fmt(assocAgg),
      by_city:      fmt(cityAgg),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/price-deviation?period=all|month|quarter|year&from=&to=
router.get('/price-deviation', async (req, res) => {
  try {
    const { period, from, to } = req.query;

    const vals = [];
    const $v   = (v) => { vals.push(v); return `$${vals.length}`; };
    const where = [];
    if (from)   where.push(`q.created_at::date >= ${$v(from)}::date`);
    if (to)     where.push(`q.created_at::date <= ${$v(to)}::date`);
    if (!from && !to && period && period !== 'all') {
      const trunc = { month: 'month', quarter: 'quarter', year: 'year' }[period];
      if (trunc) where.push(`q.created_at >= DATE_TRUNC('${trunc}', CURRENT_DATE)`);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Fetch quotes with items + associate info
    const qRes = await pool.query(`
      SELECT q.id, q.quote_number, q.status, q.created_at,
             q.client_name, q.client_business_name, q.client_type, q.client_city,
             q.total_amount, q.items,
             e.name       AS employee_name,
             e.employee_id AS employee_code,
             e.region
      FROM quotes q
      JOIN employees e ON e.id = q.employee_id
      ${whereSql}
      ORDER BY q.created_at DESC
    `, vals);

    // Collect all product ids for catalog-price fallback
    const pidSet = new Set();
    const parsed = qRes.rows.map((row) => {
      let items = [];
      try { items = JSON.parse(row.items) || []; } catch {/* */}
      if (!Array.isArray(items)) items = [];
      for (const it of items) if (it.product_id) pidSet.add(it.product_id);
      return { ...row, items };
    });

    // Fetch base_price from products (fallback when system_price not in item)
    let productPriceMap = {};
    if (pidSet.size) {
      const ids = [...pidSet];
      const ph  = ids.map((_, i) => `$${vals.length + i + 1}`).join(',');
      const pRes = await pool.query(
        `SELECT id, name AS product_name, base_price, category_id,
                (SELECT name FROM product_categories c WHERE c.id = p.category_id) AS category_name
         FROM products p WHERE p.id IN (${ph})`,
        [...vals, ...ids]
      );
      productPriceMap = Object.fromEntries(pRes.rows.map((r) => [r.id, r]));
    }

    // Aggregation accumulators
    const assocMap  = new Map();
    const prodMap   = new Map();
    const typeMap   = new Map();
    const quoteRows = [];

    let totalCatalog = 0, totalQuoted = 0, totalDiscount = 0;
    let discountedItems = 0, aboveCatalogItems = 0;

    for (const q of parsed) {
      let qCatalog = 0, qQuoted = 0, qDiscount = 0, qAbove = 0;
      const itemDetails = [];

      for (const it of q.items) {
        const qty    = Number(it.quantity)   || 0;
        if (!qty) continue;
        const quoted = Number(it.unit_price) || 0;
        const prod   = productPriceMap[it.product_id] || {};
        // system_price stored in item JSON > product base_price > quoted (0 deviation)
        const catalog = Number(it.system_price) > 0
          ? Number(it.system_price)
          : (Number(prod.base_price) > 0 ? Number(prod.base_price) : quoted);

        const lineQuoted  = qty * quoted;
        const lineCatalog = qty * catalog;
        const lineDiff    = lineCatalog - lineQuoted;   // positive = discount, negative = above catalog
        const diffPct     = catalog > 0 ? (lineDiff / lineCatalog) * 100 : 0;

        qQuoted   += lineQuoted;
        qCatalog  += lineCatalog;
        qDiscount += lineDiff;
        if (lineDiff > 0) { discountedItems++; qAbove += 0; }
        else if (lineDiff < 0) { aboveCatalogItems++; }

        const pName = prod.product_name || it.product_name || `#${it.product_id || '?'}`;
        const pCat  = prod.category_name || 'Uncategorized';

        // By product
        const pk = pName;
        const pc = prodMap.get(pk) || { name: pName, category: pCat, catalog: 0, quoted: 0, discount: 0, items: 0 };
        pc.catalog  += lineCatalog;
        pc.quoted   += lineQuoted;
        pc.discount += lineDiff;
        pc.items    += qty;
        prodMap.set(pk, pc);

        itemDetails.push({ name: pName, category: pCat, qty, catalog, quoted, discount_pct: +diffPct.toFixed(1) });
      }

      totalCatalog  += qCatalog;
      totalQuoted   += qQuoted;
      totalDiscount += qDiscount;

      // By associate
      const ak = q.employee_code;
      const ac = assocMap.get(ak) || {
        name: q.employee_name, code: q.employee_code, region: q.region,
        catalog: 0, quoted: 0, discount: 0, quotes: 0, discounted_quotes: 0,
      };
      ac.catalog  += qCatalog;
      ac.quoted   += qQuoted;
      ac.discount += qDiscount;
      ac.quotes   += 1;
      if (qDiscount > 0.01) ac.discounted_quotes += 1;
      assocMap.set(ak, ac);

      // By client type
      const tk = (q.client_type || 'Other').toLowerCase();
      const tc = typeMap.get(tk) || { type: q.client_type || 'Other', catalog: 0, quoted: 0, discount: 0, quotes: 0 };
      tc.catalog  += qCatalog;
      tc.quoted   += qQuoted;
      tc.discount += qDiscount;
      tc.quotes   += 1;
      typeMap.set(tk, tc);

      // Quote-level row (only include quotes that have some deviation)
      if (Math.abs(qDiscount) > 0.01) {
        const discPct = qCatalog > 0 ? (qDiscount / qCatalog) * 100 : 0;
        quoteRows.push({
          id: q.id,
          quote_number: q.quote_number,
          status: q.status,
          created_at: q.created_at,
          client: q.client_business_name || q.client_name,
          client_type: q.client_type,
          client_city: q.client_city,
          employee_name: q.employee_name,
          employee_code: q.employee_code,
          catalog_value:  +qCatalog.toFixed(2),
          quoted_value:   +qQuoted.toFixed(2),
          discount_amount: +qDiscount.toFixed(2),
          discount_pct:   +discPct.toFixed(1),
          items: itemDetails,
        });
      }
    }

    const fmt = (v) => +Number(v).toFixed(2);
    const pct = (d, c) => c > 0 ? +(( d / c) * 100).toFixed(1) : 0;

    const fmtAssoc = [...assocMap.values()]
      .map((a) => ({
        ...a,
        catalog:  fmt(a.catalog),  quoted:  fmt(a.quoted),
        discount: fmt(a.discount), discount_pct: pct(a.discount, a.catalog),
      }))
      .sort((a, b) => b.discount - a.discount);

    const fmtProd = [...prodMap.values()]
      .map((p) => ({
        ...p,
        catalog:  fmt(p.catalog),  quoted:  fmt(p.quoted),
        discount: fmt(p.discount), discount_pct: pct(p.discount, p.catalog),
      }))
      .sort((a, b) => b.discount - a.discount);

    const fmtType = [...typeMap.values()]
      .map((t) => ({
        ...t,
        catalog:  fmt(t.catalog),  quoted:  fmt(t.quoted),
        discount: fmt(t.discount), discount_pct: pct(t.discount, t.catalog),
      }))
      .sort((a, b) => b.discount - a.discount);

    const avgDiscPct = totalCatalog > 0
      ? +((totalDiscount / totalCatalog) * 100).toFixed(1) : 0;

    res.json({
      period: period || 'all',
      summary: {
        total_quotes:      qRes.rows.length,
        quotes_with_deviation: quoteRows.length,
        total_catalog:     fmt(totalCatalog),
        total_quoted:      fmt(totalQuoted),
        total_discount:    fmt(totalDiscount),
        avg_discount_pct:  avgDiscPct,
        discounted_items:  discountedItems,
        above_catalog_items: aboveCatalogItems,
      },
      by_associate: fmtAssoc,
      by_product:   fmtProd,
      by_client_type: fmtType,
      quote_details: quoteRows,
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
