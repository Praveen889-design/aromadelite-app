import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useQuoteBuilder } from '../context/QuoteBuilderContext';
import { useToast } from '../components/Toast';
import { SkeletonCards } from '../components/Skeleton';
import { calcPackPrice, baseUnitLabel } from '../components/quote/ProductCard';
import { gradients, radii, shadow, tint } from '../theme/tokens';

// Each category gets a stable colour identity for a vibrant, scannable grid
const CAT_PALETTE = ['#6366F1', '#0EA5E9', '#14B8A6', '#10B981', '#84CC16', '#EAB308', '#F97316', '#F43F5E', '#D946EF', '#8B5CF6'];
const catColor = (name = '') => {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return CAT_PALETTE[h % CAT_PALETTE.length];
};

const CATEGORY_EMOJI = {
  'Chemical Cleaners': '🧪',
  'Consumables': '📦',
  'Tools & Equipment': '🧹',
  'Disinfectants': '🧴',
  'Fragrance': '🌸',
};

const CategoryChip = ({ children, active, emoji, count, onClick }) => (
  <button onClick={onClick} style={{
    flex: '0 0 auto',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 36, padding: '0 14px',
    borderRadius: 999,
    background: active ? gradients.green : '#FFFFFF',
    color: active ? '#FFFFFF' : '#0F2B3A',
    border: active ? 'none' : '1.5px solid #E2E8F0',
    fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13,
    boxShadow: active ? '0 6px 16px rgba(34,197,94,.30)' : '0 1px 2px rgba(8,42,56,.05)',
    whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .15s ease',
  }}>
    {emoji && <span style={{ fontSize: 15 }}>{emoji}</span>}
    {children}
    {count != null && (
      <span style={{
        fontSize: 11, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 999,
        padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(255,255,255,.25)' : '#EFF6FF', color: active ? '#fff' : '#2563EB',
      }}>{count}</span>
    )}
  </button>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 5 5L20 7"/>
  </svg>
);

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// Build the pack-size list (1-unit pack first, else a virtual base unit)
function buildPacks(product) {
  const baseLabel    = baseUnitLabel(product.unit);
  const rawPacks     = product.pack_sizes || [];
  const isOneUnit    = (s) => Math.abs(calcPackPrice(s.size, 1, product.unit) - 1) < 0.01;
  const oneUnitPacks = rawPacks.filter(isOneUnit);
  const bulkPacks    = rawPacks.filter((s) => !isOneUnit(s));
  const packs = rawPacks.length > 0
    ? (oneUnitPacks.length > 0 ? [...oneUnitPacks, ...bulkPacks] : [{ size: baseLabel, price: 0, isBase: true }, ...rawPacks])
    : [{ size: baseLabel, price: 0, isBase: true }];
  return { packs, baseLabel };
}

