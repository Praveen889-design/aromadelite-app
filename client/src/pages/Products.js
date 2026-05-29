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

function ProductCard({ product, inCart, cartQty, onAddToQuote, onQtyChange }) {
  const [selVariant, setSelVariant] = useState(0);

  const emoji = CATEGORY_EMOJI[product.category_name] || '📦';
  const rawPacks = product.packs || [];
  const variants = product.variants || [];
  // Same logic as ProductCard: move existing 1-unit pack to front, or prepend virtual one
  const baseLabel = baseUnitLabel(product.unit);
  const isOneUnit = (s) => Math.abs(calcPackPrice(s.size, 1, product.unit) - 1) < 0.01;
  const oneUnitPacks = rawPacks.filter(isOneUnit);
  const bulkPacks    = rawPacks.filter(s => !isOneUnit(s));
  const packs = rawPacks.length > 0
    ? oneUnitPacks.length > 0
      ? [...oneUnitPacks, ...bulkPacks]
      : [{ size: baseLabel, price: 0, isBase: true }, ...rawPacks]
    : [];
  const activePack = packs[0] || {};
  const price = calcPackPrice(activePack.size, product.base_price, product.unit);

  const formatINR = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div style={{
      position: 'relative',
      background: '#FFFFFF',
      border: `1px solid ${inCart ? '#059669' : '#A5F3FC'}`,
      borderRadius: 16,
      padding: 12,
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: inCart ? '0 4px 12px rgba(5,150,105,.12)' : '0 2px 6px rgba(8,42,56,.03)',
      overflow: 'hidden', minWidth: 0,
    }}>
      {/* Added badge */}
      {inCart && (
        <div style={{
          position: 'absolute', top: -6, right: -6,
          width: 22, height: 22, borderRadius: '50%',
          background: '#059669', color: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #FFFFFF',
          boxShadow: '0 2px 6px rgba(5,150,105,.40)',
        }}><CheckIcon /></div>
      )}

      {/* Category */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
        <span style={{
          fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 10,
          color: '#0E7490', letterSpacing: '.08em', textTransform: 'uppercase',
        }}>{product.category_name || 'Product'}</span>
      </div>

      {/* Name */}
      <div style={{
        fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 15,
        color: '#164E63', lineHeight: 1.2, letterSpacing: '-.01em',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', minHeight: 36,
      }}>{product.name}</div>

      {/* Variants */}
      {variants.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflow: 'hidden' }}>
          {variants.slice(0, 3).map((v, i) => (
            <VariantPill key={i} active={i === selVariant} onClick={() => setSelVariant(i)}>
              {v}
            </VariantPill>
          ))}
        </div>
      )}

      {/* Pack/price selector */}
      {packs.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#ECFEFF', border: '1px solid #A5F3FC',
          borderRadius: 8, padding: '6px 10px', height: 32,
        }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 12, color: '#164E63' }}>
            {activePack.size || activePack.label} · <span style={{ fontWeight: 600 }}>{formatINR(price)}</span>
          </div>
          {packs.length > 1 && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0E7490" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          )}
        </div>
      )}

      {/* Qty stepper (if in cart) */}
      {inCart && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            border: '1.2px solid #A5F3FC', borderRadius: 8, background: '#FFFFFF', height: 28,
          }}>
            <button onClick={() => onQtyChange(product.id, Math.max(1, cartQty - 1))} style={qtyBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h14"/></svg>
            </button>
            <div style={{ width: 28, textAlign: 'center', fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 13, color: '#164E63', borderLeft: '1px solid #ECFEFF', borderRight: '1px solid #ECFEFF', lineHeight: '26px' }}>
              {cartQty}
            </div>
            <button onClick={() => onQtyChange(product.id, cartQty + 1)} style={qtyBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Add/Added button */}
      {inCart ? (
        <button onClick={() => onAddToQuote(product, activePack)} style={{
          height: 36, borderRadius: 8,
          background: '#FFFFFF', border: '1.5px solid #059669', color: '#059669',
          fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          cursor: 'pointer',
        }}>
          Added <CheckIcon />
        </button>
      ) : (
        <button onClick={() => onAddToQuote(product, activePack)} style={{
          height: 36, borderRadius: 8,
          background: '#059669', border: 0, color: '#FFFFFF',
          fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13,
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(5,150,105,.22)',
        }}>Add to Quote</button>
      )}
    </div>
  );
}

const qtyBtn = {
  border: 0, background: 'transparent',
  width: 28, height: 26, color: '#0E7490',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

export default function Products() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { items, addItem, updateItem } = useQuoteBuilder();

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

  const handleAdd = (product, pack) => {
    const existing = cartMap.get(product.id);
    if (existing) {
      toast('Already in quote — adjust qty in cart', 'info');
      return;
    }
    addItem({
      product_id: product.id,
      product_name: product.name,
      category_name: product.category_name,
      pack_size: (pack?.isBase ? '' : (pack?.size || pack?.label || '')),
      unit_price: calcPackPrice(pack?.size, product.base_price, product.unit),
      gst_rate: product.gst_rate || 18,
      qty: 1,
    });
    toast(`${product.name} added to quote`, 'success');
  };

  const handleQtyChange = (productId, newQty) => {
    updateItem(productId, newQty);
  };

  const cartCount = items.length;
  const cartTotal = items.reduce((s, i) => s + (i.unit_price || 0) * (i.qty || 1), 0);

  if (loading) return <div className="space-y-4"><SkeletonCards n={6} /></div>;

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, paddingBottom: cartCount > 0 ? 80 : 8 }}>
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
              cartQty={cartMap.get(p.id)?.qty || 1}
              onAddToQuote={handleAdd}
              onQtyChange={handleQtyChange}
            />
          ))
        )}
      </div>

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
