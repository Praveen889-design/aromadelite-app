-- Migration 011: clients table for canonical records and notes
-- Clients are matched to quotes/bills via phone + business_name.
-- No FK changes to existing tables needed.

CREATE TABLE IF NOT EXISTS clients (
  id               SERIAL PRIMARY KEY,
  business_name    TEXT,
  contact_name     TEXT NOT NULL,
  phone            TEXT,
  email            TEXT,
  city             TEXT,
  client_type      TEXT,
  gstin            TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: phone + business_name (normalised). Allows same phone with different businesses.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_phone_biz
  ON clients (
    LOWER(TRIM(COALESCE(phone, ''))),
    LOWER(TRIM(COALESCE(business_name, '')))
  );

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone);
