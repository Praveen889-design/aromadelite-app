-- Migration 004: Bills table + new quote/lead statuses
-- Run this on Supabase SQL Editor

-- 1. Update quotes status constraint to allow new statuses
ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_status_check;

ALTER TABLE quotes
  ADD CONSTRAINT quotes_status_check
    CHECK (status IN ('draft', 'sent', 'accepted', 'modifications_required', 'hold', 'rejected'));

-- 2. Update leads status constraint to allow 'negotiating'
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
    CHECK (status IN ('new', 'contacted', 'negotiating', 'qualified', 'converted', 'lost'));

-- 3. Create bills table
CREATE TABLE IF NOT EXISTS bills (
  id                   SERIAL PRIMARY KEY,
  bill_number          VARCHAR(50) UNIQUE NOT NULL,
  quote_id             INTEGER REFERENCES quotes(id),
  employee_id          INTEGER NOT NULL REFERENCES employees(id),
  client_name          VARCHAR(255) NOT NULL,
  client_business_name VARCHAR(255),
  client_type          VARCHAR(100),
  client_phone         VARCHAR(50),
  client_email         VARCHAR(255),
  client_city          VARCHAR(100),
  requirement_type     VARCHAR(100),
  items                JSONB NOT NULL DEFAULT '[]',
  gst_mode             VARCHAR(20) NOT NULL DEFAULT 'with_gst'
                         CHECK (gst_mode IN ('with_gst', 'without_gst')),
  subtotal             NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes                TEXT,
  status               VARCHAR(50) NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_employee ON bills(employee_id);
CREATE INDEX IF NOT EXISTS idx_bills_quote    ON bills(quote_id);
CREATE INDEX IF NOT EXISTS idx_bills_status   ON bills(status);
