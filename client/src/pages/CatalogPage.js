/**
 * Public Product Catalog — /catalog
 * Print / Save-as-PDF layout:
 *   • One category per page
 *   • Logo top-left + "PRODUCT CATALOGUE" centred on every page
 *   • Aromadelite blue (#1565C0) brand theme
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '' });

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const displayPrice = (basePrice, gstPct) =>
  Math.round(Number(basePrice || 0) * (1 + Number(gstPct || 0) / 100));

const unitLabel = (unit) => {
  const u = String(unit || '').toLowerCase().trim();
  if (!u || u === '1' || u === '0')                     return '1 Unit';
  if (u === 'ltr' || u === 'litre' || u === 'l')        return '1 Ltr';
  if (u === 'kg')                                        return '1 Kg';
  if (u === 'box')                                       return '1 Box';
  if (u === 'no' || u === 'nos' || u === 'pc' || u === 'pcs' || u === 'piece') return '1 Pc';
  if (u === 'pair' || u === 'pairs')                     return '1 Pair';
  if (u === 'pack' || u === 'pkt')                       return '1 Pack';
  if (u === 'roll')                                      return '1 Roll';
  if (u === 'set')                                       return '1 Set';
  return '1 ' + unit;
};

/* ── Brand colours from the Aromadelite logo ── */
const B = {
  blue:       '#1565C0',
  blueDark:   '#0D47A1',
  blueLight:  '#E3F2FD',
  blueMid:    '#1976D2',
  white:      '#FFFFFF',
  textDark:   '#0D1B40',
  textGrey:   '#546E7A',
  border:     '#BBDEFB',
};

/* ── Reusable page header (logo + centred title) ── */
function PageHeader({ categoryName, categoryIcon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: B.blue,
      padding: '14px 24px',
      marginBottom: 0,
    }}>
      {/* Logo */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, width: 180 }}>
        <img
          src="/aromadelite-logo.png"
          alt="Aromadelite"
          style={{ height: 48, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          onError={e => { e.target.style.display='none'; }}
        />
      </div>

      {/* Centred title */}
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ color: B.white, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.8 }}>
          Aromadelite Enterprises
        </div>
        <div style={{ color: B.white, fontSize: 16, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 1 }}>
          Product Catalogue
        </div>
        <div style={{ color: '#90CAF9', fontSize: 10, marginTop: 1, fontWeight: 500 }}>
          {categoryIcon && <span style={{ marginRight: 4 }}>{categoryIcon}</span>}
          {categoryName}
        </div>
      </div>

      {/* Right: price note */}
      <div style={{ flexShrink: 0, textAlign: 'right', width: 180 }}>
        <div style={{ color: '#BBDEFB', fontSize: 9, lineHeight: 1.5 }}>
          Prices: 1 unit · GST inclusive<br />
          Subject to change without notice
        </div>
      </div>
    </div>
  );
}

