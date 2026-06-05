/**
 * Public Product Catalog Page — no auth required
 * URL: /catalog
 *
 * Shows all active products grouped by category with GST-inclusive prices
 * for 1 unit. Meant to be shared with prospects before any quote is raised.
 * Has Print and WhatsApp Share buttons.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '' });

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

/** GST-inclusive price for 1 base unit */
const displayPrice = (basePrice, gstPct) =>
  Math.round(Number(basePrice || 0) * (1 + Number(gstPct || 0) / 100));

/** Unit label for 1 base unit */
const unitLabel = (unit) => {
  const u = String(unit || '').toLowerCase().trim();
  if (!u || u === '1' || u === '0') return '1 Unit';   // catch numeric/blank DB values
  if (u === 'ltr' || u === 'litre' || u === 'l')       return '1 Ltr';
  if (u === 'kg')                                       return '1 Kg';
  if (u === 'box')                                      return '1 Box';
  if (u === 'no' || u === 'nos' || u === 'piece'
   || u === 'pcs' || u === 'pc')                        return '1 Pc';
  if (u === 'pair' || u === 'pairs')                    return '1 Pair';
  if (u === 'pack' || u === 'pkt')                      return '1 Pack';
  if (u === 'roll')                                     return '1 Roll';
  if (u === 'set')                                      return '1 Set';
  return '1 ' + unit;
};

export default function CatalogPage() {
  const [catalog,  setCatalog]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [searchQ,  setSearchQ]  = useState('');

  useEffect(() => {
    api.get('/api/catalog')
      .then(({ data }) => setCatalog(data.catalog || []))
      .catch(() => setError('Could not load catalog. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = catalog.map(cat => ({
    ...cat,
    products: cat.products.filter(p =>
      !searchQ || p.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQ.toLowerCase())
    ),
  })).filter(cat => cat.products.length > 0);

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi! Here is our product catalog with prices:\n${window.location.href}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdfa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🌿</div>
        <div style={{ marginTop: 12, color: '#0f766e', fontWeight: 700, fontSize: 16 }}>Loading catalog…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', color: '#dc2626' }}>{error}</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif", background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)', padding: '20px 24px', position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 32 }}>🌿</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '-0.02em' }}>Aromadelite</div>
              <div style={{ fontSize: 12, color: '#99f6e4', marginTop: 1 }}>Product Price List</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleWhatsApp}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#25D366', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 16 }}>📲</span> Share on WhatsApp
            </button>
            <button
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 16 }}>🖨️</span> Print / PDF
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 48px' }}>

        {/* ── Notice ──────────────────────────────────────────── */}
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400e', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
          <span>
            Prices shown are <strong>per 1 unit (GST inclusive)</strong> and subject to change.
            For bulk pricing or a formal quote, please contact your Aromadelite representative.
          </span>
        </div>

        {/* ── Search ──────────────────────────────────────────── */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Search products…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1.5px solid #e2e8f0', borderRadius: 12,
              padding: '12px 16px 12px 44px', fontSize: 14,
              outline: 'none', background: '#fff',
              fontFamily: 'inherit',
            }}
          />
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔍</span>
        </div>

        {/* ── Catalog by category ──────────────────────────────── */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 48, fontSize: 15 }}>
            No products found{searchQ ? ` for "${searchQ}"` : ''}.
          </div>
        ) : filtered.map(cat => (
          <div key={cat.name} style={{ marginBottom: 28 }}>
            {/* Category header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'linear-gradient(90deg,#0f766e18,transparent)',
              border: '1.5px solid #0f766e33', borderRadius: 10,
              padding: '10px 16px', marginBottom: 12,
            }}>
              {cat.icon && <span style={{ fontSize: 22 }}>{cat.icon}</span>}
              <span style={{ fontWeight: 800, fontSize: 15, color: '#0f4c3a', letterSpacing: '-0.01em' }}>{cat.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                {cat.products.length} product{cat.products.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Products table */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 90px 60px', gap: 0, background: '#f8fafc', padding: '8px 16px', borderBottom: '1px solid #e2e8f0' }}>
                {['Product', 'Unit', 'Price (incl. GST)', 'HSN Code', 'GST'].map((h, i) => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</div>
                ))}
              </div>

              {/* Product rows */}
              {cat.products.map((p, idx) => {
                const price = displayPrice(p.base_price, p.gst_percent);
                const ul    = unitLabel(p.unit);
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 100px 90px 90px 60px',
                      padding: '12px 16px', borderBottom: idx < cat.products.length - 1 ? '1px solid #f1f5f9' : 'none',
                      alignItems: 'start',
                    }}
                  >
                    {/* Name + description */}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
                          {p.description}
                        </div>
                      )}
                      {/* Pack sizes if available */}
                      {p.pack_sizes?.length > 0 && (
                        <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {p.pack_sizes.map((s, si) => (
                            <span key={si} style={{
                              fontSize: 10, fontWeight: 600, background: '#f0fdf4', color: '#0f766e',
                              border: '1px solid #6ee7b7', borderRadius: 99, padding: '2px 7px',
                            }}>{s.size}</span>
                          ))}
                        </div>
                      )}
                      {/* Variants if available */}
                      {p.variants?.length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {p.variants.map((v, vi) => (
                            <span key={vi} style={{
                              fontSize: 10, fontWeight: 600, background: '#eff6ff', color: '#2563eb',
                              border: '1px solid #bfdbfe', borderRadius: 99, padding: '2px 7px',
                            }}>{v}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Unit */}
                    <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, paddingTop: 2 }}>{ul}</div>

                    {/* Price */}
                    <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#0f766e', paddingTop: 2 }}>
                      {fmtINR(price)}
                    </div>

                    {/* HSN */}
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#94a3b8', paddingTop: 3 }}>
                      {p.hsn_code || '—'}
                    </div>

                    {/* GST */}
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b', fontWeight: 600, paddingTop: 3 }}>
                      {p.gst_percent}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── Footer ────────────────────────────────────────────── */}
        <div style={{ marginTop: 32, padding: '16px 20px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f766e', marginBottom: 4 }}>🌿 Aromadelite Enterprises</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Prices are GST-inclusive and valid for 1 base unit. Bulk discounts available on request.
            Contact your representative for a personalised quote.
          </div>
        </div>
      </div>

      {/* ── Print styles ─────────────────────────────────────── */}
      <style>{`
        @media print {
          button { display: none !important; }
          div[style*="position: sticky"] { position: relative !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
