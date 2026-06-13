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
const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

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
  return (
    <div className="catalog-page">
      {/* Top accent */}
      <div style={{ height: 5, background: 'linear-gradient(90deg, #1565C0 0%, #0D47A1 50%, #1565C0 100%)' }} />

      {/* Page header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr 200px',
        alignItems: 'center',
        padding: '12px 28px',
        borderBottom: '1.5px solid #BBDEFB',
        background: '#fff',
      }}>
        <img src="/aromadelite-logo.png" alt="Aromadelite" style={{ height: 50, objectFit: 'contain' }} />

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#5C6BC0', fontWeight: 700, textTransform: 'uppercase' }}>
            {firm.name}
          </div>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#0D2B6B', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.1, marginTop: 2 }}>
            PRODUCT CATALOGUE
          </div>
          <div style={{ width: 60, height: 2, background: '#1565C0', margin: '4px auto 3px', borderRadius: 2 }} />
          <div style={{ fontSize: 9, color: '#78909C' }}>
            {share
              ? <>Prepared for <strong style={{ color: '#0D2B6B' }}>{share.business_name || share.poc_name}</strong></>
              : isWithoutGst
                ? `Valid as of ${today}`
                : `Prices inclusive of GST · Valid as of ${today}`
            }
          </div>
          {firm.gstin && (
            <div style={{ fontSize: 8.5, color: '#90A4AE', marginTop: 1 }}>GSTIN: {firm.gstin}</div>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#E3F2FD', border: '1px solid #90CAF9', borderRadius: 20, padding: '4px 12px', marginBottom: 4 }}>
            {cat.icon && <span style={{ fontSize: 13 }}>{cat.icon}</span>}
            <span style={{ fontSize: 10, fontWeight: 700, color: '#0D47A1' }}>{cat.name}</span>
          </div>
          <div style={{ fontSize: 9, color: '#90A4AE' }}>Page {pageNum} / {totalPages}</div>
        </div>
      </div>

      {/* Client/Associate band — only on first page of a personalised catalog */}
      {share && pageNum === 1 && (
        <div style={{ padding: '10px 28px 0' }}>
          <div style={{
            background: 'linear-gradient(135deg, #E8EAF6, #F0F4FF)',
            border: '1px solid #C5CAE9',
            borderRadius: 10,
            padding: '10px 20px',
            display: 'grid',
            gridTemplateColumns: '1fr 1px 1fr',
            gap: 0,
            alignItems: 'start',
          }}>
            {/* Prepared for */}
            <div style={{ paddingRight: 16 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#7986CB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                📋 Prepared For
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', alignItems: 'baseline', fontSize: 11 }}>
                {[['🏢', share.business_name], ['👤', share.poc_name], ['📞', share.contact], ['📍', share.location]].filter(([, v]) => v).map(([icon, val]) => (
                  <React.Fragment key={val}><span style={{ color: '#9FA8DA' }}>{icon}</span><span style={{ fontWeight: 700, color: '#0D2B6B' }}>{val}</span></React.Fragment>
                ))}
              </div>
            </div>
            {/* Divider */}
            <div style={{ background: '#C5CAE9', width: 1, alignSelf: 'stretch', margin: '0 16px' }} />
            {/* Prepared by */}
            <div style={{ paddingLeft: 16 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#7986CB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                👔 Prepared By
              </div>
              <div style={{ fontWeight: 900, color: '#0D2B6B', fontSize: 13 }}>{share.associate_name || '—'}</div>
              {share.associate_phone && <div style={{ fontSize: 11, color: '#1565C0', fontWeight: 600, marginTop: 2 }}>📞 {share.associate_phone}</div>}
              <div style={{ fontSize: 9, color: '#90A4AE', marginTop: 3 }}>
                {new Date(share.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category banner */}
      <div style={{ background: 'linear-gradient(135deg, #0D2B6B 0%, #1565C0 100%)', padding: '9px 28px', display: 'flex', alignItems: 'center', gap: 10, marginTop: share && pageNum === 1 ? 10 : 0 }}>
        {cat.icon && <span style={{ fontSize: 18 }}>{cat.icon}</span>}
        <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{cat.name}</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)', marginLeft: 10 }} />
        <span style={{ fontSize: 10, color: '#90CAF9', fontWeight: 600 }}>{cat.products.length} Products</span>
      </div>

      {/* Table */}
      <div style={{ padding: '0 28px', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {(isWithoutGst
                ? ['#', 'Product Name & Description', 'Unit', 'Pack Sizes', 'Price']
                : ['#', 'Product Name & Description', 'Unit', 'Pack Sizes', 'Base Price', 'GST', 'Price (incl. GST)']
              ).map((h, i, arr) => (
                <th key={h} style={{ padding: '8px 10px', background: '#F0F4FF', color: '#3F51B5', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '2px solid #C5CAE9', textAlign: i === 0 ? 'center' : i >= arr.length - (isWithoutGst ? 1 : 3) ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cat.products.map((p, idx) => {
              const gst       = Number(p.gst_percent) || 0;
              const base      = Number(p.base_price) || 0;
              const gstAmt    = Math.round(base * gst / 100);
              const finalP    = finalPrice(base, gst, gstMode);
              return (
              <tr key={p.id} style={{ background: idx % 2 === 0 ? '#fff' : '#F8FAFF' }}>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#90A4AE', fontWeight: 700, fontSize: 10, borderBottom: '1px solid #E8EEF8', width: 28 }}>{idx + 1}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid #E8EEF8' }}>
                  <div style={{ fontWeight: 700, color: '#0D2B6B', fontSize: 12 }}>{p.name}</div>
                  {p.description && <div style={{ color: '#607D8B', fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>{p.description}</div>}
                  {p.variants?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                      {p.variants.map((v, vi) => <span key={vi} style={{ fontSize: 9, background: '#E8EAF6', color: '#3F51B5', border: '1px solid #C5CAE9', borderRadius: 99, padding: '1px 6px', fontWeight: 600 }}>{v}</span>)}
                    </div>
                  )}
                </td>
                <td style={{ padding: '8px 10px', color: '#37474F', fontWeight: 700, fontSize: 11, borderBottom: '1px solid #E8EEF8', whiteSpace: 'nowrap' }}>{unitLabel(p.unit)}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid #E8EEF8' }}>
                  {p.pack_sizes?.length > 0
                    ? p.pack_sizes.map((s, si) => <span key={si} style={{ display: 'inline-block', fontSize: 9, background: '#E3F2FD', color: '#1565C0', border: '1px solid #90CAF9', borderRadius: 99, padding: '1px 7px', margin: '1px 2px', fontWeight: 600 }}>{s.size}</span>)
                    : <span style={{ color: '#CFD8DC', fontSize: 11 }}>—</span>}
                </td>
                {!isWithoutGst && (
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#37474F', fontSize: 11, borderBottom: '1px solid #E8EEF8', whiteSpace: 'nowrap' }}>{fmtINR(base)}</td>
                )}
                {!isWithoutGst && (
                  <td style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #E8EEF8', whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#607D8B', fontSize: 11 }}>{fmtINR(gstAmt)}</span>
                    <span style={{ color: '#90A4AE', fontSize: 9 }}> ({gst}%)</span>
                  </td>
                )}
                <td style={{ padding: '8px 14px 8px 10px', textAlign: 'right', borderBottom: '1px solid #E8EEF8', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 900, fontSize: 14, color: '#0D2B6B' }}>{fmtINR(finalP)}</span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1.5px solid #BBDEFB', padding: '7px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0F4FF', marginTop: 'auto' }}>
        <span style={{ fontSize: 9, color: '#5C6BC0', fontWeight: 600 }}>aromadelite-app.vercel.app/catalog</span>
        <span style={{ fontSize: 9, color: '#78909C' }}>
          {share
            ? `Prepared by ${share.associate_name || 'Aromadelite'}${share.associate_phone ? ' · ' + share.associate_phone : ''}`
            : 'Contact your Aromadelite representative for bulk pricing & custom quotes'
          }
        </span>
        <span style={{ fontSize: 9, color: '#5C6BC0', fontWeight: 700 }}>Page {pageNum} / {totalPages}</span>
      </div>

      {/* Bottom accent */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #1565C0, #0D47A1)' }} />
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
      <div className="no-print" style={{ maxWidth: 960, margin: '14px auto 0', padding: '0 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #C5CAE9', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#3F51B5', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>ℹ️</span>
          <span>Each category prints as a separate A4 landscape page. {isLoggedIn && !token ? 'Click <strong>Share Catalogue</strong> to generate a personalised link for a specific client.' : ''}</span>
        </div>
      </div>

      {/* ── Catalog pages ────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: '16px auto 48px', padding: '0 16px' }} id="print-root">
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
        @page { size: A4 landscape; margin: 0; }
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
