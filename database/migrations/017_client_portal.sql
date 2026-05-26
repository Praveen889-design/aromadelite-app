-- Migration 017: Client self-service order portal
-- Adds portal_token to clients (permanent unique link per client)
-- Adds source + portal_ordered_at to quotes (to track portal-placed orders)

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE DEFAULT NULL;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS source            TEXT NOT NULL DEFAULT 'associate',
  ADD COLUMN IF NOT EXISTS portal_ordered_at TIMESTAMPTZ  DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_source ON quotes (source);
