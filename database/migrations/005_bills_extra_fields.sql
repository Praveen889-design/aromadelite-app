-- Migration 005: Add client GSTIN, state, place_of_supply to bills
-- Run on Supabase SQL Editor AFTER migration 004

ALTER TABLE bills ADD COLUMN IF NOT EXISTS client_gstin    VARCHAR(50);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS client_state    VARCHAR(100) DEFAULT '36-Telangana';
ALTER TABLE bills ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100) DEFAULT '36-Telangana';
