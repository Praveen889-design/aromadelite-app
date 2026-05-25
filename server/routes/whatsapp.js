/**
 * WhatsApp Business Cloud API integration.
 *
 * Endpoints (all require auth unless noted):
 *   GET  /api/whatsapp/config              — get saved config (token masked)
 *   PATCH /api/whatsapp/config             — save credentials (admin only)
 *   POST /api/whatsapp/test               — send a test message (admin only)
 *   POST /api/whatsapp/send/quote/:id     — send quote details + approval link to client
 *   POST /api/whatsapp/send/bill/:id      — send bill summary to client
 *   GET  /api/whatsapp/messages           — message history (quote_id or bill_id query param)
 *   GET  /api/whatsapp/webhook            — Meta webhook verification  (NO auth)
 *   POST /api/whatsapp/webhook            — receive delivery status / replies (NO auth)
 */

const express    = require('express');
const pool       = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const WA_API_VERSION = 'v20.0';
const WA_API_BASE    = `https://graph.facebook.com/${WA_API_VERSION}`;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Load a single app_settings value */
async function getSetting(key) {
  const { rows } = await pool.query(
    'SELECT value FROM app_settings WHERE key = $1', [key]
  );
  return rows[0]?.value || '';
}

/** Load all WA settings in one query */
async function getWAConfig() {
  const { rows } = await pool.query(
    `SELECT key, value FROM app_settings
     WHERE key IN (
       'whatsapp_access_token',
       'whatsapp_phone_number_id',
       'whatsapp_webhook_verify_token',
       'whatsapp_quote_template_name',
       'whatsapp_bill_template_name'
     )`
  );
  const cfg = {};
  rows.forEach(r => { cfg[r.key] = r.value || ''; });
  return {
    accessToken:         cfg.whatsapp_access_token          || '',
    phoneNumberId:       cfg.whatsapp_phone_number_id       || '',
    webhookVerifyToken:  cfg.whatsapp_webhook_verify_token  || '',
    quoteTemplateName:   cfg.whatsapp_quote_template_name   || '',
    billTemplateName:    cfg.whatsapp_bill_template_name    || '',
  };
}

/** Normalise Indian phone to 91XXXXXXXXXX */
function normalisePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1);
  return digits;
}

/** Call the WhatsApp Cloud API */
async function waPost(phoneNumberId, accessToken, body) {
  const resp = await fetch(
    `${WA_API_BASE}/${phoneNumberId}/messages`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
    }
  );
  const json = await resp.json();
  if (!resp.ok) {
    const msg = json?.error?.message || JSON.stringify(json);
    throw new Error(msg);
  }
  return json;   // { messages: [{ id: 'wamid.xxx' }] }
}

