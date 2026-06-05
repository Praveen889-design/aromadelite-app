/**
 * Public Product Catalog — /catalog
 * Premium B2B price list — one category per printed page.
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
  if (!u || u === '1' || u === '0')                              return '1 Unit';
  if (u === 'ltr' || u === 'litre' || u === 'l')                return '1 Ltr';
  if (u === 'kg')                                                return '1 Kg';
  if (u === 'box')                                               return '1 Box';
  if (u === 'no' || u === 'nos' || u === 'pc' || u === 'pcs')   return '1 Pc';
  if (u === 'pair' || u === 'pairs')                             return '1 Pair';
  if (u === 'pack' || u === 'pkt')                               return '1 Pack';
  if (u === 'roll')                                              return '1 Roll';
  if (u === 'set')                                               return '1 Set';
  return '1 ' + unit;
};

const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

/* ─────────────────────────────────────────────────────────────
   Each printed page: header + table + footer
───────────────────────────────────────────────────────────── */
function CatalogPageSheet({ cat, pageNum, totalPages }) {
  return (
    <div className="catalog-page">

      {/* ── Top accent stripe ── */}
      <div style={{ height: 5, background: 'linear-gradient(90deg, #1565C0 0%, #0D47A1 50%, #1565C0 100%)' }} />

      {/* ── Page header ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr 200px',
        alignItems: 'center',
        padding: '14px 28px 12px',
        borderBottom: '1.5px solid #BBDEFB',
        background: '#fff',
      }}>
        {/* Logo — sits on white background so it's fully visible */}
        <div>
          <img
            src="/aromadelite-logo.png"
            alt="Aromadelite"
            style={{ height: 52, objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Centre — Company + Catalogue title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: '#5C6BC0', fontWeight: 700, textTransform: 'uppercase' }}>
            AROMADELITE ENTERPRISES
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0D2B6B', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.1, marginTop: 2 }}>
            PRODUCT CATALOGUE
          </div>
          <div style={{ width: 60, height: 2, background: '#1565C0', margin: '5px auto 3px', borderRadius: 2 }} />
          <div style={{ fontSize: 9, color: '#78909C', fontWeight: 500 }}>
            Prices inclusive of GST · Valid as of {today}
          </div>
        </div>

        {/* Right — Category pill */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#E3F2FD', border: '1px solid #90CAF9', borderRadius: 20, padding: '5px 14px' }}>
            {cat.icon && <span style={{ fontSize: 14 }}>{cat.icon}</span>}
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0D47A1' }}>{cat.name}</span>
          </div>
          <div style={{ fontSize: 9, color: '#90A4AE', marginTop: 4 }}>
            {cat.products.length} product{cat.products.length !== 1 ? 's' : ''} · Page {pageNum}/{totalPages}
          </div>
        </div>
      </div>

      {/* ── Category banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0D2B6B 0%, #1565C0 100%)',
        padding: '10px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        {cat.icon && <span style={{ fontSize: 20 }}>{cat.icon}</span>}
        <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {cat.name}
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)', marginLeft: 12 }} />
        <span style={{ fontSize: 10, color: '#90CAF9', fontWeight: 600 }}>
          {cat.products.length} Products Listed
        </span>
      </div>

      {/* ── Products table ── */}
      <div style={{ padding: '0 28px', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {['#', 'Product Name & Description', 'Unit', 'Pack Sizes', 'HSN Code', 'GST', 'Price (incl. GST)'].map((h, i) => (
                <th key={h} style={{
                  padding: '9px 10px',
                  background: '#F0F4FF',
                  color: '#3F51B5',
                  fontWeight: 700,
                  fontSize: 9,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  borderBottom: '2px solid #C5CAE9',
                  textAlign: i === 0 ? 'center' : i >= 4 ? 'right' : 'left',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cat.products.map((p, idx) => {
              const price = displayPrice(p.base_price, p.gst_percent);
              return (
                <tr key={p.id} style={{ background: idx % 2 === 0 ? '#fff' : '#F8FAFF' }}>
                  {/* # */}
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: '#90A4AE', fontWeight: 700, fontSize: 10, borderBottom: '1px solid #E8EEF8', width: 28 }}>
                    {idx + 1}
                  </td>
                  {/* Name */}
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid #E8EEF8' }}>
                    <div style={{ fontWeight: 700, color: '#0D2B6B', fontSize: 12 }}>{p.name}</div>
                    {p.description && (
                      <div style={{ color: '#607D8B', fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>{p.description}</div>
                    )}
                    {p.variants?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                        {p.variants.map((v, vi) => (
                          <span key={vi} style={{ fontSize: 9, background: '#E8EAF6', color: '#3F51B5', border: '1px solid #C5CAE9', borderRadius: 99, padding: '1px 6px', fontWeight: 600 }}>{v}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  {/* Unit */}
                  <td style={{ padding: '9px 10px', color: '#37474F', fontWeight: 700, fontSize: 11, borderBottom: '1px solid #E8EEF8', whiteSpace: 'nowrap' }}>
                    {unitLabel(p.unit)}
                  </td>
                  {/* Pack sizes */}
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid #E8EEF8' }}>
                    {p.pack_sizes?.length > 0
                      ? p.pack_sizes.map((s, si) => (
                          <span key={si} style={{ display: 'inline-block', fontSize: 9, background: '#E3F2FD', color: '#1565C0', border: '1px solid #90CAF9', borderRadius: 99, padding: '1px 7px', margin: '1px 2px', fontWeight: 600 }}>{s.size}</span>
                        ))
                      : <span style={{ color: '#CFD8DC', fontSize: 11 }}>—</span>
                    }
                  </td>
                  {/* HSN */}
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: '#78909C', fontSize: 10, borderBottom: '1px solid #E8EEF8', fontFamily: 'monospace' }}>
                    {p.hsn_code || '—'}
                  </td>
                  {/* GST */}
                  <td style={{ padding: '9px 10px', textAlign: 'right', borderBottom: '1px solid #E8EEF8' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#E8F5E9', color: '#2E7D32', borderRadius: 99, padding: '2px 7px' }}>
                      {p.gst_percent}%
                    </span>
                  </td>
                  {/* Price */}
                  <td style={{ padding: '9px 14px 9px 10px', textAlign: 'right', borderBottom: '1px solid #E8EEF8', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 900, fontSize: 14, color: '#0D2B6B' }}>{fmtINR(price)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: '1.5px solid #BBDEFB',
        padding: '8px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#F0F4FF',
        marginTop: 'auto',
      }}>
        <span style={{ fontSize: 9, color: '#5C6BC0', fontWeight: 600 }}>aromadelite-app.vercel.app/catalog</span>
        <span style={{ fontSize: 9, color: '#78909C' }}>
          💬 Contact your Aromadelite representative for bulk pricing &amp; custom quotes
        </span>
        <span style={{ fontSize: 9, color: '#5C6BC0', fontWeight: 700 }}>Page {pageNum} / {totalPages}</span>
      </div>

      {/* ── Bottom accent stripe ── */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #1565C0 0%, #0D47A1 100%)' }} />
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

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF' }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/aromadelite-logo.png" alt="Aromadelite" style={{ height: 72, objectFit: 'contain' }} />
        <div style={{ marginTop: 14, color: '#1565C0', fontWeight: 700, fontSize: 15 }}>Loading catalogue…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#dc2626', textAlign: 'center' }}>{error}</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif", background: '#EEF2FF', minHeight: '100vh' }}>

      {/* ── Screen toolbar (hidden on print) ──────────────── */}
      <div className="no-print" style={{
        background: 'linear-gradient(135deg, #0D2B6B, #1565C0)',
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        flexWrap: 'wrap',
        boxShadow: '0 2px 16px rgba(13,43,107,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '6px 12px' }}>
            <img src="/aromadelite-logo.png" alt="Aromadelite" style={{ height: 36, objectFit: 'contain', display: 'block' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: '0.04em' }}>PRODUCT CATALOGUE</div>
            <div style={{ color: '#90CAF9', fontSize: 11 }}>
              {filtered.reduce((s, c) => s + c.products.length, 0)} products · {filtered.length} categories
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search products…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{
                padding: '9px 14px 9px 36px', borderRadius: 9, border: 'none',
                fontSize: 13, outline: 'none', width: 210,
                background: 'rgba(255,255,255,0.15)', color: '#fff',
                fontFamily: 'inherit',
              }}
            />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 15 }}>🔍</span>
          </div>
          <button
            onClick={() => { const t = encodeURIComponent(`Hi! Here is our product catalog:\n${window.location.href}`); window.open(`https://wa.me/?text=${t}`, '_blank'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#25D366', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            📲 Share
          </button>
          <button
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#fff', border: 'none', borderRadius: 9, color: '#0D2B6B', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            🖨️ Save as PDF
          </button>
        </div>
      </div>

      {/* ── Screen preview notice ──────────────────────────── */}
      <div className="no-print" style={{ maxWidth: 960, margin: '16px auto 0', padding: '0 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #C5CAE9', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#3F51B5', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>ℹ️</span>
          <span>Each category prints as a separate page. Click <strong>Save as PDF</strong> → choose <strong>Save as PDF</strong> in the destination. Use <strong>A4 Landscape</strong> for best results.</span>
        </div>
      </div>

      {/* ── Category pages ─────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: '16px auto 48px', padding: '0 16px' }} id="print-root">
        {filtered.length === 0
          ? <div style={{ textAlign: 'center', color: '#78909C', padding: 60, fontSize: 15 }}>No products found{searchQ ? ` for "${searchQ}"` : ''}.</div>
          : filtered.map((cat, i) => (
              <div key={cat.name} style={{ marginBottom: 28 }}>
                <CatalogPageSheet cat={cat} pageNum={i + 1} totalPages={filtered.length} />
              </div>
            ))
        }
      </div>

      {/* ── Styles ─────────────────────────────────────────── */}
      <style>{`
        @page { size: A4 landscape; margin: 0; }

        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          .no-print { display: none !important; }
          body, html { margin: 0 !important; padding: 0 !important; background: #fff !important; }

          #print-root {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          #print-root > div { margin-bottom: 0 !important; }

          .catalog-page {
            page-break-before: always !important;
            break-before: page !important;
            page-break-inside: avoid !important;
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            background: #fff !important;
          }

          .catalog-page:first-child {
            page-break-before: avoid !important;
            break-before: avoid !important;
          }

          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        }
      `}</style>
    </div>
  );
}
