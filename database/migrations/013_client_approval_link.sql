-- Migration 013: Client quote approval link
-- Associates generate a unique token link to share with clients.
-- Clients open the link (no login required) and can approve or request changes.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS client_approval_token  TEXT        UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_approval_status TEXT        DEFAULT NULL,
  -- Possible values: NULL (not sent), 'approved', 'changes_requested'
  ADD COLUMN IF NOT EXISTS client_approval_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_approval_note   TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_approved_by_name TEXT       DEFAULT NULL;

-- Fast lookup by token (used on every public page load)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_client_token
  ON quotes (client_approval_token)
  WHERE client_approval_token IS NOT NULL;
