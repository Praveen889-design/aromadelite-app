-- Migration 014: WhatsApp Business API
-- Stores WA config in app_settings and tracks every outbound message.

-- WhatsApp API credentials (stored in app_settings with these keys):
--   whatsapp_access_token
--   whatsapp_phone_number_id
--   whatsapp_webhook_verify_token
--   whatsapp_quote_template_name      (optional — e.g. 'aromadelite_quote')
--   whatsapp_bill_template_name       (optional — e.g. 'aromadelite_bill')

INSERT INTO app_settings (key, value) VALUES
  ('whatsapp_access_token',          '')  ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES
  ('whatsapp_phone_number_id',       '')  ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES
  ('whatsapp_webhook_verify_token',  '')  ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES
  ('whatsapp_quote_template_name',   '')  ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES
  ('whatsapp_bill_template_name',    '')  ON CONFLICT (key) DO NOTHING;

-- Outbound message log
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id            SERIAL PRIMARY KEY,
  quote_id      INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
  bill_id       INTEGER REFERENCES bills(id)  ON DELETE SET NULL,
  to_phone      TEXT        NOT NULL,
  to_name       TEXT,
  message_type  TEXT        NOT NULL,   -- 'quote' | 'approval_link' | 'bill' | 'custom'
  wa_message_id TEXT        UNIQUE,     -- WA's wamid for status tracking
  status        TEXT        NOT NULL DEFAULT 'pending',
  -- pending | sent | delivered | read | failed
  error_message TEXT,
  sent_by       INTEGER     REFERENCES employees(id) ON DELETE SET NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ,
  read_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_quote  ON whatsapp_messages (quote_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_bill   ON whatsapp_messages (bill_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_wamid  ON whatsapp_messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;
