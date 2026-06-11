const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is required in production. Set it in your environment.');
    process.exit(1);
  }
  process.env.JWT_SECRET = 'aromadelite_dev_secret_change_in_prod';
  console.warn('[warn] JWT_SECRET not set — using a dev fallback. Set one in production.');
}

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes      = require('./routes/auth');
const productRoutes   = require('./routes/products');
const quoteRoutes     = require('./routes/quotes');
const leadRoutes      = require('./routes/leads');
const dashboardRoutes = require('./routes/dashboard');
const employeeRoutes  = require('./routes/employees');
const reportRoutes    = require('./routes/reports');
const targetRoutes      = require('./routes/targets');
const commissionRoutes  = require('./routes/commissions');
const unitRoutes        = require('./routes/units');
const settingsRoutes    = require('./routes/settings');
const billRoutes              = require('./routes/bills');
const clientRoutes            = require('./routes/clients');
const notificationRoutes      = require('./routes/notifications');
const publicQuoteRoutes       = require('./routes/publicQuotes');
const whatsappRoutes          = require('./routes/whatsapp');
const portalRoutes            = require('./routes/portal');
const catalogRoutes           = require('./routes/catalog');
const aiInsightsRoutes        = require('./routes/aiInsights');
const partnersRoutes          = require('./routes/partners');
const businessCostsRoutes     = require('./routes/businessCosts');

const pool = require('./database/db');

// Migrate: add 'central_office' to employees.role constraint if not present
(async () => {
  try {
    const client = await pool.connect();
    try {
      // Drop old constraint (ignore if named differently or missing) and recreate with new values
      await client.query(`
        ALTER TABLE employees
          DROP CONSTRAINT IF EXISTS employees_role_check;
        ALTER TABLE employees
          ADD CONSTRAINT employees_role_check
          CHECK (role IN ('associate', 'admin', 'central_office'));
      `);
    } finally {
      client.release();
    }
  } catch (e) {
    console.warn('[migration] role constraint update skipped:', e.message);
  }
})();

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === 'production';

// In production allow same-origin (served via Express) + an optional comma-separated allow list.
// In dev we accept the CRA proxy origin.
const corsAllowList = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Same-origin / curl / mobile webview requests have no origin
    if (!origin) return cb(null, true);
    // In dev allow all localhost origins (CRA proxy sends the API server's own origin)
    if (!IS_PROD && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    if (corsAllowList.includes('*') || corsAllowList.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'aromadelite-api', time: new Date().toISOString() });
});

app.use('/api/auth',      authRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/quotes',    quoteRoutes);
app.use('/api/leads',     leadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/reports',   reportRoutes);
app.use('/api/targets',     targetRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/units',       unitRoutes);
app.use('/api/settings',    settingsRoutes);
app.use('/api/bills',         billRoutes);
app.use('/api/clients',       clientRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/public',        publicQuoteRoutes);   // no auth — client-facing
app.use('/api/portal',        portalRoutes);         // no auth — client order portal
app.use('/api/catalog',       catalogRoutes);        // no auth — public price list
app.use('/api/whatsapp',      whatsappRoutes);
app.use('/api/ai-insights',    aiInsightsRoutes);
app.use('/api/partners',       partnersRoutes);
app.use('/api/business-costs', businessCostsRoutes);

// In production, serve the built React app + SPA-fallback for client-side routes.
const clientBuildPath = path.resolve(__dirname, '../client/build');
if (IS_PROD && fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get(/^(?!\/api\/).+/, (_req, res) =>
    res.sendFile(path.join(clientBuildPath, 'index.html'))
  );
  console.log(`[static] Serving React build from ${clientBuildPath}`);
} else if (IS_PROD) {
  console.warn(`[warn] NODE_ENV=production but client build not found at ${clientBuildPath}. Run "npm run build" first.`);
}

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Aromadelite API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
