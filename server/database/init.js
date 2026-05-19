const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./db');

const schema = fs.readFileSync(path.resolve(__dirname, '../../database/schema.sql'), 'utf8');
db.exec(schema);

const seedUser = (name, email, password, role) => {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return;
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, hash, role);
  console.log(`Seeded user: ${email} / ${password}`);
};

seedUser('Admin User', 'admin@aromadelite.com', 'admin123', 'admin');
seedUser('BD Associate', 'bd@aromadelite.com', 'bd123', 'bd_associate');

const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (productCount === 0) {
  const insert = db.prepare(
    'INSERT INTO products (sku, name, description, unit, unit_price) VALUES (?, ?, ?, ?, ?)'
  );
  const seedProducts = [
    ['AD-FC-5', 'Floor Cleaner Concentrate', 'Industrial pH-neutral floor cleaner', 'L', 285],
    ['AD-DW-5', 'Dishwash Liquid Pro', 'High-foam commercial kitchen dishwash', 'L', 165],
    ['AD-TC-5', 'Toilet Bowl Cleaner', 'Acidic descaler for sanitary fixtures', 'L', 195],
    ['AD-HS-5', 'Hand Sanitizer 70% IPA', 'Alcohol-based hand sanitizer', 'L', 320],
    ['AD-GC-5', 'Glass Cleaner', 'Streak-free glass and surface spray', 'L', 145],
  ];
  for (const p of seedProducts) insert.run(...p);
  console.log(`Seeded ${seedProducts.length} products.`);
}

console.log('Database initialized.');
