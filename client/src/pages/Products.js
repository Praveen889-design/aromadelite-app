import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useQuoteBuilder } from '../context/QuoteBuilderContext';
import { useToast } from '../components/Toast';
import { SkeletonCards } from '../components/Skeleton';
import { calcPackPrice, baseUnitLabel } from '../components/quote/ProductCard';

const CATEGORY_EMOJI = {
  'Chemical Cleaners': '🧪',
  'Consumables': '📦',
  'Tools & Equipment': '🧹',
  'Disinfectants': '🧴',
  'Fragrance': '🌸',
};

const VariantPill = ({ children, active, onClick }) => (
  <button onClick={onClick} style={{
    height: 22, padding: '0 8px',
    borderRadius: 999,
    background: active ? '#0E7490' : 'transparent',
    color: active ? '#FFFFFF' : '#0E7490',
    border: '1.2px solid #0E7490',
    fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, fontSize: 10.5,
    display: 'inline-flex', alignItems: 'center',
    whiteSpace: 'nowrap', cursor: 'pointer',
  }}>{children}</button>
);

const CategoryChip = ({ children, active, emoji, onClick }) => (
  <button onClick={onClick} style={{
    flex: '0 0 auto',
    display: 'inline-flex', alignItems: 'center', gap: 5,
    height: 34, padding: '0 14px',
    borderRadius: 999,
    background: active ? '#0E7490' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#0E7490',
    border: active ? '1.5px solid #0E7490' : '1.5px solid #A5F3FC',
    fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, fontSize: 13,
    boxShadow: active ? '0 4px 12px rgba(14,116,144,.25)' : 'none',
    whiteSpace: 'nowrap', cursor: 'pointer',
  }}>
    {emoji && <span style={{ fontSize: 14 }}>{emoji}</span>}
    {children}
  </button>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 5 5L20 7"/>
  </svg>
);

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

