const express = require('express');
const pool = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const parseJSON = (s, fallback = null) => {
  if (s == null) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
};

const hydrate = (p, includeAdminFields = false) => {
  const out = {
    ...p,
    variants: parseJSON(p.variants, []),
    pack_sizes: parseJSON(p.pack_sizes, []),
    is_active: !!p.is_active,
  };
  if (!includeAdminFields) delete out.manufacturing_cost;
  return out;
};

router.get('/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.description, c.icon_emoji, c.sort_order,
             COUNT(p.id) AS product_count
      FROM product_categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
      GROUP BY c.id
      ORDER BY c.sort_order
    `);
    res.json({ categories: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.name AS category_name, c.icon_emoji AS category_icon
      FROM products p
      JOIN product_categories c ON c.id = p.category_id
      WHERE p.is_active = 1
      ORDER BY c.sort_order, p.name
    `);
    res.json({ products: rows.map(hydrate) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/category/:categoryId', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.name AS category_name, c.icon_emoji AS category_icon
      FROM products p
      JOIN product_categories c ON c.id = p.category_id
      WHERE p.category_id = $1 AND p.is_active = 1
      ORDER BY p.name
    `, [req.params.categoryId]);
    res.json({ products: rows.map(hydrate) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — list all products (active + inactive) — must come before /:id
router.get('/admin/all', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.name AS category_name, c.icon_emoji AS category_icon
      FROM products p JOIN product_categories c ON c.id = p.category_id
      ORDER BY c.sort_order, p.name
    `);
    res.json({ products: rows.map((r) => hydrate(r, true)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — bulk upload products via CSV data
router.post('/bulk-upload', requireRole('admin'), async (req, res) => {
  try {
    const { rows: csvRows } = req.body || {};
    if (!Array.isArray(csvRows) || !csvRows.length)
      return res.status(400).json({ error: 'No rows provided' });

    const catRes = await pool.query('SELECT id, name FROM product_categories');
    const catMap = Object.fromEntries(catRes.rows.map((c) => [c.name.toLowerCase(), c.id]));

    const results = { created: 0, skipped: 0, errors: [] };

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const catId = catMap[(row.category_name || '').toLowerCase()];
      if (!catId) { results.errors.push(`Row ${i + 2}: unknown category "${row.category_name}"`); results.skipped++; continue; }
      if (!row.name) { results.errors.push(`Row ${i + 2}: name is required`); results.skipped++; continue; }
      const gst = Number(row.gst_percent);
      if (![0, 3, 5, 12, 18, 28].includes(gst)) { results.errors.push(`Row ${i + 2}: gst_percent must be 0, 3, 5, 12, 18, or 28`); results.skipped++; continue; }

      const variants = row.variants ? row.variants.split('|').map((s) => s.trim()).filter(Boolean) : [];
      const packSizes = row.pack_sizes ? row.pack_sizes.split('|').map((s) => {
        const [size, price] = s.split('=').map((x) => x.trim());
        return { size, price: Number(price) || 0 };
      }) : [];
      const find5L   = packSizes.find((p) => /^\s*5L\b/i.test(p.size))?.price ?? null;
      const find20L  = packSizes.find((p) => /^\s*20L\b/i.test(p.size))?.price ?? null;
      const find200L = packSizes.find((p) => /^\s*200L\b/i.test(p.size))?.price ?? null;

      await pool.query(`
        INSERT INTO products
          (category_id, name, description, variants, pack_sizes, unit,
           base_price, bulk_price_5L, bulk_price_20L, bulk_price_200L,
           gst_percent, hsn_code, manufacturing_cost, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT DO NOTHING
      `, [
        catId, row.name.trim(), row.description || null,
        JSON.stringify(variants), JSON.stringify(packSizes), row.unit || null,
        Number(row.base_price) || 0, find5L, find20L, find200L,
        gst, row.hsn_code || null,
        Number(row.manufacturing_cost) || 0,
        row.is_active === 'false' || row.is_active === '0' ? 0 : 1,
      ]);
      results.created++;
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.name AS category_name, c.icon_emoji AS category_icon
      FROM products p
      JOIN product_categories c ON c.id = p.category_id
      WHERE p.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: hydrate(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.category_id || ![0, 3, 5, 12, 18, 28].includes(Number(b.gst_percent))) {
      return res.status(400).json({ error: 'name, category_id, and gst_percent (0, 3, 5, 12, 18, or 28) are required' });
    }
    const variants = Array.isArray(b.variants) ? b.variants : [];
    const pack_sizes = Array.isArray(b.pack_sizes) ? b.pack_sizes : [];
    const find = (re) => pack_sizes.find((p) => re.test(p.size))?.price ?? null;

    const { rows } = await pool.query(`
      INSERT INTO products
        (category_id, name, description, variants, pack_sizes, unit,
         base_price, bulk_price_5L, bulk_price_20L, bulk_price_200L,
         gst_percent, hsn_code, manufacturing_cost, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id
    `, [
      b.category_id, b.name, b.description || null,
      JSON.stringify(variants), JSON.stringify(pack_sizes), b.unit || null,
      Number(b.base_price) || 0, find(/^\s*5L\b/i), find(/^\s*20L\b/i), find(/^\s*200L\b/i),
      Number(b.gst_percent), b.hsn_code || null,
      Number(b.manufacturing_cost) || 0,
      b.is_active === false ? 0 : 1,
    ]);

    const created = await pool.query('SELECT * FROM products WHERE id = $1', [rows[0].id]);
    res.status(201).json({ product: hydrate(created.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Product not found' });

    const b = req.body || {};
    const vals = [];
    const $v = (v) => { vals.push(v); return `$${vals.length}`; };
    const setClauses = [];

    if (b.name !== undefined)         setClauses.push(`name = ${$v(b.name)}`);
    if (b.description !== undefined)  setClauses.push(`description = ${$v(b.description)}`);
    if (b.unit !== undefined)         setClauses.push(`unit = ${$v(b.unit)}`);
    if (b.base_price !== undefined)   setClauses.push(`base_price = ${$v(Number(b.base_price) || 0)}`);
    if (b.bulk_price_5L !== undefined)   setClauses.push(`bulk_price_5L = ${$v(Number(b.bulk_price_5L) || null)}`);
    if (b.bulk_price_20L !== undefined)  setClauses.push(`bulk_price_20L = ${$v(Number(b.bulk_price_20L) || null)}`);
    if (b.bulk_price_200L !== undefined) setClauses.push(`bulk_price_200L = ${$v(Number(b.bulk_price_200L) || null)}`);
    if (b.gst_percent !== undefined) {
      if (![0, 3, 5, 12, 18, 28].includes(Number(b.gst_percent))) return res.status(400).json({ error: 'gst_percent must be 0, 3, 5, 12, 18, or 28' });
      setClauses.push(`gst_percent = ${$v(Number(b.gst_percent))}`);
    }
    if (b.hsn_code !== undefined)           setClauses.push(`hsn_code = ${$v(b.hsn_code)}`);
    if (b.manufacturing_cost !== undefined) setClauses.push(`manufacturing_cost = ${$v(Number(b.manufacturing_cost) || 0)}`);
    if (b.is_active !== undefined) setClauses.push(`is_active = ${$v(b.is_active ? 1 : 0)}`);
    if (b.variants !== undefined)  setClauses.push(`variants = ${$v(JSON.stringify(Array.isArray(b.variants) ? b.variants : []))}`);
    if (b.pack_sizes !== undefined) {
      const ps = Array.isArray(b.pack_sizes) ? b.pack_sizes : [];
      setClauses.push(`pack_sizes = ${$v(JSON.stringify(ps))}`);
      if (b.bulk_price_5L === undefined)   setClauses.push(`bulk_price_5L = ${$v(ps.find((p) => /^\s*5L\b/i.test(p.size))?.price ?? null)}`);
      if (b.bulk_price_20L === undefined)  setClauses.push(`bulk_price_20L = ${$v(ps.find((p) => /^\s*20L\b/i.test(p.size))?.price ?? null)}`);
      if (b.bulk_price_200L === undefined) setClauses.push(`bulk_price_200L = ${$v(ps.find((p) => /^\s*200L\b/i.test(p.size))?.price ?? null)}`);
    }
    if (!setClauses.length) return res.status(400).json({ error: 'No updatable fields provided' });

    vals.push(req.params.id);
    await pool.query(`UPDATE products SET ${setClauses.join(', ')} WHERE id = $${vals.length}`, vals);

    const { rows } = await pool.query(`
      SELECT p.*, c.name AS category_name, c.icon_emoji AS category_icon
      FROM products p JOIN product_categories c ON c.id = p.category_id
      WHERE p.id = $1
    `, [req.params.id]);
    res.json({ product: hydrate(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
