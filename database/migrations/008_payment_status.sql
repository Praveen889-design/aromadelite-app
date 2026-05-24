-- Migration 008: Payment status on bills
-- payment_status: 'pending' (default) | 'completed'
-- payment_completed_at: timestamp when marked completed

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS payment_status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

-- Index for fast "pending payments" queries
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills (payment_status);
