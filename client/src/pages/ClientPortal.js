import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const api = axios.create({ baseURL: '' });

/* Mirrors ProductCard logic — calculates pack price from size label + base per-unit price */
// Pack price from the label's quantity + unit ("5L" = 5×base), independent of
// how product.unit is stored. Mirrors calcPackPrice in ProductCard.js.
const calcPackPrice = (sizeLabel, basePrice, unit) => {
  const base = Number(basePrice) || 0;
  const lbl  = (sizeLabel || '').toLowerCase().trim();
  const u    = (unit || '').toLowerCase().trim();
  const qty  = parseFloat(lbl);
  if (!(qty > 0)) return base;

  const lblMl    = /\d\s*ml\b/.test(lbl);
  const lblLitre = !lblMl && /\d\s*(l\b|ltr|litre|liter)/.test(lbl);
  const lblGram  = /\d\s*(gms?\b|grams?\b)/.test(lbl);
  const lblKg    = !lblGram && /\d\s*kgs?\b/.test(lbl);

  if (lblMl)    return Math.round((qty / 1000) * base);
  if (lblLitre) return Math.round(qty * base);
  if (lblGram)  return Math.round((qty / 1000) * base);
  if (lblKg)    return Math.round(qty * base);

  const unitLitre = u === 'l' || u === 'ltr' || u === 'litre' || u === 'liter' || u === 'litres';
  const unitKg    = u === 'kg' || u === 'kgs' || u === 'kilogram';
  if (unitLitre || unitKg) return Math.round(qty * base);

  return base;
};

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const WITHOUT_GST_MARKUP = 0.05; // +5%, mirrors quotes/bills
// Final price the client pays per the chosen GST mode
const priceFor = (base, gst, mode) =>
  mode === 'without_gst'
    ? Math.round(Number(base || 0) * (1 + WITHOUT_GST_MARKUP))
    : Math.round(Number(base || 0) * (1 + Number(gst || 0) / 100));

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_LABEL = {
  accepted:       '✓ Accepted',
  final_quoted:   '📋 Final Quote',
  order_placed:   '📦 Order Placed',
  order_delivered:'🚚 Delivered',
  sent:           'Sent',
  hold:           'On Hold',
};

