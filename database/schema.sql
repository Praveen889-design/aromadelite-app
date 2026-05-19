-- Aromadelite Quote & Lead Manager — full schema

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id   TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('associate', 'admin')),
  region        TEXT CHECK (region IN ('Hyderabad', 'Vijayawada', 'Warangal')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_emoji  TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id     INTEGER NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  variants        TEXT,      -- JSON array of variant names
  pack_sizes      TEXT,      -- JSON array of { size, price }
  unit            TEXT,
  base_price      REAL NOT NULL DEFAULT 0,
  bulk_price_5L   REAL,
  bulk_price_20L  REAL,
  bulk_price_200L REAL,
  gst_percent     INTEGER NOT NULL CHECK (gst_percent IN (12, 18)),
  hsn_code        TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (category_id) REFERENCES product_categories(id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_number         TEXT UNIQUE NOT NULL,           -- ARO-2025-0001
  employee_id          INTEGER NOT NULL,
  client_name          TEXT NOT NULL,
  client_business_name TEXT,
  client_type          TEXT NOT NULL CHECK (client_type IN
                         ('Hospital', 'FMC', 'Apartment', 'Restaurant', 'School', 'Contractor', 'Other')),
  client_phone         TEXT,
  client_email         TEXT,
  client_city          TEXT,
  requirement_type     TEXT NOT NULL CHECK (requirement_type IN
                         ('Bulk', 'Monthly Contract', 'Distributor')),
  items                TEXT NOT NULL,                  -- JSON
  subtotal             REAL NOT NULL DEFAULT 0,
  gst_amount           REAL NOT NULL DEFAULT 0,
  total_amount         REAL NOT NULL DEFAULT 0,
  validity_days        INTEGER NOT NULL DEFAULT 30,
  notes                TEXT,
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS leads (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id                INTEGER,
  employee_id             INTEGER NOT NULL,
  client_name             TEXT NOT NULL,
  client_business_name    TEXT,
  client_type             TEXT NOT NULL CHECK (client_type IN
                            ('Hospital', 'FMC', 'Apartment', 'Restaurant', 'School', 'Contractor', 'Other')),
  client_phone            TEXT,
  client_email            TEXT,
  client_city             TEXT,
  requirement_type        TEXT CHECK (requirement_type IN
                            ('Bulk', 'Monthly Contract', 'Distributor')),
  estimated_monthly_value REAL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'new'
                            CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  follow_up_date          TEXT,
  notes                   TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (quote_id) REFERENCES quotes(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_employees_role     ON employees(role);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_quotes_employee    ON quotes(employee_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status      ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_leads_employee     ON leads(employee_id);
CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_followup     ON leads(follow_up_date);