function ProductCard({ product, inCart, onAddToQuote }) {
  const [selVariant, setSelVariant] = useState(0);
  const [selPack, setSelPack]       = useState(0);

  const emoji    = product.category_icon || CATEGORY_EMOJI[product.category_name] || '📦';
  const variants = product.variants || [];
  const rawPacks = product.pack_sizes || [];   // API field is pack_sizes

  // Move an existing 1-unit pack to front, else prepend a virtual base unit
  const baseLabel    = baseUnitLabel(product.unit);
  const isOneUnit    = (s) => Math.abs(calcPackPrice(s.size, 1, product.unit) - 1) < 0.01;
  const oneUnitPacks = rawPacks.filter(isOneUnit);
  const bulkPacks    = rawPacks.filter((s) => !isOneUnit(s));
  const packs = rawPacks.length > 0
    ? (oneUnitPacks.length > 0 ? [...oneUnitPacks, ...bulkPacks] : [{ size: baseLabel, price: 0, isBase: true }, ...rawPacks])
    : [{ size: baseLabel, price: 0, isBase: true }];

  const activePack = packs[selPack] || packs[0];
  const price      = calcPackPrice(activePack.size, product.base_price, product.unit);
  const gst        = Number(product.gst_percent) || 0;

  return (
    <div className="prod-card" style={{
      position: 'relative', background: '#FFFFFF',
      border: `1px solid ${inCart ? '#34D399' : '#E5EEF2'}`,
      borderRadius: 16, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', minWidth: 0,
      boxShadow: inCart ? '0 6px 18px rgba(5,150,105,.14)' : '0 1px 3px rgba(8,42,56,.06)',
    }}>
      {/* ── Image ── */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '4 / 3',
        background: 'linear-gradient(135deg, #ECFEFF 0%, #F0FDFA 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 54, opacity: 0.45 }}>{emoji}</span>}

        {/* GST badge */}
        <span style={{
          position: 'absolute', top: 8, left: 8,
          background: 'rgba(255,255,255,0.92)', color: '#0E7490',
          fontFamily: "'Source Sans 3', sans-serif", fontWeight: 800, fontSize: 9.5,
          padding: '2px 7px', borderRadius: 99, letterSpacing: '.04em',
          boxShadow: '0 1px 3px rgba(8,42,56,.12)',
        }}>{gst}% GST</span>

        {inCart && (
          <span style={{
            position: 'absolute', top: 8, right: 8,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#059669', color: '#FFFFFF',
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 10,
            padding: '3px 8px', borderRadius: 99,
            boxShadow: '0 2px 6px rgba(5,150,105,.40)',
          }}><CheckIcon /> In Quote</span>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
        <span style={{
          fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 9.5,
          color: '#0E7490', letterSpacing: '.1em', textTransform: 'uppercase',
        }}>{product.category_name || 'Product'}</span>

        <div style={{
          fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 16,
          color: '#0F2B3A', lineHeight: 1.25, letterSpacing: '-.01em',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{product.name}</div>

        {product.description && (
          <div style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: '#64748B',
            lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{product.description}</div>
        )}

        {/* Variants */}
        {variants.length > 1 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {variants.slice(0, 3).map((v, i) => (
              <VariantPill key={i} active={i === selVariant} onClick={() => setSelVariant(i)}>{v}</VariantPill>
            ))}
          </div>
        )}

        {/* Pack selector */}
        {packs.length > 1 && (
          <select value={selPack} onChange={(e) => setSelPack(Number(e.target.value))} style={{
            border: '1px solid #CBE7EE', borderRadius: 8, padding: '6px 8px', fontSize: 12,
            color: '#164E63', background: '#F7FCFD', fontFamily: "'Source Sans 3', sans-serif", outline: 'none',
          }}>
            {packs.map((p, i) => (
              <option key={i} value={i}>
                {p.isBase ? baseLabel : p.size} — {formatINR(calcPackPrice(p.size, product.base_price, product.unit))}
              </option>
            ))}
          </select>
        )}

        {/* Price + Add */}
        <div style={{ marginTop: 'auto', paddingTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 21, color: '#0E7490', letterSpacing: '-.02em' }}>
              {formatINR(price)}
            </span>
            <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11.5, color: '#94A3B8' }}>
              / {activePack.isBase ? baseLabel.replace(/^1\s/, '') : activePack.size}
            </span>
          </div>

          <button onClick={() => onAddToQuote(product, activePack, variants[selVariant] || null)} style={{
            width: '100%', height: 40, borderRadius: 10,
            background: inCart ? '#FFFFFF' : 'linear-gradient(135deg, #059669, #0E7490)',
            border: inCart ? '1.5px solid #059669' : 0,
            color: inCart ? '#059669' : '#FFFFFF',
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            cursor: 'pointer',
            boxShadow: inCart ? 'none' : '0 4px 12px rgba(5,150,105,.28)',
          }}>
            {inCart ? <>Added <CheckIcon /></> : '+ Add to Quote'}
          </button>
        </div>
      </div>
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

  const handleAdd = (product, pack, variant) => {
    if (cartMap.has(product.id)) {
      toast('Already in quote — adjust qty in the cart', 'info');
      return;
    }
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
      quantity:      1,
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
    <div style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#FFFFFF', border: '1.5px solid #E5E7EB',
        borderRadius: 12, padding: '0 14px', height: 44, marginBottom: 12,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, border: 0, outline: 0, background: 'transparent',
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, color: '#374151',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: '#94A3B8', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
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
          <CategoryChip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>All</CategoryChip>
          {categories.map(c => {
            const name = typeof c === 'string' ? c : c.name;
            const emoji = typeof c === 'string' ? CATEGORY_EMOJI[c] : (c.icon_emoji || CATEGORY_EMOJI[c.name]);
            return (
              <CategoryChip
                key={name}
                active={activeCat === name}
                emoji={emoji}
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

      {/* Product grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, paddingBottom: cartCount > 0 ? 88 : 8 }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: '#6B7280', fontFamily: "'Source Sans 3', sans-serif" }}>
            No products found{search ? ` for "${search}"` : ''}.
          </div>
        ) : (
          filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              inCart={cartMap.has(p.id)}
              onAddToQuote={handleAdd}
            />
          ))
        )}
      </div>

      {/* Card hover polish */}
      <style>{`
        .prod-card { transition: transform .15s ease, box-shadow .15s ease; }
        .prod-card:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(8,42,56,.12); }
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
              background: '#ECFEFF', color: '#0E7490',
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
              <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: '#164E63' }}>
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
