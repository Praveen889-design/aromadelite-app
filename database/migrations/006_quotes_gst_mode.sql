-- Migration 006: Add gst_mode to quotes
-- Run on Supabase SQL Editor AFTER migration 005

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS gst_mode VARCHAR(20) DEFAULT 'with_gst';