// ── Compact card (tap to expand) ─────────────────────────────
function ProductCard({ product, inCart, onOpen, onQuickAdd }) {
  const { packs, baseLabel } = buildPacks(product);
  const emoji  = product.category_icon || CATEGORY_EMOJI[product.category_name] || '📦';
  const price  = calcPackPrice(packs[0].size, product.base_price, product.unit);
  const gst    = Number(product.gst_percent) || 0;
  const accent = catColor(product.category_name);

  return (
    <div className="prod-card" onClick={() => onOpen(product)} style={{
      position: 'relative', background: '#FFFFFF',
      border: `1px solid ${inCart ? '#34D399' : '#E8EEF6'}`,
      borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', minWidth: 0,
      boxShadow: inCart ? '0 6px 16px rgba(5,150,105,.14)' : '0 2px 8px rgba(8,42,56,.06)',
    }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />

      {/* Image */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '1 / 1',
        background: product.image_url ? '#FFFFFF' : `linear-gradient(135deg, ${tint(accent, .1)} 0%, ${tint(accent, .04)} 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        borderBottom: '1px solid #EEF3F6',
      }}>
        {product.image_url
          ? <img className="prod-img" src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, boxSizing: 'border-box' }} />
          : <span style={{ fontSize: 44, opacity: 0.45 }}>{emoji}</span>}
        <span style={{ position: 'absolute', top: 7, left: 7, background: 'rgba(15,43,58,0.82)', color: '#fff', fontWeight: 700, fontSize: 9, padding: '2px 7px', borderRadius: 99, letterSpacing: '.04em', backdropFilter: 'blur(4px)' }}>{gst}%</span>
        {inCart && (
          <span style={{ position: 'absolute', top: 7, right: 7, display: 'inline-flex', alignItems: 'center', gap: 3, background: '#059669', color: '#fff', fontWeight: 800, fontSize: 9, padding: '2px 7px', borderRadius: 99 }}><CheckIcon /> Added</span>
        )}
      </div>

      {/* Body — compact */}
      <div style={{ padding: '9px 10px 10px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 8.5, color: accent, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
          {product.category_name || 'Product'}
        </span>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: '#0F2B3A', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 31 }}>{product.name}</div>

        <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 16, color: accent, letterSpacing: '-.02em', lineHeight: 1 }}>{formatINR(price)}</div>
            <div style={{ fontSize: 9.5, color: '#94A3B8' }}>/ {packs[0].isBase ? baseLabel.replace(/^1\s/, '') : packs[0].size}{packs.length > 1 ? ' +' : ''}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); inCart ? onOpen(product) : onQuickAdd(product, packs[0], null); }}
            aria-label={inCart ? 'In quote' : 'Add to quote'}
            style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: inCart ? '1.5px solid #059669' : 'none',
              background: inCart ? '#F0FDF4' : 'linear-gradient(135deg, #059669, #2563EB)', color: inCart ? '#059669' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: inCart ? 'none' : '0 3px 10px rgba(5,150,105,.30)' }}>
            {inCart ? <CheckIcon /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Full-detail expand sheet ─────────────────────────────────
function ProductDetailSheet({ product, inCart, onClose, onAdd }) {
  const [selVariant, setSelVariant] = useState(0);
  const [selPack, setSelPack]       = useState(0);
  const [qty, setQty]               = useState(1);

  const { packs, baseLabel } = buildPacks(product);
  const variants  = product.variants || [];
  const emoji     = product.category_icon || CATEGORY_EMOJI[product.category_name] || '📦';
  const accent    = catColor(product.category_name);
  const gst       = Number(product.gst_percent) || 0;
  const pack      = packs[selPack] || packs[0];
  const unitPrice = calcPackPrice(pack.size, product.base_price, product.unit);
  const lineTotal = unitPrice * qty;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(2px)', animation: 'pdFade .18s ease' }} />
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'relative', width: '100%', maxWidth: 460, maxHeight: '94vh', background: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24, display: 'flex', flexDirection: 'column',
        boxShadow: '0 -12px 44px rgba(15,23,42,.25)', animation: 'pdUp .24s cubic-bezier(.2,.8,.2,1)', overflow: 'hidden',
      }}>
        {/* Grab handle + close */}
        <div style={{ position: 'relative', paddingTop: 8 }}>
          <div style={{ width: 42, height: 4, borderRadius: 99, background: '#E2E8F0', margin: '0 auto' }} />
          <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 8, right: 12, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#F1F5F9', color: '#64748B', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '6px 18px 16px', flex: 1 }}>
          {/* Big image */}
          <div style={{ position: 'relative', width: '100%', height: 220, borderRadius: 16, background: product.image_url ? '#fff' : `linear-gradient(135deg, ${tint(accent, .12)}, ${tint(accent, .04)})`, border: `1px solid ${tint(accent, .2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 14 }}>
            {product.image_url
              ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 14, boxSizing: 'border-box' }} />
              : <span style={{ fontSize: 84, opacity: 0.5 }}>{emoji}</span>}
            <span style={{ position: 'absolute', top: 12, left: 12, background: accent, color: '#fff', fontWeight: 800, fontSize: 11, padding: '4px 10px', borderRadius: 99 }}>{gst}% GST</span>
          </div>

          {/* Category + name */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 10, color: accent, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />{product.category_name || 'Product'}
          </span>
          <h3 style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 21, color: '#0F2B3A', margin: '6px 0 0', letterSpacing: '-.02em', lineHeight: 1.2 }}>{product.name}</h3>
          {product.hsn_code && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 4 }}>HSN {product.hsn_code} · GST {gst}%</div>}
          {product.description && <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5, marginTop: 10 }}>{product.description}</p>}

          {/* Variants */}
          {variants.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 7 }}>Variant</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {variants.map((v, i) => (
                  <button key={i} onClick={() => setSelVariant(i)} style={{
                    padding: '6px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${i === selVariant ? accent : '#E2E8F0'}`,
                    background: i === selVariant ? tint(accent, .12) : '#fff', color: i === selVariant ? accent : '#475569',
                  }}>{v}</button>
                ))}
              </div>
            </div>
          )}

          {/* Pack sizes */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 7 }}>Pack size</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {packs.map((p, i) => {
                const pp = calcPackPrice(p.size, product.base_price, product.unit);
                const on = i === selPack;
                return (
                  <button key={i} onClick={() => setSelPack(i)} style={{
                    textAlign: 'left', padding: '9px 11px', borderRadius: 11, cursor: 'pointer',
                    border: `1.5px solid ${on ? accent : '#E2E8F0'}`, background: on ? tint(accent, .1) : '#fff',
                  }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: on ? accent : '#0F2B3A' }}>{p.isBase ? baseLabel : p.size}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: on ? accent : '#64748B', marginTop: 1 }}>{formatINR(pp)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.04em' }}>Quantity</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: 11, overflow: 'hidden' }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 40, height: 42, border: 'none', background: '#F8FAFF', color: accent, fontSize: 20, fontWeight: 800, cursor: 'pointer' }}>−</button>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} style={{ width: 50, textAlign: 'center', border: 'none', outline: 'none', fontSize: 16, fontWeight: 800, color: '#0F2B3A' }} />
              <button onClick={() => setQty((q) => q + 1)} style={{ width: 40, height: 42, border: 'none', background: '#F8FAFF', color: accent, fontSize: 18, fontWeight: 800, cursor: 'pointer' }}>+</button>
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div style={{ borderTop: '1px solid #E8EEF6', padding: '12px 18px calc(12px + env(safe-area-inset-bottom, 0px))', display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
          <div>
            <div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Total</div>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 22, color: '#0F2B3A', letterSpacing: '-.02em', lineHeight: 1 }}>{formatINR(lineTotal)}</div>
          </div>
          <button onClick={() => { onAdd(product, pack, variants[selVariant] || null, qty); onClose(); }} style={{
            flex: 1, height: 50, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: inCart ? 'linear-gradient(135deg,#64748B,#94A3B8)' : 'linear-gradient(135deg, #059669, #2563EB)', color: '#fff',
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 15.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 6px 16px rgba(5,150,105,.32)',
          }}>
            {inCart ? 'Add Again' : '+ Add to Quote'}
          </button>
        </div>
      </div>
      <style>{`@keyframes pdFade{from{opacity:0}to{opacity:1}}@keyframes pdUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

export default function Products() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { items, addItem } = useQuoteBuilder();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [openProduct, setOpenProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [pRes, cRes] = await Promise.all([
          api.get('/api/products'),
          api.get('/api/products/categories'),
        ]);
        setProducts(pRes.data.products || []);
        setCategories((cRes.data.categories || []).filter(c => Number(c.product_count) > 0));
      } catch (e) {
        setLoadError(e?.response?.data?.error || 'Failed to load catalog');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cartMap = new Map(items.map(i => [i.product_id, i]));

  const filtered = products.filter(p => {
    const matchCat = activeCat === 'all' || p.category_name === activeCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleAdd = (product, pack, variant, qty = 1) => {
    const packSize = pack?.isBase ? '' : (pack?.size || '');
    const price = calcPackPrice(pack?.size, product.base_price, product.unit);
    addItem({
      product_id:    product.id,
      product_name:  product.name,
      description:   product.description || null,
      category_id:   product.category_id,
      category_name: product.category_name,
      variant:       variant || null,
      pack_size:     packSize,
      unit:          packSize || product.unit || 'Nos',
      quantity:      Math.max(1, Number(qty) || 1),
      unit_price:    price,
      system_price:  price,
      gst_percent:   Number(product.gst_percent) || 0,
      hsn_code:      product.hsn_code,
    });
    toast(`${product.name} added to quote`, 'success');
  };

  const cartCount = items.length;
  const cartTotal = items.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.quantity) || 1), 0);

  if (loading) return <div className="space-y-4"><SkeletonCards count={6} /></div>;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Gradient hero + search ── */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: radii.xl, padding: '18px 20px 16px', background: gradients.green, boxShadow: shadow.md, marginBottom: 14 }}>
        <div style={{ position: 'absolute', right: -34, top: -44, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }} />
        <div style={{ position: 'absolute', right: 70, bottom: -60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.10)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 19, fontWeight: 900, color: '#fff', letterSpacing: '-.02em', margin: 0 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>
              </span>
              Product Catalog
            </h2>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.2)', padding: '5px 12px', borderRadius: 999, backdropFilter: 'blur(6px)' }}>
              {products.length} products · {categories.length} categories
            </span>
          </div>
          {/* Glassy search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.95)', borderRadius: 12, padding: '0 14px', height: 46, boxShadow: '0 4px 14px rgba(0,0,0,.10)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input type="text" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, color: '#0F2B3A' }} />
            {search && (
              <button onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: '#94A3B8', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category chips */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
          className="hide-scrollbar"
        >
          <CategoryChip active={activeCat === 'all'} count={products.length} onClick={() => setActiveCat('all')}>All</CategoryChip>
          {categories.map(c => {
            const name = typeof c === 'string' ? c : c.name;
            const emoji = typeof c === 'string' ? CATEGORY_EMOJI[c] : (c.icon_emoji || CATEGORY_EMOJI[c.name]);
            const count = typeof c === 'string' ? undefined : Number(c.product_count) || undefined;
            return (
              <CategoryChip
                key={name}
                active={activeCat === name}
                emoji={emoji}
                count={count}
                onClick={() => setActiveCat(name)}
              >{name}</CategoryChip>
            );
          })}
        </div>
        {/* Fade-right to hint more chips */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 4,
          width: 32, pointerEvents: 'none',
          background: 'linear-gradient(to right, transparent, #F1F5F9)',
        }} />
      </div>

      {loadError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#991B1B', fontSize: 13, marginBottom: 14 }}>
          {loadError}
        </div>
      )}

      {/* Product grid — 2-up on mobile, larger on desktop */}
      <div className="prod-grid" style={{ display: 'grid', gap: 11, paddingBottom: cartCount > 0 ? 88 : 8 }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>
            No products found{search ? ` for "${search}"` : ''}.
          </div>
        ) : (
          filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              inCart={cartMap.has(p.id)}
              onOpen={setOpenProduct}
              onQuickAdd={handleAdd}
            />
          ))
        )}
      </div>

      {/* Detail expand sheet */}
      {openProduct && (
        <ProductDetailSheet
          product={openProduct}
          inCart={cartMap.has(openProduct.id)}
          onClose={() => setOpenProduct(null)}
          onAdd={handleAdd}
        />
      )}

      {/* Grid responsiveness + card polish */}
      <style>{`
        .prod-grid { grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 560px) { .prod-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; } }
        @media (min-width: 900px) { .prod-grid { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; } }
        .prod-card { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .prod-card:active { transform: scale(.985); }
        @media (hover: hover) { .prod-card:hover { transform: translateY(-4px); box-shadow: 0 14px 32px rgba(8,42,56,.13); } }
        .prod-img { transition: transform .45s cubic-bezier(.2,.7,.2,1); }
        @media (hover: hover) { .prod-card:hover .prod-img { transform: scale(1.07); } }
      `}</style>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 56, left: 0, right: 0,
          background: '#FFFFFF', borderTop: '1px solid #E5E7EB',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 -8px 20px rgba(8,42,56,.10)',
          zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: '#EFF6FF', color: '#2563EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>
                <path d="M3 4h2l2.5 11.2A2 2 0 0 0 9.5 17H17a2 2 0 0 0 2-1.6L21 8H6"/>
              </svg>
              <span style={{
                position: 'absolute', top: -4, right: -4,
                minWidth: 18, height: 18, padding: '0 4px',
                borderRadius: 999, background: '#059669', color: '#FFFFFF',
                fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #FFFFFF',
              }}>{cartCount}</span>
            </div>
            <div>
              <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: '#0F2B3A' }}>
                {cartCount} item{cartCount !== 1 ? 's' : ''} in quote
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 13, color: '#059669' }}>
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(cartTotal)} est.
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/quotes/new')} style={{
            height: 44, padding: '0 16px',
            border: 0, borderRadius: 10,
            background: '#059669', color: '#FFFFFF',
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(5,150,105,.30)',
          }}>
            View Cart
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
