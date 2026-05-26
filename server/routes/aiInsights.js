/**
 * AI Insights — admin only
 * POST /api/ai-insights
 *
 * Pulls aggregated metrics from DB, sends to Google Gemini 1.5 Flash,
 * returns structured insight cards.  No raw PII is sent — only numbers
 * and aggregate labels.
 *
 * Requires env var: GEMINI_API_KEY
 */
const express  = require('express');
const https    = require('https');
const pool     = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Admin only
router.use((req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
});

/* ── Fetch business metrics from DB ─────────────────────────── */
async function fetchMetrics() {
  const [
    revRow,
    quoteStatusRows,
    assocRows,
    clientRows,
    paymentRows,
    productRows,
    followUpRows,
    portalRows,
  ] = await Promise.all([

    // Total revenue last 30 days vs prev 30 days
    pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN b.created_at >= NOW()-INTERVAL '30 days' THEN b.total_amount END),0) AS rev_30,
        COALESCE(SUM(CASE WHEN b.created_at >= NOW()-INTERVAL '60 days'
                           AND b.created_at <  NOW()-INTERVAL '30 days' THEN b.total_amount END),0) AS rev_prev30,
        COALESCE(SUM(CASE WHEN b.payment_status='completed' AND b.created_at >= NOW()-INTERVAL '30 days'
                          THEN b.total_amount END),0) AS collected_30,
        COALESCE(SUM(CASE WHEN b.payment_status IN ('pending','partial') THEN b.total_amount - COALESCE(b.amount_paid,0) END),0) AS overdue_total,
        COUNT(DISTINCT CASE WHEN b.payment_status IN ('pending','partial') THEN b.id END) AS overdue_bills
      FROM bills b
    `),

    // Quote pipeline counts by status
    pool.query(`
      SELECT status, COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS value
      FROM quotes
      WHERE created_at >= NOW()-INTERVAL '30 days'
      GROUP BY status
    `),

    // Associate performance (last 30 days)
    pool.query(`
      SELECT e.name,
             COUNT(q.id)                         AS quotes,
             COUNT(CASE WHEN q.status IN ('accepted','final_quoted','order_placed','order_delivered') THEN 1 END) AS converted,
             COALESCE(SUM(q.total_amount),0)     AS pipeline_value,
             COALESCE(SUM(b.total_amount),0)     AS billed_value
      FROM employees e
      LEFT JOIN quotes q ON q.employee_id = e.id AND q.created_at >= NOW()-INTERVAL '30 days'
      LEFT JOIN bills  b ON b.employee_id = e.id AND b.created_at >= NOW()-INTERVAL '30 days'
      WHERE e.role = 'associate' AND e.is_active = 1
      GROUP BY e.id, e.name
      ORDER BY billed_value DESC
      LIMIT 8
    `),

    // Top clients by value (last 30 days)
    pool.query(`
      SELECT
        COALESCE(q.client_business_name, q.client_name) AS client,
        q.client_city                                    AS city,
        COUNT(DISTINCT q.id)                             AS quotes,
        COALESCE(SUM(q.total_amount),0)                  AS pipeline,
        MAX(q.created_at)                                AS last_activity
      FROM quotes q
      WHERE q.created_at >= NOW()-INTERVAL '30 days'
      GROUP BY COALESCE(q.client_business_name, q.client_name), q.client_city
      ORDER BY pipeline DESC
      LIMIT 10
    `),

    // Payment overdue detail
    pool.query(`
      SELECT COALESCE(b.client_business_name, b.client_name) AS client,
             b.total_amount, b.amount_paid, b.payment_status,
             b.created_at,
             EXTRACT(DAY FROM NOW()-b.created_at)::int AS days_old
      FROM bills b
      WHERE b.payment_status IN ('pending','partial')
      ORDER BY (b.total_amount - COALESCE(b.amount_paid,0)) DESC
      LIMIT 10
    `),

    // Top products last 30 days
    pool.query(`
      SELECT
        item->>'product_name' AS product,
        SUM((item->>'quantity')::numeric)   AS total_qty,
        SUM((item->>'line_total')::numeric) AS total_value
      FROM quotes q, jsonb_array_elements(q.items::jsonb) item
      WHERE q.created_at >= NOW()-INTERVAL '30 days'
        AND q.status NOT IN ('draft','rejected')
      GROUP BY item->>'product_name'
      ORDER BY total_value DESC
      LIMIT 8
    `).catch(() => ({ rows: [] })),

    // Follow-ups due / overdue
    pool.query(`
      SELECT COUNT(*) AS overdue
      FROM leads
      WHERE follow_up_date <= NOW()
        AND status NOT IN ('converted','lost')
    `),

    // Portal orders last 7 days
    pool.query(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS value
      FROM quotes
      WHERE source='portal' AND portal_ordered_at >= NOW()-INTERVAL '7 days'
    `).catch(() => ({ rows: [{ cnt: 0, value: 0 }] })),
  ]);

  return {
    revenue: revRow.rows[0],
    quotePipeline: quoteStatusRows.rows,
    associates: assocRows.rows,
    topClients: clientRows.rows,
    overduePayments: paymentRows.rows,
    topProducts: productRows.rows,
    followUps: followUpRows.rows[0],
    portalOrders: portalRows.rows[0],
  };
}

