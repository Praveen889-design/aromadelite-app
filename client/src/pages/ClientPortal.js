import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const api = axios.create({ baseURL: '' });

/* Mirrors ProductCard logic — calculates pack price from size label + base per-unit price */
const calcPackPrice = (sizeLabel, basePrice, unit) => {
  const base = Number(basePrice) || 0;
  const lbl  = (sizeLabel || '').toLowerCase().trim();
  const u    = (unit || '').toLowerCase().trim();
  if ((u === 'ltr' || u === 'litre' || u === 'l') && /ltr|litre/i.test(lbl)) {
    const qty = parseFloat(lbl); if (qty > 0) return Math.round(qty * base);
  }
  if (u === 'kg') {
    if (/\bkg\b/i.test(lbl)) { const qty = parseFloat(lbl); if (qty > 0) return Math.round(qty * base); }
    if (/gms?\b|grams?\b/i.test(lbl)) { const qty = parseFloat(lbl); if (qty > 0) return Math.round((qty / 1000) * base); }
  }
  return base;
};

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

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

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/portal/${token}`);
        setPortalData(data);

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

  const { client, catalog = [], past_orders = [], gst_mode } = portalData || {};

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
        product_id:  it.product_id,
        name:        it.product_name || it.name,
        unit_price:  (prod?.negotiated_price ?? prod?.display_price ?? Number(it.unit_price)) || 0,
        gst_percent: (prod?.gst_percent ?? Number(it.gst_percent)) || 0,
        unit:        it.unit || 'Nos',
        hsn_code:    it.hsn_code || prod?.hsn_code || '',
        category_name: it.category_name || prod?.category_name || '',
        variant:     it.variant || '',
        pack_size:   it.pack_size || '',
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
          unit_price:  p.unit_price ?? p.display_price ?? p.negotiated_price ?? 0,
          gst_percent: p.gst_percent || 0,
          unit:        p.unit || 'Nos',
          hsn_code:    p.hsn_code || '',
          category_name: p.category_name || '',
          variant,
          pack_size,
        },
      }));
    }
  };

  const getQty = (p, variant = '', pack_size = '') => cart[cartKey(p, variant, pack_size)]?.qty || 0;

  const cartItems = Object.values(cart);
  // Cart total always includes GST — portal always shows what client will pay
  const cartTotal = cartItems.reduce((s, it) => {
    const gstFactor = 1 + (it.gst_percent || 0) / 100;
    return s + Math.round(it.qty * it.unit_price * gstFactor);
  }, 0);
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
        line_total:   +(it.qty * it.unit_price * (gst_mode === 'without_gst' ? 1 : (1 + it.gst_percent / 100))).toFixed(2),
      }));
      const { data } = await api.post(`/api/portal/${token}/order`, {
        items,
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
      <div style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🌿</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: '-0.02em' }}>Aromadelite</div>
              <div style={{ fontSize: 11, color: '#99f6e4', marginTop: 1 }}>Order Portal</div>
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
                  gst_mode={gst_mode}
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
                        gst_mode={gst_mode}
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
function ProductRow({ product, qty, onQtyChange, gst_mode, isNegotiated }) {
  const basePrice  = product.unit_price ?? product.display_price ?? product.negotiated_price ?? 0;
  // Always show GST-inclusive price — gst_mode only affects quote PDF format, not what client pays
  const gstFactor    = 1 + (product.gst_percent || 0) / 100;
  const displayPrice = Math.round(basePrice * gstFactor);
  const lineTotal    = qty > 0 ? qty * displayPrice : 0;
  const unitLabel    = product.pack_size || product.unit || 'Nos';

  return (
    <div style={{
      background: qty > 0 ? '#f0fdfa' : '#fff',
      border: `1.5px solid ${qty > 0 ? '#6ee7b7' : '#e2e8f0'}`,
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      transition: 'all .15s',
    }}>
      {/* Product info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', lineHeight: 1.3 }}>
          {product.name}
          {product.variant && <span style={{ fontWeight: 400, color: '#64748b' }}> · {product.variant}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: isNegotiated ? '#059669' : '#0f766e' }}>
            ₹{new Intl.NumberFormat('en-IN').format(displayPrice)}
          </span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>/ {unitLabel}</span>
          {isNegotiated && (
            <span style={{ fontSize: 9, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 99 }}>
              YOUR PRICE
            </span>
          )}
          {gst_mode !== 'without_gst' && product.gst_percent > 0 && (
            <span style={{ fontSize: 9, color: '#94a3b8' }}>incl. {product.gst_percent}% GST</span>
          )}
        </div>
        {qty > 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', marginTop: 2 }}>
            Subtotal: ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(lineTotal)}
          </div>
        )}
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
