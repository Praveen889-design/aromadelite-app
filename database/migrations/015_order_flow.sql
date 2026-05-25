-- Migration 015: Extended order flow
-- Adds timestamp columns for the new post-acceptance status stages:
--   accepted → final_quoted → order_placed → order_delivered → bill

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS final_quote_generated_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS order_placed_at            TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS order_delivered_at         TIMESTAMPTZ DEFAULT NULL;
