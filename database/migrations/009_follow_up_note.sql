-- Migration 009: add follow_up_note to leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS follow_up_note TEXT;
