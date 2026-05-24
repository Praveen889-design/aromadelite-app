-- Migration 012: Discount approval workflow
-- Adds discount approval tracking to quotes and an app_settings key-value store.

-- App-wide settings (discount threshold, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default discount threshold: require approval when any item is discounted > 10%
INSERT INTO app_settings (key, value)
VALUES ('discount_approval_threshold_pct', '10')
ON CONFLICT (key) DO NOTHING;

-- Approval columns on quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS discount_approval_status TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_approval_note   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_approval_by     INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_approval_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_discount_pct         NUMERIC(5,1) DEFAULT 0;

-- Index for fast admin queue lookup
CREATE INDEX IF NOT EXISTS idx_quotes_discount_approval
  ON quotes (discount_approval_status)
  WHERE discount_approval_status IS NOT NULL;