/* ── Build Gemini prompt ─────────────────────────────────────── */
function buildPrompt(metrics) {
  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const r   = metrics.revenue;
  const rev30    = fmt(r.rev_30);
  const revPrev  = fmt(r.rev_prev30);
  const revDelta = r.rev_prev30 > 0
    ? `${(((r.rev_30 - r.rev_prev30) / r.rev_prev30) * 100).toFixed(1)}%`
    : 'N/A (no previous data)';

  const pipelineSummary = metrics.quotePipeline
    .map((s) => `${s.status}: ${s.cnt} quotes (${fmt(s.value)})`)
    .join(', ');

  const assocSummary = metrics.associates
    .map((a) => `${a.name}: ${a.quotes} quotes, ${a.converted} converted, billed ${fmt(a.billed_value)}`)
    .join('\n');

  const clientSummary = metrics.topClients
    .map((c) => `${c.client} (${c.city || 'N/A'}): ${c.quotes} quotes, pipeline ${fmt(c.pipeline)}`)
    .join('\n');

  const overdueSummary = metrics.overduePayments
    .map((p) => `${p.client}: ${fmt(p.total_amount - (p.amount_paid || 0))} due, ${p.days_old}d old`)
    .join('\n');

  const productSummary = metrics.topProducts
    .map((p) => `${p.product}: qty ${p.total_qty}, value ${fmt(p.total_value)}`)
    .join('\n');

  return `You are a business analyst AI for Aromadelite, a B2B cleaning products company in India.
Analyze the following real business data and return EXACTLY a valid JSON object with the structure shown below. Do not add any markdown, explanation, or text outside the JSON.

=== BUSINESS DATA (Last 30 days) ===
Revenue this month: ${rev30}
Revenue previous month: ${revPrev}
Month-over-month change: ${revDelta}
Total collected (paid): ${fmt(r.collected_30)}
Total overdue (unpaid/partial): ${fmt(r.overdue_total)} across ${r.overdue_bills} bills

Quote pipeline:
${pipelineSummary}

Associate performance:
${assocSummary}

Top clients by pipeline value:
${clientSummary}

Overdue payments (top 10):
${overdueSummary}

Top products ordered:
${productSummary}

Follow-ups overdue: ${metrics.followUps.overdue}
Portal orders (last 7 days): ${metrics.portalOrders.cnt} orders worth ${fmt(metrics.portalOrders.value)}

=== REQUIRED JSON OUTPUT FORMAT ===
{
  "summary": "2-3 sentence executive summary of the business health right now",
  "insights": [
    {
      "id": "revenue",
      "icon": "📈",
      "title": "Revenue & Growth",
      "status": "good|warning|critical",
      "headline": "one-line key finding",
      "detail": "2-3 sentence analysis with specific numbers from the data",
      "actions": ["specific action 1", "specific action 2"]
    },
    {
      "id": "pipeline",
      "icon": "🧾",
      "title": "Quote Pipeline",
      "status": "good|warning|critical",
      "headline": "one-line key finding",
      "detail": "2-3 sentence analysis",
      "actions": ["action 1", "action 2"]
    },
    {
      "id": "associates",
      "icon": "🧑‍💼",
      "title": "Associate Performance",
      "status": "good|warning|critical",
      "headline": "one-line key finding",
      "detail": "2-3 sentence analysis naming specific associates",
      "actions": ["action 1", "action 2"]
    },
    {
      "id": "payments",
      "icon": "💰",
      "title": "Payment Collection",
      "status": "good|warning|critical",
      "headline": "one-line key finding",
      "detail": "2-3 sentence analysis with amounts and client names",
      "actions": ["action 1", "action 2"]
    },
    {
      "id": "clients",
      "icon": "🏢",
      "title": "Client Health",
      "status": "good|warning|critical",
      "headline": "one-line key finding",
      "detail": "2-3 sentence analysis",
      "actions": ["action 1", "action 2"]
    },
    {
      "id": "products",
      "icon": "📦",
      "title": "Product Demand",
      "status": "good|warning|critical",
      "headline": "one-line key finding",
      "detail": "2-3 sentence analysis of top products",
      "actions": ["action 1"]
    }
  ],
  "forecast": "2-sentence outlook for the next 2 weeks based on current pipeline and trends",
  "priority_actions": ["top action 1", "top action 2", "top action 3"]
}`;
}

/* ── Call Gemini API ─────────────────────────────────────────── */
function callGemini(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path:     `/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || 'Gemini error'));
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          // Strip markdown code fences if present
          const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
          resolve(JSON.parse(clean));
        } catch (e) {
          reject(new Error('Failed to parse Gemini response: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Gemini request timed out')); });
    req.write(body);
    req.end();
  });
}

/* ── POST /api/ai-insights ───────────────────────────────────── */
router.post('/', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY not configured',
      setup: 'Get a free key at https://aistudio.google.com → Add GEMINI_API_KEY to your .env file',
    });
  }

  try {
    const metrics = await fetchMetrics();
    const prompt  = buildPrompt(metrics);
    const result  = await callGemini(prompt, apiKey);

    res.json({ insights: result, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('[ai-insights]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
