-- Migration 007: Add modification approval workflow to quotes
-- Run on Supabase SQL Editor AFTER migration 006

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS modified_items      JSONB,
  ADD COLUMN IF NOT EXISTS modification_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS modification_note   TEXT,
  ADD COLUMN IF NOT EXISTS admin_note          TEXT,
  ADD COLUMN IF NOT EXISTS modified_at         TIMESTAMPTZ;

-- modification_status values:
--   NULL                → no modification pending
--   'pending_approval'  → associate submitted, awaiting admin
--   'approved'          → admin approved the modified items
--   'rejected'          → admin rejected, associate can re-edit
