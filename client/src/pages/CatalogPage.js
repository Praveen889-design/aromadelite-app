/**
 * Public Product Catalog — /catalog and /catalog/:token
 *
 * /catalog          → general public price list (no client details)
 * /catalog/:token   → personalised catalog (shows client details + associate)
 *
 * Associates generate a personalised link via the "Share Catalog" modal.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ShareCatalogModal from '../components/ShareCatalogModal';

const api = axios.create({ baseURL: '' });

/* ── helpers ─────────────────────────────────────────────── */
// Plain number with Indian grouping (prices are whole rupees) — matches Quote PDF
const fmtNum = (n, dec = 0) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: dec }).format(n || 0);

// Without-GST catalogues apply a flat markup instead of GST (mirrors quotes/bills)
const WITHOUT_GST_MARKUP = 0.05; // +5%

// with_gst    → base + GST = final price (GST shown separately)
// without_gst → base × (1 + markup), no GST
const finalPrice = (basePrice, gstPct, gstMode) =>
  gstMode === 'without_gst'
    ? Math.round(Number(basePrice || 0) * (1 + WITHOUT_GST_MARKUP))
    : Math.round(Number(basePrice || 0) * (1 + Number(gstPct || 0) / 100));

// Firm identity switches with GST mode (same as Quote / Tax Invoice)
const firmFor = (gstMode) => gstMode === 'without_gst'
  ? { name: 'VEMURI LIFE CARE', gstin: null }
  : { name: 'SRI VEMURI SAI ENTERPRISES', gstin: '36AQJPV7026L2Z5' };

// Table cells — identical styling to the Quote PDF (QuotePreview.js)
const TH = ({ children, style }) => (
  <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10.5,
    background: '#1a2b5e', color: '#ffffff', borderRight: '1px solid #2d3f72', letterSpacing: 0.3, ...style }}>
    {children}
  </th>
);
const TD = ({ children, style }) => (
  <td style={{ padding: '6px 10px', fontSize: 11, color: '#1e293b',
    borderBottom: '1px solid #e8edf5', borderRight: '1px solid #eef1f7', ...style }}>
    {children}
  </td>
);

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