/* ── Products table for one category ── */
function CategoryTable({ cat }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr style={{ background: B.blueDark }}>
          {['#', 'Product Name & Description', 'Unit', 'Pack Sizes Available', 'HSN Code', 'GST %', 'Price (Incl. GST)'].map((h, i) => (
            <th key={h} style={{
              padding: '8px 10px',
              color: B.white,
              fontWeight: 700,
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              textAlign: i === 0 ? 'center' : i >= 4 ? 'right' : 'left',
              borderBottom: `2px solid ${B.blueMid}`,
              whiteSpace: 'nowrap',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cat.products.map((p, idx) => {
          const price = displayPrice(p.base_price, p.gst_percent);
          const ul    = unitLabel(p.unit);
          const isEven = idx % 2 === 0;
          return (
            <tr key={p.id} style={{ background: isEven ? B.blueLight : B.white }}>
              {/* # */}
              <td style={{ padding: '8px 10px', textAlign: 'center', color: B.textGrey, fontWeight: 600, fontSize: 10, width: 28, borderBottom: `1px solid ${B.border}` }}>
                {idx + 1}
              </td>
              {/* Name + description */}
              <td style={{ padding: '8px 10px', borderBottom: `1px solid ${B.border}` }}>
                <div style={{ fontWeight: 700, color: B.textDark, fontSize: 12 }}>{p.name}</div>
                {p.description && (
                  <div style={{ color: B.textGrey, fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>{p.description}</div>
                )}
                {p.variants?.length > 0 && (
                  <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {p.variants.map((v, vi) => (
                      <span key={vi} style={{ fontSize: 9, background: '#E3F2FD', color: B.blue, border: `1px solid ${B.border}`, borderRadius: 99, padding: '1px 6px', fontWeight: 600 }}>{v}</span>
                    ))}
                  </div>
                )}
              </td>
              {/* Unit */}
              <td style={{ padding: '8px 10px', color: B.textDark, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${B.border}`, whiteSpace: 'nowrap' }}>{ul}</td>
              {/* Pack sizes */}
              <td style={{ padding: '8px 10px', borderBottom: `1px solid ${B.border}` }}>
                {p.pack_sizes?.length > 0
                  ? p.pack_sizes.map((s, si) => (
                      <span key={si} style={{ display: 'inline-block', fontSize: 9, background: '#E3F2FD', color: B.blue, border: `1px solid ${B.border}`, borderRadius: 99, padding: '1px 6px', margin: '1px 2px', fontWeight: 600 }}>{s.size}</span>
                    ))
                  : <span style={{ color: '#B0BEC5', fontSize: 10 }}>—</span>
                }
              </td>
              {/* HSN */}
              <td style={{ padding: '8px 10px', textAlign: 'right', color: B.textGrey, fontSize: 10, borderBottom: `1px solid ${B.border}` }}>{p.hsn_code || '—'}</td>
              {/* GST */}
              <td style={{ padding: '8px 10px', textAlign: 'right', color: B.textGrey, fontWeight: 600, fontSize: 10, borderBottom: `1px solid ${B.border}` }}>{p.gst_percent}%</td>
              {/* Price */}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: B.blue, borderBottom: `1px solid ${B.border}`, whiteSpace: 'nowrap' }}>
                {fmtINR(price)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ── Category footer ── */
function PageFooter({ catIndex, totalCats }) {
  return (
    <div style={{
      borderTop: `2px solid ${B.blue}`,
      marginTop: 'auto',
      padding: '8px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: B.blueLight,
    }}>
      <span style={{ fontSize: 9, color: B.textGrey }}>aromadelite-app.vercel.app/catalog</span>
      <span style={{ fontSize: 9, color: B.textGrey }}>For bulk pricing or personalised quotes, contact your Aromadelite representative.</span>
      <span style={{ fontSize: 9, color: B.textGrey }}>Page {catIndex + 1} of {totalCats}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function CatalogPage() {
  const [catalog, setCatalog]  = useState([]);
  const [loading, setLoading]  = useState(true);
  const [error,   setError]    = useState('');
  const [searchQ, setSearchQ]  = useState('');

  useEffect(() => {
    api.get('/api/catalog')
      .then(({ data }) => setCatalog(data.catalog || []))
      .catch(() => setError('Could not load catalog. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = catalog
    .map(cat => ({
      ...cat,
      products: cat.products.filter(p =>
        !searchQ ||
        p.name.toLowerCase().includes(searchQ.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQ.toLowerCase())
      ),
    }))
    .filter(cat => cat.products.length > 0);

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`Hi! Here is our product catalog with prices:\n${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: B.blueLight }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/aromadelite-logo.png" alt="Aromadelite" style={{ height: 64, objectFit: 'contain' }} onError={e => { e.target.style.display='none'; }} />
        <div style={{ marginTop: 16, color: B.blue, fontWeight: 700, fontSize: 15 }}>Loading catalog…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#dc2626' }}>{error}</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif", background: '#F5F8FF', minHeight: '100vh' }}>

      {/* ── Screen-only toolbar ───────────────────────────── */}
      <div className="no-print" style={{
        background: B.blue, padding: '14px 24px', position: 'sticky', top: 0, zIndex: 40,
        boxShadow: '0 2px 12px rgba(21,101,192,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/aromadelite-logo.png" alt="Aromadelite" style={{ height: 40, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} onError={e => { e.target.style.display='none'; }} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: B.white }}>Product Catalogue</div>
            <div style={{ fontSize: 11, color: '#90CAF9' }}>{filtered.reduce((s, c) => s + c.products.length, 0)} products · {filtered.length} categories</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search products…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ padding: '8px 12px 8px 34px', borderRadius: 8, border: 'none', fontSize: 13, outline: 'none', width: 200, fontFamily: 'inherit', background: 'rgba(255,255,255,0.15)', color: B.white }}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
          </div>
          <button onClick={handleWhatsApp} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#25D366', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            📲 Share
          </button>
          <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: B.blueDark, border: `1.5px solid ${B.blueMid}`, borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🖨️ Save as PDF
          </button>
        </div>
      </div>

      {/* ── Preview notice (screen only) ──────────────────── */}
      <div className="no-print" style={{ maxWidth: 900, margin: '16px auto 0', padding: '0 16px' }}>
        <div style={{ background: '#E3F2FD', border: `1px solid ${B.border}`, borderRadius: 10, padding: '10px 16px', fontSize: 12, color: B.blue, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>ℹ️</span>
          <span>Prices are <strong>per 1 unit, GST inclusive</strong>. Each category prints on a separate page. Click <strong>Save as PDF</strong> for the formatted version.</span>
        </div>
      </div>

      {/* ── Catalog pages (one per category) ──────────────── */}
      <div style={{ maxWidth: 900, margin: '16px auto 40px', padding: '0 16px' }} id="catalog-print-area">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 60, fontSize: 15 }}>
            No products found{searchQ ? ` for "${searchQ}"` : ''}.
          </div>
        ) : filtered.map((cat, catIdx) => (
          <div
            key={cat.name}
            className="catalog-page"
            style={{
              background: B.white,
              border: `1.5px solid ${B.border}`,
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 32,
              boxShadow: '0 2px 16px rgba(21,101,192,0.10)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Page header — repeats on every page in print */}
            <PageHeader categoryName={cat.name} categoryIcon={cat.icon} />

            {/* Category banner */}
            <div style={{ background: B.blueMid, padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
              {cat.icon && <span style={{ fontSize: 18 }}>{cat.icon}</span>}
              <span style={{ color: B.white, fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cat.name}</span>
              <span style={{ marginLeft: 'auto', color: '#90CAF9', fontSize: 11, fontWeight: 600 }}>
                {cat.products.length} product{cat.products.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Products table */}
            <div style={{ padding: '0 0 0 0', flex: 1 }}>
              <CategoryTable cat={cat} />
            </div>

            {/* Page footer */}
            <PageFooter catIndex={catIdx} totalCats={filtered.length} />
          </div>
        ))}
      </div>

      {/* ── Print / PDF styles ─────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');

        @page {
          size: A4 landscape;
          margin: 0;
        }

        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          .no-print { display: none !important; }

          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Each catalog-page fills one A4 page */
          .catalog-page {
            page-break-before: always !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            break-before: page !important;
            break-after: page !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            min-height: 100vh !important;
            width: 100% !important;
          }

          /* First page: no leading page break */
          .catalog-page:first-child {
            page-break-before: avoid !important;
            break-before: avoid !important;
          }

          /* Hide the screen wrapper padding */
          #catalog-print-area {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Ensure table rows don't split */
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }

          /* Hide notice */
          #catalog-print-area > div:first-child { display: none !important; }
        }
      `}</style>
    </div>
  );
}