export default function ClientPortal() {
  const { token } = useParams();

  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [portalData,   setPortalData]   = useState(null);

  // Cart: { [productId]: { qty, product } }
  const [cart,         setCart]         = useState({});
  const [notes,        setNotes]        = useState('');
  const [showPast,     setShowPast]     = useState(false);
  const [placing,      setPlacing]      = useState(false);
  const [orderResult,  setOrderResult]  = useState(null); // success state
  const [activeTab,    setActiveTab]    = useState('my_items'); // 'my_items' | 'catalog'
  const [searchQ,      setSearchQ]      = useState('');
  const [gstView,      setGstView]      = useState('with_gst'); // client-chosen GST mode
  const [priceOverrides, setPriceOverrides] = useState({});    // cartKey -> edited base price

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/portal/${token}`);
        setPortalData(data);
        setGstView(data.gst_mode === 'without_gst' ? 'without_gst' : 'with_gst');

        // Pre-fill cart with items from last order
        const cartInit = {};
        for (const item of (data.past_orders?.[0]?.items || [])) {
          if (item.product_id) {
            cartInit[`${item.product_id}||`] = {
              qty: Number(item.quantity) || 1,
              product_id: item.product_id,
              name: item.product_name || item.name,
              unit_price: Number(item.unit_price) || 0,
              gst_percent: Number(item.gst_percent) || 0,
              unit: item.unit || 'Nos',
              hsn_code: item.hsn_code || '',
              category_name: item.category_name || '',
              variant: item.variant || '',
              pack_size: item.pack_size || '',
            };
          }
        }
        setCart(cartInit);
      } catch (e) {
        setError(e?.response?.data?.error || 'Could not load your order portal. Please check the link.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const { client, catalog = [], past_orders = [] } = portalData || {};

  // Group catalog by category
  const grouped = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const filtered = q
      ? catalog.filter(p => p.name.toLowerCase().includes(q) || (p.category_name || '').toLowerCase().includes(q))
      : catalog;
    const map = new Map();
    for (const p of filtered) {
      const key = p.category_name || 'Other';
      if (!map.has(key)) map.set(key, { icon: p.category_icon, items: [] });
      map.get(key).items.push(p);
    }
    return [...map.entries()].map(([name, v]) => ({ name, icon: v.icon, items: v.items }));
  }, [catalog, searchQ]);

  // My items = products from the last order
  const myItems = useMemo(() => {
    if (!past_orders[0]) return [];
    const items = past_orders[0].items || [];
    return items.map(it => {
      // Find matching catalog product for fresh price
      const prod = catalog.find(p => p.id === it.product_id);
      return {
        product_id:   it.product_id,
        name:         it.product_name || it.name,
        description:  prod?.description || it.description || null,
        image_url:    prod?.image_url || null,
        category_icon: prod?.category_icon || null,
        unit_price:   (prod?.negotiated_price ?? prod?.display_price ?? Number(it.unit_price)) || 0,
        gst_percent:  (prod?.gst_percent ?? Number(it.gst_percent)) || 0,
        unit:         it.unit || 'Nos',
        hsn_code:     it.hsn_code || prod?.hsn_code || '',
        category_name: it.category_name || prod?.category_name || '',
        variant:      it.variant || '',
        pack_size:    it.pack_size || '',
      };
    });
  }, [past_orders, catalog]);

  const cartKey = (p, variant = '', pack_size = '') => `${p.id || p.product_id}|${variant}|${pack_size}`;

  const setQty = (p, qty, variant = '', pack_size = '') => {
    const key = cartKey(p, variant, pack_size);
    if (qty <= 0) {
      setCart(prev => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setCart(prev => ({
        ...prev,
        [key]: {
          qty,
          product_id:  p.id || p.product_id,
          name:        p.name,
          unit_price:  priceOverrides[key] !== undefined ? priceOverrides[key] : (p.unit_price ?? p.display_price ?? p.negotiated_price ?? 0),
          gst_percent: p.gst_percent || 0,
          unit:        pack_size || p.unit || 'Nos',
          hsn_code:    p.hsn_code || '',
          category_name: p.category_name || '',
          variant,
          pack_size,
        },
      }));
    }
  };

  const getQty = (p, variant = '', pack_size = '') => cart[cartKey(p, variant, pack_size)]?.qty || 0;

  // Effective base (per-unit, pre-GST) quote price — edited value wins
  const effBase = (p, variant = '', pack_size = '') => {
    const k = cartKey(p, variant, pack_size);
    const def = p.unit_price ?? p.display_price ?? p.negotiated_price ?? 0;
    return priceOverrides[k] !== undefined ? priceOverrides[k] : def;
  };
  // Edit the quote price for a product (updates the cart line too if present)
  const setPrice = (p, base, variant = '', pack_size = '') => {
    const k = cartKey(p, variant, pack_size);
    setPriceOverrides(prev => ({ ...prev, [k]: base }));
    setCart(prev => (prev[k] ? { ...prev, [k]: { ...prev[k], unit_price: base } } : prev));
  };

  const cartItems = Object.values(cart);
  // Total reflects the GST mode the client picked (With GST = +tax, Without = +5%)
  const cartTotal = cartItems.reduce((s, it) => s + it.qty * priceFor(it.unit_price, it.gst_percent, gstView), 0);
  const cartCount = cartItems.reduce((s, it) => s + it.qty, 0);

  const placeOrder = async () => {
    if (cartItems.length === 0) return;
    setPlacing(true);
    try {
      const items = cartItems.map(it => ({
        product_id:   it.product_id,
        product_name: it.name,
        quantity:     it.qty,
        unit_price:   it.unit_price,
        gst_percent:  it.gst_percent,
        unit:         it.unit,
        hsn_code:     it.hsn_code,
        category_name: it.category_name,
        variant:      it.variant,
        pack_size:    it.pack_size,
        line_total:   +(it.qty * priceFor(it.unit_price, it.gst_percent, gstView)).toFixed(2),
      }));
      const { data } = await api.post(`/api/portal/${token}/order`, {
        items,
        gst_mode: gstView,
        notes: notes || null,
        orderer_name: client?.name,
      });
      setOrderResult(data);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  /* ── Render ── */
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdfa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🌿</div>
        <div style={{ marginTop: 12, color: '#0f766e', fontWeight: 700, fontSize: 16 }}>Loading your portal…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 48 }}>🚫</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#991b1b', marginTop: 12 }}>Link not found</div>
        <div style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>{error}</div>
        <div style={{ marginTop: 16, fontSize: 13, color: '#9ca3af' }}>Contact your Aromadelite representative for a new link.</div>
      </div>
    </div>
  );

  /* ── Order Success ── */
  if (orderResult) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
        <div style={{ fontSize: 60 }}>🎉</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#065f46', marginTop: 16 }}>Order Placed!</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f766e', marginTop: 6 }}>{orderResult.quote_number}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#059669', marginTop: 12 }}>{fmtINR(orderResult.total)}</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 12, lineHeight: 1.6 }}>
          {orderResult.message}
        </div>
        <div style={{ marginTop: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#15803d' }}>
          📞 Our team will confirm your order within 2 hours.
        </div>
        <button
          onClick={() => { setOrderResult(null); setCart({}); setNotes(''); }}
          style={{ marginTop: 20, width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
        >
          Place Another Order
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(120deg, #0f766e 0%, #0d9488 45%, #06b6d4 100%)', padding: '15px 20px', position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 4px 18px rgba(13,148,136,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ background: '#fff', borderRadius: 11, padding: '5px 9px', display: 'inline-flex', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
              <img src="/aromadelite-logo.png" alt="Aromadelite" style={{ height: 26, objectFit: 'contain', display: 'block' }} />
            </span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: '-0.02em' }}>Aromadelite</div>
              <div style={{ fontSize: 11, color: '#a7f3d0', marginTop: 1 }}>Order Portal</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#fff' }}>
              {client?.business_name || client?.name}
            </div>
            {client?.city && (
              <div style={{ fontSize: 11, color: '#99f6e4', marginTop: 1 }}>📍 {client.city}</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 0 120px 0' }}>

        {/* ── Welcome banner ── */}
        <div style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)', margin: '0', padding: '16px 20px' }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>
            Welcome back, {client?.business_name ? `${client.business_name}` : client?.name}! 👋
          </div>
          <div style={{ color: '#ccfbf1', fontSize: 12, marginTop: 4 }}>
            Browse your products below and place an order directly.
          </div>
        </div>

        {/* ── GST mode toggle (client choice) ── */}
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(8,42,56,.05)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#334155' }}>💰 Pricing</span>
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 11, padding: 3 }}>
              {[{ v: 'with_gst', l: 'With GST' }, { v: 'without_gst', l: 'Without GST' }].map(o => {
                const on = gstView === o.v;
                return (
                  <button key={o.v} onClick={() => setGstView(o.v)} style={{
                    padding: '7px 15px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
                    background: on ? 'linear-gradient(135deg,#0d9488,#0f766e)' : 'transparent', color: on ? '#fff' : '#94a3b8',
                    boxShadow: on ? '0 3px 8px rgba(15,118,110,.3)' : 'none', transition: 'all .15s',
                  }}>{o.l}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Past Orders ── */}
        {past_orders.length > 0 && (
          <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <button
              onClick={() => setShowPast(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0f766e' }}>
                📦 Past Orders ({past_orders.length})
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2.5" style={{ transform: showPast ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showPast && (
              <div style={{ borderTop: '1px solid #f1f5f9' }}>
                {past_orders.map(o => (
                  <div key={o.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{o.number}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {fmtDate(o.created_at)} · {o.items?.length || 0} items
                        {o.source === 'portal' && (
                          <span style={{ marginLeft: 6, background: '#ccfbf1', color: '#0f766e', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                            Self-placed
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#059669' }}>{fmtINR(o.total)}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                        {STATUS_LABEL[o.status] || o.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab bar ── */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 16px 0', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          {myItems.length > 0 && (
            <button
              onClick={() => setActiveTab('my_items')}
              style={{
                padding: '8px 16px', borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                background: activeTab === 'my_items' ? '#fff' : 'transparent',
                color: activeTab === 'my_items' ? '#0f766e' : '#94a3b8',
                borderBottom: activeTab === 'my_items' ? '2px solid #0f766e' : '2px solid transparent',
              }}
            >
              🔁 My Usual Items
            </button>
          )}
          <button
            onClick={() => setActiveTab('catalog')}
            style={{
              padding: '8px 16px', borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              background: activeTab === 'catalog' ? '#fff' : 'transparent',
              color: activeTab === 'catalog' ? '#0f766e' : '#94a3b8',
              borderBottom: activeTab === 'catalog' ? '2px solid #0f766e' : '2px solid transparent',
            }}
          >
            🛍️ Full Catalog
          </button>
        </div>

        {/* ── My Usual Items ── */}
        {activeTab === 'my_items' && myItems.length > 0 && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              Based on your last order — adjust quantities as needed.
            </div>
            {myItems.map((item, i) => {
              const qty = getQty(item, item.variant, item.pack_size);
              return (
                <ProductRow
                  key={i}
                  product={item}
                  qty={qty}
                  onQtyChange={(q) => setQty(item, q, item.variant, item.pack_size)}
                  basePrice={effBase(item, item.variant, item.pack_size)}
                  onPriceChange={(v) => setPrice(item, v, item.variant, item.pack_size)}
                  gstView={gstView}
                  isNegotiated={true}
                />
              );
            })}
          </div>
        )}

        {/* ── Full Catalog ── */}
        {activeTab === 'catalog' && (
          <div style={{ padding: '12px 16px', background: '#fff' }}>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Search products…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1.5px solid #e2e8f0', borderRadius: 10,
                  padding: '10px 12px 10px 36px', fontSize: 14,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
            </div>

            {grouped.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24, fontSize: 14 }}>
                No products found for "{searchQ}"
              </div>
            ) : grouped.map(grp => (
              <div key={grp.name} style={{ marginBottom: 16 }}>
                <div style={{
                  background: '#eff6ff', padding: '8px 12px',
                  borderRadius: 8, fontWeight: 800, fontSize: 12,
                  color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {grp.icon && <span>{grp.icon}</span>}
                  {grp.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {grp.items.map(p => {
                    // Full Catalog always shows current system price — never stale past-quote prices.
                    // base_price is per-unit (per ltr/kg); calcPackPrice converts to pack level.
                    const firstSize     = p.pack_sizes?.[0]?.size || null;
                    const packBasePrice = firstSize
                      ? calcPackPrice(firstSize, p.base_price, p.unit)
                      : (p.base_price || 0);
                    const enriched = { ...p, unit_price: packBasePrice, pack_size: firstSize };
                    const qty = getQty(p);
                    return (
                      <ProductRow
                        key={p.id}
                        product={enriched}
                        qty={qty}
                        onQtyChange={(q) => setQty(enriched, q)}
                        basePrice={effBase(enriched)}
                        onPriceChange={(v) => setPrice(enriched, v)}
                        gstView={gstView}
                        isNegotiated={false}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Notes ── */}
        {cartCount > 0 && (
          <div style={{ padding: '0 16px 12px' }}>
            <textarea
              rows={2}
              placeholder="Any special instructions or notes for this order? (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid #e2e8f0', borderRadius: 10,
                padding: '10px 12px', fontSize: 13, resize: 'none',
                outline: 'none', fontFamily: 'inherit', color: '#374151',
              }}
            />
          </div>
        )}
      </div>

      {/* ── Sticky Cart Footer ── */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: '#fff', borderTop: '1.5px solid #e2e8f0',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
        }}>
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '12px 16px' }}>
            {/* Cart summary */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {cartCount} item{cartCount !== 1 ? 's' : ''} in cart
              </div>
              <div style={{ fontWeight: 900, fontSize: 18, color: '#0f766e' }}>
                {fmtINR(cartTotal)}
              </div>
            </div>

            <button
              onClick={placeOrder}
              disabled={placing}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: placing ? '#99f6e4' : 'linear-gradient(135deg, #0d9488, #0f766e)',
                color: '#fff', fontSize: 16, fontWeight: 900, cursor: placing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(13,148,136,0.35)',
              }}
            >
              {placing ? '⏳ Placing Order…' : `🛒 Place Order — ${fmtINR(cartTotal)}`}
            </button>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              Our team will confirm your order within 2 hours
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Product Row Component ── */
function ProductRow({ product, qty, onQtyChange, gstView, isNegotiated, basePrice = 0, onPriceChange }) {
  const actualBase   = product.unit_price ?? product.display_price ?? product.negotiated_price ?? 0;
  const actualFinal  = priceFor(actualBase, product.gst_percent, gstView);
  const displayPrice = priceFor(basePrice, product.gst_percent, gstView);
  const edited       = Math.round(basePrice) !== Math.round(actualBase);
  const lineTotal    = qty > 0 ? qty * displayPrice : 0;
  const unitLabel    = product.pack_size || product.unit || 'Nos';
  const emoji        = product.category_icon || '📦';
  const active       = qty > 0;

  return (
    <div style={{
      background: active ? 'linear-gradient(135deg,#f0fdfa,#ecfeff)' : '#fff',
      border: `1.5px solid ${active ? '#5eead4' : '#e2e8f0'}`,
      borderRadius: 14, padding: 11,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: active ? '0 4px 14px rgba(13,148,136,.14)' : '0 1px 3px rgba(8,42,56,.05)',
      transition: 'all .15s',
    }}>
      {/* Product image */}
      <div style={{ width: 60, height: 60, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
        background: product.image_url ? '#fff' : 'linear-gradient(135deg,#ccfbf1,#e0f2fe)',
        border: '1px solid #d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4, boxSizing: 'border-box' }} />
          : <span style={{ fontSize: 26, opacity: .6 }}>{emoji}</span>}
      </div>

      {/* Product info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f2b3a', lineHeight: 1.25 }}>
          {product.name}
          {product.variant && <span style={{ fontWeight: 400, color: '#64748b' }}> · {product.variant}</span>}
        </div>
        {product.description && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {product.description}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
          {/* Actual (list) price */}
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>Actual</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textDecoration: edited ? 'line-through' : 'none' }}>
              ₹{new Intl.NumberFormat('en-IN').format(actualFinal)}
            </span>
          </span>

          {/* Editable quote price (per unit, before GST) */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '.04em' }}>Quote</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', border: `1.5px solid ${edited ? '#0d9488' : '#cbd5e1'}`, borderRadius: 9, background: '#fff', overflow: 'hidden' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', padding: '0 0 0 8px' }}>₹</span>
              <input type="number" min={0} value={basePrice}
                onChange={(e) => onPriceChange && onPriceChange(Math.max(0, Number(e.target.value) || 0))}
                style={{ width: 60, border: 'none', outline: 'none', padding: '6px 8px', fontSize: 14, fontWeight: 800, color: '#0f766e', background: 'transparent' }} />
            </span>
            {edited && (
              <button onClick={() => onPriceChange && onPriceChange(actualBase)} title="Reset to actual price"
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 2 }}>↺</button>
            )}
          </span>

          {isNegotiated && (
            <span style={{ fontSize: 9, fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 99 }}>YOUR PRICE</span>
          )}
        </div>
        {/* Final payable price */}
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
          ={' '}
          <strong style={{ fontSize: 13.5, color: gstView === 'without_gst' ? '#9a3412' : '#0e7490' }}>₹{new Intl.NumberFormat('en-IN').format(displayPrice)}</strong>
          {' '}{gstView === 'without_gst' ? '(no GST)' : `incl. ${product.gst_percent}% GST`} / {unitLabel}
          {active && (
            <span style={{ fontWeight: 800, color: '#0f766e' }}> · Subtotal ₹{new Intl.NumberFormat('en-IN').format(lineTotal)}</span>
          )}
        </div>
      </div>

      {/* Quantity stepper */}
      {qty === 0 ? (
        <button
          onClick={() => onQtyChange(1)}
          style={{
            flexShrink: 0, width: 72, height: 36, borderRadius: 9, border: '1.5px solid #0d9488',
            background: '#f0fdfa', color: '#0f766e', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          }}
        >
          + Add
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onQtyChange(qty - 1)}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', color: '#0f766e' }}
          >−</button>
          <input
            type="number"
            min="0"
            value={qty}
            onChange={e => onQtyChange(Math.max(0, parseInt(e.target.value) || 0))}
            style={{
              width: 46, height: 32, textAlign: 'center', border: '1.5px solid #6ee7b7',
              borderRadius: 8, fontWeight: 800, fontSize: 14, color: '#0f766e',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => onQtyChange(qty + 1)}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #0d9488', background: '#0d9488', fontSize: 16, fontWeight: 700, cursor: 'pointer', color: '#fff' }}
          >+</button>
        </div>
      )}
    </div>
  );
}