/* ═══════════════════════════════════════════════════════════
   SHARE MODAL — captures client details before generating link
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   PDF PAGE — one per category
═══════════════════════════════════════════════════════════ */
function CatalogPageSheet({ cat, pageNum, totalPages, share, gstMode }) {
  const isWithoutGst = gstMode === 'without_gst';
  const firm = firmFor(gstMode);
  const headers = isWithoutGst
    ? ['#', 'Product Name & Description', 'Unit', 'Pack Sizes', 'Price (₹)']
    : ['#', 'Product Name & Description', 'Unit', 'Pack Sizes', 'Base Price (₹)', 'GST (₹)', 'Price incl. GST (₹)'];
  const colCount = headers.length;

  return (
    <div className="catalog-page">
      {/* ══ HEADER BAND — same as Quote PDF ══ */}
      {/* Top accent stripe */}
      <div style={{ height: 5, background: 'linear-gradient(90deg, #1a2b5e 0%, #1F6BC7 60%, #38bdf8 100%)' }} />

      {/* Company block */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 28px 14px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        {/* Logo */}
        <div style={{ width: 100, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img src="/aromadelite-logo.png" alt="Aromadelite" style={{ width: 100, height: 'auto', maxHeight: 60, objectFit: 'contain' }} />
        </div>
        {/* Company info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1a2b5e', letterSpacing: 0.5, lineHeight: 1.1 }}>
            {firm.name}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, letterSpacing: 0.1 }}>
            SAI NAGAR HNO 8-229/8, NVV NAGAR, CHINTAL, QUTHBULLAPUR, MALKAJGIRI – 500054
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 5, fontSize: 10, color: '#475569' }}>
            <span>📞 +91 63043 82947</span>
            <span>✉ contact@aromadelite.in</span>
            <span>🌐 aromadelite.in</span>
          </div>
          {firm.gstin && (
            <div style={{ display: 'flex', gap: 24, marginTop: 3, fontSize: 10, color: '#475569' }}>
              <span><strong style={{ color: '#1a2b5e' }}>GSTIN:</strong> {firm.gstin}</span>
              <span><strong style={{ color: '#1a2b5e' }}>State:</strong> 36-Telangana</span>
            </div>
          )}
        </div>
        {/* CATALOGUE label */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2b5e', letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1.05 }}>
            PRODUCT
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2b5e', letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1.05 }}>
            CATALOGUE
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1F6BC7', marginTop: 4 }}>
            {isWithoutGst ? 'Price List' : 'Inclusive of GST'}
          </div>
          <div style={{ fontSize: 9, color: '#90A4AE', marginTop: 2 }}>As of {today}</div>
        </div>
      </div>
      {/* ══ END HEADER BAND ══ */}

      {/* ── Prepared For / Prepared By band (personalised, first page only) ── */}
      {share && pageNum === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ padding: '12px 20px', borderRight: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#94a3b8', marginBottom: 7 }}>
              Prepared For
            </div>
            {[['🏢', share.business_name], ['👤', share.poc_name], ['📞', share.contact], ['📍', share.location]].filter(([, v]) => v).map(([icon, val]) => (
              <div key={val} style={{ fontSize: 11, color: '#334155', marginTop: 2 }}><span style={{ color: '#94a3b8' }}>{icon}</span> <strong style={{ color: '#1a2b5e' }}>{val}</strong></div>
            ))}
          </div>
          <div style={{ padding: '12px 20px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#94a3b8', marginBottom: 7 }}>
              Prepared By
            </div>
            <div style={{ fontWeight: 900, color: '#1a2b5e', fontSize: 13 }}>{share.associate_name || '—'}</div>
            {share.associate_phone && <div style={{ fontSize: 11, color: '#1F6BC7', fontWeight: 600, marginTop: 2 }}>📞 {share.associate_phone}</div>}
            <div style={{ fontSize: 9, color: '#90A4AE', marginTop: 3 }}>
              {new Date(share.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      )}

      {/* ── Items Table — same styling as Quote PDF ── */}
      <div style={{ flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <TH key={h} style={{
                  width: i === 0 ? 30 : undefined,
                  textAlign: i === 0 ? 'center' : i >= colCount - (isWithoutGst ? 1 : 3) ? 'right' : 'left',
                  borderRight: i === colCount - 1 ? 'none' : '1px solid #2d3f72',
                  paddingLeft: i === 0 ? 14 : 10,
                  paddingRight: i === colCount - 1 ? 14 : 10,
                  whiteSpace: 'nowrap',
                }}>{h}</TH>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Category header row — Quote style */}
            <tr>
              <td colSpan={colCount} style={{
                padding: '6px 14px 6px 12px', background: '#f1f5f9',
                borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
                borderLeft: '3px solid #1F6BC7', fontWeight: 800, fontSize: 10.5,
                color: '#1e40af', letterSpacing: 0.5, textTransform: 'uppercase',
              }}>
                {cat.icon && <span style={{ marginRight: 6 }}>{cat.icon}</span>}
                {cat.name}
                <span style={{ fontWeight: 600, color: '#64748b', textTransform: 'none', letterSpacing: 0 }}> · {cat.products.length} products</span>
              </td>
            </tr>
            {cat.products.map((p, idx) => {
              const gst    = Number(p.gst_percent) || 0;
              const base   = Number(p.base_price) || 0;
              const gstAmt = Math.round(base * gst / 100);
              const finalP = finalPrice(base, gst, gstMode);
              return (
                <tr key={p.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fafbfd' }}>
                  <TD style={{ textAlign: 'center', color: '#94a3b8', fontSize: 10, paddingLeft: 14 }}>{idx + 1}</TD>
                  <TD style={{ paddingLeft: 14 }}>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{p.name}</span>
                    {p.description && <div style={{ color: '#64748b', fontSize: 9.5, marginTop: 2, lineHeight: 1.35 }}>{p.description}</div>}
                    {p.variants?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                        {p.variants.map((v, vi) => <span key={vi} style={{ fontSize: 9, background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe', borderRadius: 99, padding: '1px 6px', fontWeight: 600 }}>{v}</span>)}
                      </div>
                    )}
                  </TD>
                  <TD style={{ fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>{unitLabel(p.unit)}</TD>
                  <TD>
                    {p.pack_sizes?.length > 0
                      ? p.pack_sizes.map((s, si) => <span key={si} style={{ display: 'inline-block', fontSize: 9, background: '#eef4ff', color: '#1F6BC7', border: '1px solid #bdd6f5', borderRadius: 99, padding: '1px 7px', margin: '1px 2px', fontWeight: 600 }}>{s.size}</span>)
                      : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </TD>
                  {!isWithoutGst && (
                    <TD style={{ textAlign: 'right', color: '#334155', whiteSpace: 'nowrap' }}>₹ {fmtNum(base)}</TD>
                  )}
                  {!isWithoutGst && (
                    <TD style={{ textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>
                      ₹ {fmtNum(gstAmt)}<span style={{ color: '#94a3b8', fontSize: 9 }}> ({gst}%)</span>
                    </TD>
                  )}
                  <TD style={{ textAlign: 'right', fontWeight: 800, color: '#1a2b5e', borderRight: 'none', paddingRight: 14, whiteSpace: 'nowrap' }}>
                    ₹ {fmtNum(finalP)}
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid #e2e8f0', padding: '8px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', marginTop: 'auto' }}>
        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>
          {share
            ? `Prepared by ${share.associate_name || 'Aromadelite'}${share.associate_phone ? ' · ' + share.associate_phone : ''}`
            : 'Contact your Aromadelite representative for bulk pricing & custom quotes'}
        </span>
        <span style={{ fontSize: 9, color: '#94a3b8' }}>{firm.name}</span>
        <span style={{ fontSize: 9, color: '#1a2b5e', fontWeight: 700 }}>Page {pageNum} / {totalPages}</span>
      </div>

      {/* Bottom accent */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #1a2b5e, #1F6BC7)' }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function CatalogPage() {
  const { token } = useParams();

  const [catalog,     setCatalog]     = useState([]);
  const [share,       setShare]       = useState(null);   // personalised share info
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [searchQ,     setSearchQ]     = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [linkCopied,  setLinkCopied]  = useState(false);
  const [gstMode,     setGstMode]     = useState('with_gst');

  const authToken = localStorage.getItem('token');
  const isLoggedIn = !!authToken;

  useEffect(() => {
    const load = async () => {
      try {
        if (token) {
          const { data } = await api.get(`/api/catalog/share/${token}`);
          setCatalog(data.catalog || []);
          setShare(data.share || null);
          // Personalised catalogues render in the mode chosen when shared
          setGstMode(data.share?.gst_mode === 'without_gst' ? 'without_gst' : 'with_gst');
        } else {
          const { data } = await api.get('/api/catalog');
          setCatalog(data.catalog || []);
        }
      } catch {
        setError('Could not load catalogue. Please check the link.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

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

  const handleCreated = (url) => {
    setShowModal(false);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 4000);
  };

  const handleWhatsApp = () => {
    const url = share ? window.location.href : `${window.location.origin}/catalog`;
    const msg = share
      ? `Hi ${share.poc_name || share.business_name || ''}! Please find your personalised Aromadelite product catalogue here:\n${url}`
      : `Hi! Here is our product catalogue with prices:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

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
      <div style={{ textAlign: 'center', color: '#dc2626' }}>{error}</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif", background: '#EEF2FF', minHeight: '100vh' }}>

      {/* ── Screen toolbar ──────────────────────────────────── */}
      <div className="no-print" style={{
        background: 'linear-gradient(135deg, #0D2B6B, #1565C0)',
        padding: '14px 28px', position: 'sticky', top: 0, zIndex: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        boxShadow: '0 2px 16px rgba(13,43,107,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '5px 10px' }}>
            <img src="/aromadelite-logo.png" alt="Aromadelite" style={{ height: 34, objectFit: 'contain', display: 'block' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: '0.04em' }}>
              PRODUCT CATALOGUE
              {share && <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8, marginLeft: 8 }}>— {share.business_name || share.poc_name}</span>}
            </div>
            <div style={{ color: '#90CAF9', fontSize: 11 }}>
              {filtered.reduce((s, c) => s + c.products.length, 0)} products · {filtered.length} categories
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* GST mode toggle — logged-in users on the general catalogue */}
          {isLoggedIn && !token && (
            <div style={{ display: 'flex', borderRadius: 9, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.35)' }}>
              {[
                { val: 'with_gst',    label: 'With GST' },
                { val: 'without_gst', label: 'Without GST' },
              ].map(opt => {
                const active = gstMode === opt.val;
                return (
                  <button key={opt.val} onClick={() => setGstMode(opt.val)}
                    style={{
                      padding: '9px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800,
                      background: active ? '#fff' : 'transparent',
                      color: active ? '#0D2B6B' : '#E3F2FD',
                    }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input type="text" placeholder="Search products…" value={searchQ} onChange={e => setSearchQ(e.target.value)}
              style={{ padding: '9px 14px 9px 36px', borderRadius: 9, border: 'none', fontSize: 13, outline: 'none', width: 200, background: 'rgba(255,255,255,0.15)', color: '#fff', fontFamily: 'inherit' }} />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 15 }}>🔍</span>
          </div>

          {/* Link copied toast */}
          {linkCopied && (
            <span style={{ background: '#E8F5E9', color: '#2E7D32', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20 }}>
              ✓ Link copied!
            </span>
          )}

          {/* Share catalog (logged in only) */}
          {isLoggedIn && !token && (
            <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#fff', border: 'none', borderRadius: 9, color: '#0D2B6B', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              📋 Share Catalogue
            </button>
          )}

          <button onClick={handleWhatsApp} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#25D366', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            📲 WhatsApp
          </button>

          <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🖨️ Save as PDF
          </button>
        </div>
      </div>

      {/* ── Notice ──────────────────────────────────────────── */}
      <div className="no-print" style={{ maxWidth: 820, margin: '14px auto 0', padding: '0 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #C5CAE9', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#3F51B5', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>ℹ️</span>
          <span>Each category prints as a separate A4 portrait page. {isLoggedIn && !token ? 'Click <strong>Share Catalogue</strong> to generate a personalised link for a specific client.' : ''}</span>
        </div>
      </div>

      {/* ── Catalog pages ────────────────────────────────────── */}
      <div style={{ maxWidth: 820, margin: '16px auto 48px', padding: '0 16px' }} id="print-root">
        {filtered.length === 0
          ? <div style={{ textAlign: 'center', color: '#78909C', padding: 60, fontSize: 15 }}>No products found.</div>
          : filtered.map((cat, i) => (
              <div key={cat.name} style={{ marginBottom: 24 }}>
                <CatalogPageSheet cat={cat} pageNum={i + 1} totalPages={filtered.length} share={share} gstMode={gstMode} />
              </div>
            ))
        }
      </div>

      {/* ── Share modal ──────────────────────────────────────── */}
      {showModal && <ShareCatalogModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}

      {/* ── Print styles ─────────────────────────────────────── */}
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          body, html { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          #print-root { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          #print-root > div { margin-bottom: 0 !important; }
          .catalog-page { page-break-before: always !important; break-before: page !important; page-break-inside: avoid !important; width: 100% !important; display: flex !important; flex-direction: column !important; background: #fff !important; }
          .catalog-page:first-child { page-break-before: avoid !important; break-before: avoid !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        }
      `}</style>
    </div>
  );
}
