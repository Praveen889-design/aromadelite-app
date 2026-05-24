-- Migration 010: partial payment recording
-- Adds a payments ledger table and amount_paid tracking on bills.
-- payment_status: 'pending' | 'partial' | 'completed'

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0;

-- widen payment_status to support 'partial'
ALTER TABLE bills
  ALTER COLUMN payment_status SET DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS payments (
  id               SERIAL PRIMARY KEY,
  bill_id          INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL,
  payment_method   VARCHAR(30) NOT NULL DEFAULT 'cash',
  payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT,
  recorded_by      INTEGER REFERENCES employees(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments (bill_id);