/** Build the quote notification text */
function buildQuoteText(q, approvalUrl) {
  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
  const clientDisplay = q.client_business_name || q.client_name;
  const validUntil = (() => {
    const d = new Date(q.created_at);
    d.setDate(d.getDate() + (Number(q.validity_days) || 7));
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

  let msg = `🌿 *Aromadelite* — Sri Vemuri Sai Enterprises\n\n`;
  msg += `Hi *${clientDisplay}*,\n\n`;
  msg += `Your quotation *#${q.quote_number}* is ready!\n\n`;
  msg += `💰 *Total: ₹${fmt(q.total_amount)}*\n`;
  msg += `⏳ *Valid till: ${validUntil}*\n`;
  if (approvalUrl) {
    msg += `\n🔗 *Review & Approve your quote:*\n${approvalUrl}\n`;
    msg += `\nTap the link to approve or request changes directly.\n`;
  }
  msg += `\nFor any queries, reply to this message or call us.\n`;
  msg += `📞 +91 63043 82947\n✉️ contact@aromadelite.in`;
  return msg;
}

/** Build the bill notification text */
function buildBillText(b) {
  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
  const clientDisplay = b.client_business_name || b.client_name;

  let msg = `🌿 *Aromadelite* — Sri Vemuri Sai Enterprises\n\n`;
  msg += `Hi *${clientDisplay}*,\n\n`;
  msg += `Your invoice *#${b.invoice_number || b.bill_number}* has been generated.\n\n`;
  msg += `💰 *Invoice Total: ₹${fmt(b.total_amount)}*\n`;

  if (b.amount_paid > 0 || b.payment_status === 'completed') {
    const paid = b.payment_status === 'completed' ? b.total_amount : b.amount_paid;
    const due  = Math.max(0, b.total_amount - paid);
    msg += `✅ *Paid: ₹${fmt(paid)}*\n`;
    if (due > 0) msg += `⏳ *Balance Due: ₹${fmt(due)}*\n`;
  }

  msg += `\nThank you for your business! 🙏\n`;
  msg += `📞 +91 63043 82947\n✉️ contact@aromadelite.in`;
  return msg;
}

// ── Config endpoints (admin only) ─────────────────────────────────────────

router.get('/config', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const cfg = await getWAConfig();
    // Mask the access token — show only last 6 chars
    const token = cfg.accessToken;
    res.json({
      configured:         !!(cfg.accessToken && cfg.phoneNumberId),
      access_token_hint:  token ? `****${token.slice(-6)}` : '',
      phone_number_id:    cfg.phoneNumberId,
      webhook_verify_token: cfg.webhookVerifyToken,
      quote_template_name:  cfg.quoteTemplateName,
      bill_template_name:   cfg.billTemplateName,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/config', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const {
      access_token, phone_number_id, webhook_verify_token,
      quote_template_name, bill_template_name,
    } = req.body || {};

    const updates = [
      ['whatsapp_phone_number_id',      phone_number_id      ?? null],
      ['whatsapp_webhook_verify_token', webhook_verify_token ?? null],
      ['whatsapp_quote_template_name',  quote_template_name  ?? null],
      ['whatsapp_bill_template_name',   bill_template_name   ?? null],
    ];
    // Only update token if a new non-empty value is provided
    if (access_token && access_token.trim() && !access_token.startsWith('****')) {
      updates.push(['whatsapp_access_token', access_token.trim()]);
    }

    for (const [key, value] of updates) {
      if (value !== null) {
        await pool.query(
          `INSERT INTO app_settings (key, value, updated_at) VALUES ($1,$2,NOW())
           ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [key, String(value).trim()]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Test message (admin only) ─────────────────────────────────────────────

router.post('/test', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { to_phone } = req.body || {};
    if (!to_phone) return res.status(400).json({ error: 'to_phone is required' });

    const cfg   = await getWAConfig();
    if (!cfg.accessToken || !cfg.phoneNumberId) {
      return res.status(400).json({ error: 'WhatsApp API not configured. Set credentials in Settings first.' });
    }

    const phone = normalisePhone(to_phone);
    if (!phone) return res.status(400).json({ error: 'Invalid phone number' });

    const result = await waPost(cfg.phoneNumberId, cfg.accessToken, {
      to:   phone,
      type: 'text',
      text: { body: '✅ WhatsApp API test from Aromadelite! Your integration is working correctly. 🌿' },
    });

    res.json({ ok: true, wa_message_id: result.messages?.[0]?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Send quote message ────────────────────────────────────────────────────

router.post('/send/quote/:id', requireAuth, async (req, res) => {
  try {
    const cfg = await getWAConfig();
    if (!cfg.accessToken || !cfg.phoneNumberId) {
      return res.status(400).json({ error: 'WhatsApp API not configured.' });
    }

    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found' });
    const q = rows[0];

    if (req.user.role !== 'admin' && q.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const phone = normalisePhone(q.client_phone);
    if (!phone) {
      return res.status(400).json({ error: 'Client has no phone number on this quote.' });
    }

    // Build approval URL if token exists
    let approvalUrl = null;
    if (q.client_approval_token) {
      const base = process.env.PUBLIC_APP_URL || req.protocol + '://' + req.get('host');
      approvalUrl = `${base}/q/${q.client_approval_token}`;
    }

    const templateName = cfg.quoteTemplateName;
    let waBody;

    if (templateName) {
      // Use a pre-approved Meta template
      const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
      const clientDisplay = q.client_business_name || q.client_name;
      const validUntil = (() => {
        const d = new Date(q.created_at);
        d.setDate(d.getDate() + (Number(q.validity_days) || 7));
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      })();

      waBody = {
        to:   phone,
        type: 'template',
        template: {
          name:     templateName,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: clientDisplay },
                { type: 'text', text: q.quote_number },
                { type: 'text', text: `₹${fmt(q.total_amount)}` },
                { type: 'text', text: validUntil },
                ...(approvalUrl ? [{ type: 'text', text: approvalUrl }] : []),
              ],
            },
          ],
        },
      };
    } else {
      // Free-form text (works within 24h customer-service window)
      waBody = {
        to:   phone,
        type: 'text',
        text: { body: buildQuoteText(q, approvalUrl), preview_url: !!approvalUrl },
      };
    }

    const result = await waPost(cfg.phoneNumberId, cfg.accessToken, waBody);
    const wamid  = result.messages?.[0]?.id || null;

    // Log the message
    await pool.query(
      `INSERT INTO whatsapp_messages
         (quote_id, to_phone, to_name, message_type, wa_message_id, status, sent_by)
       VALUES ($1,$2,$3,'quote',$4,'sent',$5)`,
      [q.id, phone, q.client_business_name || q.client_name, wamid, req.user.id]
    );

    res.json({ ok: true, wa_message_id: wamid, phone });
  } catch (err) {
    // Log the failure too
    try {
      const { rows } = await pool.query('SELECT client_phone, client_name, client_business_name FROM quotes WHERE id = $1', [req.params.id]);
      if (rows[0]) {
        const phone = normalisePhone(rows[0].client_phone);
        await pool.query(
          `INSERT INTO whatsapp_messages
             (quote_id, to_phone, to_name, message_type, status, error_message, sent_by)
           VALUES ($1,$2,$3,'quote','failed',$4,$5)`,
          [req.params.id, phone || 'unknown', rows[0].client_business_name || rows[0].client_name, err.message, req.user.id]
        );
      }
    } catch {}
    res.status(500).json({ error: err.message });
  }
});

// ── Send bill message ─────────────────────────────────────────────────────

router.post('/send/bill/:id', requireAuth, async (req, res) => {
  try {
    const cfg = await getWAConfig();
    if (!cfg.accessToken || !cfg.phoneNumberId) {
      return res.status(400).json({ error: 'WhatsApp API not configured.' });
    }

    const { rows } = await pool.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Bill not found' });
    const b = rows[0];

    if (req.user.role !== 'admin' && b.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const phone = normalisePhone(b.client_phone);
    if (!phone) {
      return res.status(400).json({ error: 'Client has no phone number on this bill.' });
    }

    const templateName = cfg.billTemplateName;
    let waBody;

    if (templateName) {
      const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
      const clientDisplay = b.client_business_name || b.client_name;
      waBody = {
        to:   phone,
        type: 'template',
        template: {
          name:     templateName,
          language: { code: 'en' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: clientDisplay },
              { type: 'text', text: b.invoice_number || b.bill_number || String(b.id) },
              { type: 'text', text: `₹${fmt(b.total_amount)}` },
            ],
          }],
        },
      };
    } else {
      waBody = {
        to:   phone,
        type: 'text',
        text: { body: buildBillText(b) },
      };
    }

    const result = await waPost(cfg.phoneNumberId, cfg.accessToken, waBody);
    const wamid  = result.messages?.[0]?.id || null;

    await pool.query(
      `INSERT INTO whatsapp_messages
         (bill_id, to_phone, to_name, message_type, wa_message_id, status, sent_by)
       VALUES ($1,$2,$3,'bill',$4,'sent',$5)`,
      [b.id, phone, b.client_business_name || b.client_name, wamid, req.user.id]
    );

    res.json({ ok: true, wa_message_id: wamid, phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Message history ───────────────────────────────────────────────────────

router.get('/messages', requireAuth, async (req, res) => {
  try {
    const { quote_id, bill_id } = req.query;
    if (!quote_id && !bill_id) {
      return res.status(400).json({ error: 'quote_id or bill_id required' });
    }
    const { rows } = await pool.query(
      `SELECT wm.*, e.name AS sent_by_name
       FROM whatsapp_messages wm
       LEFT JOIN employees e ON e.id = wm.sent_by
       WHERE ($1::int IS NULL OR wm.quote_id = $1)
         AND ($2::int IS NULL OR wm.bill_id  = $2)
       ORDER BY wm.sent_at DESC
       LIMIT 50`,
      [quote_id ? Number(quote_id) : null, bill_id ? Number(bill_id) : null]
    );
    res.json({ messages: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Webhook — Meta verification (NO auth) ────────────────────────────────

router.get('/webhook', async (req, res) => {
  try {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = await getSetting('whatsapp_webhook_verify_token');

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[WA webhook] verified');
      return res.status(200).send(challenge);
    }
    res.status(403).send('Forbidden');
  } catch (err) {
    res.status(500).send('Error');
  }
});

// ── Webhook — receive status updates & replies (NO auth) ─────────────────

router.post('/webhook', async (req, res) => {
  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes || [];

    for (const change of changes) {
      const value = change.value;

      // Delivery / read status updates
      const statuses = value?.statuses || [];
      for (const s of statuses) {
        const wamid  = s.id;
        const status = s.status;   // sent | delivered | read | failed
        const ts     = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();

        const updateFields = ['status = $1'];
        const params       = [status, wamid];

        if (status === 'delivered') {
          updateFields.push('delivered_at = $' + (params.length + 1));
          params.splice(params.length - 1, 0, ts);  // insert before wamid
          params[params.length - 1] = wamid;
        }
        if (status === 'read') {
          updateFields.push('read_at = $' + (params.length + 1));
          params.splice(params.length - 1, 0, ts);
          params[params.length - 1] = wamid;
        }

        // Rebuild parameterised query properly
        const setClauses = [];
        const qParams    = [status];
        if (status === 'delivered') { setClauses.push(`delivered_at = $${qParams.length + 1}`); qParams.push(ts); }
        if (status === 'read')      { setClauses.push(`read_at = $${qParams.length + 1}`);       qParams.push(ts); }
        setClauses.unshift(`status = $1`);
        qParams.push(wamid);

        await pool.query(
          `UPDATE whatsapp_messages SET ${setClauses.join(', ')} WHERE wa_message_id = $${qParams.length}`,
          qParams
        ).catch((e) => console.warn('[WA webhook] status update failed:', e.message));
      }

      // Incoming replies — log them (future: trigger notifications)
      const messages = value?.messages || [];
      for (const m of messages) {
        const from = m.from;   // phone number
        const text = m.text?.body || m.type;
        console.log(`[WA webhook] incoming from ${from}: ${text}`);
        // TODO: surface as notification — find linked quote by phone, create notification
      }
    }
  } catch (err) {
    console.error('[WA webhook] processing error:', err.message);
  }
});

module.exports = router;
