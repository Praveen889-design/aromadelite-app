/**
 * Aromadelite — full DB initialization & seed.
 * Drops and rebuilds all tables, then seeds employees, categories, and products.
 *
 * Usage:  node database/seed.js
 *         (also exposed as `npm run seed` in package.json)
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./db');

// ---------- Rebuild schema ----------
db.exec(`
  DROP TABLE IF EXISTS leads;
  DROP TABLE IF EXISTS quotes;
  DROP TABLE IF EXISTS quote_items;
  DROP TABLE IF EXISTS products;
  DROP TABLE IF EXISTS product_categories;
  DROP TABLE IF EXISTS employees;
  DROP TABLE IF EXISTS users;
`);

const schema = fs.readFileSync(path.resolve(__dirname, '../../database/schema.sql'), 'utf8');
db.exec(schema);
console.log('Schema rebuilt.');

// ---------- Seed employees ----------
const insertEmployee = db.prepare(`
  INSERT INTO employees (employee_id, name, email, phone, password_hash, role, region, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1)
`);

const employees = [
  {
    employee_id: 'ARO-ADMIN', name: 'Praveen (Owner)',
    email: 'praveen@aromadelite.com', phone: '+91-0000000000',
    password: 'Admin@123', role: 'admin', region: null,
  },
  {
    employee_id: 'ARO-001', name: 'Ravi Kumar',
    email: 'ravi@aromadelite.com', phone: '+91-9000000001',
    password: 'Assoc@123', role: 'associate', region: 'Hyderabad',
  },
  {
    employee_id: 'ARO-002', name: 'Priya Sharma',
    email: 'priya@aromadelite.com', phone: '+91-9000000002',
    password: 'Assoc@123', role: 'associate', region: 'Vijayawada',
  },
];

for (const e of employees) {
  insertEmployee.run(
    e.employee_id, e.name, e.email, e.phone,
    bcrypt.hashSync(e.password, 10), e.role, e.region
  );
}
console.log(`Seeded ${employees.length} employees.`);

// ---------- Seed categories ----------
const insertCategory = db.prepare(`
  INSERT INTO product_categories (name, description, icon_emoji, sort_order)
  VALUES (?, ?, ?, ?)
`);

const categories = [
  { name: 'Chemical Cleaners', description: 'Liquid cleaners, disinfectants & degreasers', icon: '🧪', order: 1 },
  { name: 'Consumables',       description: 'Disposables, tissues, bags & gloves',         icon: '📦', order: 2 },
  { name: 'Cleaning Tools',    description: 'Mops, brushes, buckets & wipers',             icon: '🧹', order: 3 },
];

const categoryIds = {};
for (const c of categories) {
  const info = insertCategory.run(c.name, c.description, c.icon, c.order);
  categoryIds[c.name] = info.lastInsertRowid;
}
console.log(`Seeded ${categories.length} categories.`);

// ---------- Helpers ----------
const J = (v) => JSON.stringify(v);
const sz = (size, price) => ({ size, price });

// Pull bulk_price_* directly from pack_sizes when present.
const bulk = (packSizes) => {
  const find = (re) => {
    const m = packSizes.find((p) => re.test(p.size));
    return m ? m.price : null;
  };
  return {
    bulk_price_5L:   find(/^\s*5L\b/i),
    bulk_price_20L:  find(/^\s*20L\b/i),
    bulk_price_200L: find(/^\s*200L\b/i),
  };
};

const insertProduct = db.prepare(`
  INSERT INTO products
    (category_id, name, description, variants, pack_sizes, unit,
     base_price, bulk_price_5L, bulk_price_20L, bulk_price_200L,
     gst_percent, hsn_code, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);

const addProduct = (catName, p) => {
  const b = bulk(p.pack_sizes);
  insertProduct.run(
    categoryIds[catName],
    p.name,
    p.description || null,
    J(p.variants),
    J(p.pack_sizes),
    p.unit || null,
    p.base_price,
    b.bulk_price_5L,
    b.bulk_price_20L,
    b.bulk_price_200L,
    p.gst_percent,
    p.hsn_code || null
  );
};

// ---------- Chemical Cleaners ----------
const chemicalCleaners = [
  {
    name: 'Floor Cleaner',
    variants: ['Multi-surface', 'Disinfectant', 'Fragrance'],
    pack_sizes: [sz('1L', 35), sz('5L', 160), sz('20L', 580), sz('200L', 5200)],
    unit: 'L', base_price: 35, gst_percent: 18, hsn_code: '3402',
  },
  {
    name: 'Toilet Cleaner',
    variants: ['Acid-based', 'Mild', 'Gel'],
    pack_sizes: [sz('500ml', 22), sz('1L', 40), sz('5L', 175), sz('20L', 620)],
    unit: 'L', base_price: 40, gst_percent: 18, hsn_code: '3402',
  },
  {
    name: 'Phenyl Black',
    variants: ['Standard', 'Concentrated'],
    pack_sizes: [sz('1L', 30), sz('5L', 130), sz('20L', 480), sz('200L', 4400)],
    unit: 'L', base_price: 30, gst_percent: 18, hsn_code: '3808',
  },
  {
    name: 'Phenyl White',
    variants: ['Standard', 'Concentrated'],
    pack_sizes: [sz('1L', 35), sz('5L', 150), sz('20L', 530)],
    unit: 'L', base_price: 35, gst_percent: 18, hsn_code: '3808',
  },
  {
    name: 'Disinfectant / Sanitizer',
    variants: ['Surface', 'Floor', 'Hand'],
    pack_sizes: [sz('500ml', 45), sz('1L', 80), sz('5L', 360), sz('20L', 1300)],
    unit: 'L', base_price: 80, gst_percent: 18, hsn_code: '3808',
  },
  {
    name: 'Dish Wash Liquid',
    variants: ['Commercial', 'Lemon', 'Degreaser'],
    pack_sizes: [sz('1L', 38), sz('5L', 170), sz('20L', 620)],
    unit: 'L', base_price: 38, gst_percent: 18, hsn_code: '3402',
  },
  {
    name: 'Dish Wash Bar',
    variants: ['Standard', 'Heavy-duty'],
    pack_sizes: [sz('100g', 8), sz('200g', 15), sz('500g bulk', 32)],
    unit: 'g', base_price: 8, gst_percent: 18, hsn_code: '3402',
  },
  {
    name: 'Glass & Surface Cleaner',
    variants: ['Spray', 'Concentrate'],
    pack_sizes: [sz('500ml', 55), sz('1L', 95), sz('5L', 420)],
    unit: 'L', base_price: 95, gst_percent: 18, hsn_code: '3402',
  },
  {
    name: 'Bathroom & Tile Cleaner',
    variants: ['Acid', 'Neutral'],
    pack_sizes: [sz('1L', 42), sz('5L', 185), sz('20L', 670)],
    unit: 'L', base_price: 42, gst_percent: 18, hsn_code: '3402',
  },
  {
    name: 'Kitchen Degreaser',
    variants: ['Heavy-duty', 'Spray'],
    pack_sizes: [sz('500ml', 65), sz('1L', 115), sz('5L', 480)],
    unit: 'L', base_price: 115, gst_percent: 18, hsn_code: '3402',
  },
  {
    name: 'Urinal Cube / Blocks',
    variants: ['Pine', 'Lavender'],
    pack_sizes: [sz('50g', 12), sz('100g', 22), sz('Box/50pc', 180)],
    unit: 'pc', base_price: 12, gst_percent: 18, hsn_code: '3307',
  },
];

// ---------- Consumables ----------
const consumables = [
  {
    name: 'Garbage Bags Small 30L',
    variants: ['Black', 'Blue', 'Biodegradable'],
    pack_sizes: [sz('Roll/25', 45), sz('Box/100', 165), sz('Bale/500', 780)],
    unit: 'pc', base_price: 45, gst_percent: 12, hsn_code: '3923',
  },
  {
    name: 'Garbage Bags Medium 60L',
    variants: ['Black', 'Blue', 'Biodegradable'],
    pack_sizes: [sz('Roll/25', 65), sz('Box/100', 240), sz('Bale/500', 1100)],
    unit: 'pc', base_price: 65, gst_percent: 12, hsn_code: '3923',
  },
  {
    name: 'Garbage Bags Large 120L',
    variants: ['Black', 'Green', 'Biodegradable'],
    pack_sizes: [sz('Roll/25', 95), sz('Box/100', 360), sz('Bale/500', 1650)],
    unit: 'pc', base_price: 95, gst_percent: 12, hsn_code: '3923',
  },
  {
    name: 'Toilet Paper Rolls',
    variants: ['Standard', 'Soft'],
    pack_sizes: [sz('Single', 18), sz('Pack/6', 95), sz('Carton/48', 680)],
    unit: 'roll', base_price: 18, gst_percent: 12, hsn_code: '4818',
  },
  {
    name: 'Kitchen Tissue Rolls',
    variants: ['Standard', '2-ply'],
    pack_sizes: [sz('Single', 22), sz('Pack/6', 115), sz('Carton/24', 420)],
    unit: 'roll', base_price: 22, gst_percent: 12, hsn_code: '4818',
  },
  {
    name: 'Hand Towel Rolls Jumbo',
    variants: ['Standard', 'Soft'],
    pack_sizes: [sz('Single', 85), sz('Carton/6', 480)],
    unit: 'roll', base_price: 85, gst_percent: 12, hsn_code: '4818',
  },
  {
    name: 'Facial Tissue / Napkins',
    variants: ['2-ply', 'Table Napkins'],
    pack_sizes: [sz('Box/100', 45), sz('Box/200', 82), sz('Carton/30 boxes', 1100)],
    unit: 'pc', base_price: 45, gst_percent: 12, hsn_code: '4818',
  },
  {
    name: 'Rubber Gloves',
    variants: ['Medium', 'Large', 'XL'],
    pack_sizes: [sz('Pair', 35), sz('Box/50 pairs', 1500), sz('Box/100 pairs', 2800)],
    unit: 'pair', base_price: 35, gst_percent: 12, hsn_code: '4015',
  },
  {
    name: 'Disposable Nitrile Gloves',
    variants: ['Medical', 'Food-grade'],
    pack_sizes: [sz('Box/100', 280), sz('Carton/10 boxes', 2500)],
    unit: 'pc', base_price: 280, gst_percent: 12, hsn_code: '4015',
  },
  {
    name: 'Scrubbing Pads',
    variants: ['Green Scrub', 'Steel Wire', 'Non-scratch'],
    pack_sizes: [sz('Single', 12), sz('Pack/10', 95), sz('Bulk/100', 850)],
    unit: 'pc', base_price: 12, gst_percent: 12, hsn_code: '7323',
  },
];

// ---------- Cleaning Tools ----------
const cleaningTools = [
  {
    name: 'String Mop',
    variants: ['Standard', 'Heavy-duty'],
    pack_sizes: [sz('Single', 120), sz('Pack/5', 550)],
    unit: 'pc', base_price: 120, gst_percent: 18, hsn_code: '9603',
  },
  {
    name: 'Flat Mop with Frame',
    variants: ['Standard', 'Microfiber'],
    pack_sizes: [sz('Single', 220), sz('Pack/5', 980)],
    unit: 'pc', base_price: 220, gst_percent: 18, hsn_code: '9603',
  },
  {
    name: 'Spin Mop Set',
    variants: ['Standard'],
    pack_sizes: [sz('Single', 380)],
    unit: 'set', base_price: 380, gst_percent: 18, hsn_code: '9603',
  },
  {
    name: 'Floor Wiper / Squeegee',
    variants: ['Standard', 'Long-handle'],
    pack_sizes: [sz('Single', 85), sz('Pack/5', 380)],
    unit: 'pc', base_price: 85, gst_percent: 18, hsn_code: '9603',
  },
  {
    name: 'Window Squeegee',
    variants: ['Standard'],
    pack_sizes: [sz('Single', 65), sz('Pack/5', 285)],
    unit: 'pc', base_price: 65, gst_percent: 18, hsn_code: '9603',
  },
  {
    name: 'Indoor Broom',
    variants: ['Soft', 'Hard-bristle'],
    pack_sizes: [sz('Single', 65), sz('Pack/5', 290)],
    unit: 'pc', base_price: 65, gst_percent: 18, hsn_code: '9603',
  },
  {
    name: 'Toilet Brush Set',
    variants: ['Standard', 'Premium'],
    pack_sizes: [sz('Single', 55), sz('Pack/5', 240)],
    unit: 'set', base_price: 55, gst_percent: 18, hsn_code: '9603',
  },
  {
    name: 'Hard Bristle Scrub Brush',
    variants: ['Standard'],
    pack_sizes: [sz('Single', 45), sz('Pack/10', 380)],
    unit: 'pc', base_price: 45, gst_percent: 18, hsn_code: '9603',
  },
  {
    name: 'Mop Bucket Single',
    variants: ['Standard'],
    pack_sizes: [sz('Single', 280)],
    unit: 'pc', base_price: 280, gst_percent: 18, hsn_code: '3924',
  },
  {
    name: 'Mop Bucket Double Wringer',
    variants: ['Standard'],
    pack_sizes: [sz('Single', 480)],
    unit: 'pc', base_price: 480, gst_percent: 18, hsn_code: '3924',
  },
  {
    name: 'Microfiber Cloth Set',
    variants: ['Kitchen', 'Glass', 'Multi-purpose'],
    pack_sizes: [sz('Pack/3', 95), sz('Pack/12', 340), sz('Carton/60', 1550)],
    unit: 'pc', base_price: 95, gst_percent: 18, hsn_code: '6307',
  },
];

const seedAll = db.transaction(() => {
  chemicalCleaners.forEach((p) => addProduct('Chemical Cleaners', p));
  consumables.forEach((p) => addProduct('Consumables', p));
  cleaningTools.forEach((p) => addProduct('Cleaning Tools', p));
});
seedAll();

const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
console.log(`Seeded ${productCount} products across ${categories.length} categories.`);

console.log('\n=== Seed complete ===');
console.log('Login credentials:');
console.log('  Admin:        ARO-ADMIN / Admin@123');
console.log('  Associate 1:  ARO-001   / Assoc@123  (Hyderabad)');
console.log('  Associate 2:  ARO-002   / Assoc@123  (Vijayawada)');
