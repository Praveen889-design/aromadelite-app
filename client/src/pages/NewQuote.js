import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useQuoteBuilder } from '../context/QuoteBuilderContext';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import ProductCard, { lookupClientPrice } from '../components/quote/ProductCard';
import CartItem from '../components/quote/CartItem';
import ClientModal from '../components/quote/ClientModal';
import EmptyState from '../components/EmptyState';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// Without-GST quotes carry no GST; the base price is uplifted by this flat
// markup instead. Must mirror the server (quotes.js / bills.js).
const WITHOUT_GST_MARKUP = 0.05; // +5%

export default function NewQuote() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { items, totals, addItem, updateItem, removeItem, clearCart, client, setClient } = useQuoteBuilder();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // stockMap: product_id (number) → available qty; product_name (lowercase) → available qty
  // null means stock data not available (no units in region)
  const [stockMap, setStockMap] = useState(null);

  // Onboarded-client price map: `${product_id}::${pack_size}` → last billed base price.
  // null = client not onboarded (or no client selected yet) → system prices apply.
  const [clientPrices, setClientPrices] = useState(null);

  const [gstMode, setGstMode] = useState('with_gst');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false); // mobile cart bottom sheet
  // Add to cart WITHOUT blocking the page — a toast confirms and the floating
  // cart bar tracks the count; the user opens the cart sheet only when ready.
  const handleAddToCart = useCallback((item) => {
    addItem(item);
    toast(`${item.product_name} added to quote`, { kind: 'success' });
  }, [addItem, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Only fetch stock for regional employees (not admins)
        const region = user?.region;
        const requests = [
          api.get('/api/products'),
          api.get('/api/products/categories'),
          region ? api.get(`/api/units/region-stock?region=${encodeURIComponent(region)}`) : Promise.resolve(null),
        ];
        const [pRes, cRes, sRes] = await Promise.all(requests);
        if (cancelled) return;
        setProducts(pRes.data.products || []);
        setCategories((cRes.data.categories || []).filter(c => Number(c.product_count) > 0));
        // Build dual-key lookup only for regional employees
        if (sRes?.data?.stock) {
          const map = {};
          for (const s of sRes.data.stock) {
            const qty = Number(s.available_qty) || 0;
            if (s.product_id) map[`id:${s.product_id}`] = qty;
            map[`name:${(s.product_name || '').toLowerCase().trim()}`] = qty;
          }
          setStockMap(map);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e?.response?.data?.error || 'Failed to load catalog');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the client's billed-price history whenever the selected client changes.
  // Only onboarded clients (≥1 bill) return a price map; everyone else gets null.
  useEffect(() => {
    const phone = (client?.client_phone || '').trim();
    const biz   = (client?.client_business_name || '').trim();
    if (!phone && !biz) { setClientPrices(null); return; }
    let cancelled = false;
    api.get('/api/clients/client-prices', { params: { phone, business: biz } })
      .then(({ data }) => {
        if (!cancelled) setClientPrices(data.onboarded && Object.keys(data.prices || {}).length ? data.prices : null);
      })
      .catch(() => { if (!cancelled) setClientPrices(null); });
    return () => { cancelled = true; };
  }, [client?.client_phone, client?.client_business_name]);

  const cartKeys = useMemo(() => {
    const s = new Set();
    for (const it of items) s.add(`${it.product_id}|${it.variant || ''}|${it.pack_size || ''}`);
    return s;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat !== 'all' && p.category_id !== activeCat) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, activeCat, search]);

  // Count how many visible products can still be added (default = 1 unit, no pack size)
  const addableCount = useMemo(() => filtered.filter((p) => {
    const firstVariant = (p.variants || [])[0] || null;
    return !cartKeys.has(`${p.id}|${firstVariant || ''}|`);
  }).length, [filtered, cartKeys]);

  // Add all visible products at 1-unit (base_price) — Select All defaults to per-unit pricing.
  // Onboarded clients get their last billed price (lower of billed vs system).
  const addAllVisible = useCallback(() => {
    let added = 0;
    for (const p of filtered) {
      const firstVariant = (p.variants || [])[0] || null;
      if (cartKeys.has(`${p.id}|${firstVariant || ''}|`)) continue;
      const sysPrice    = p.base_price || 0;
      const cliPrice    = lookupClientPrice(clientPrices, p.id, '', p.unit);
      const hasCliPrice = cliPrice !== null && cliPrice > 0;
      const price       = hasCliPrice ? Math.min(cliPrice, sysPrice) : sysPrice;
      addItem({
        product_id:    p.id,
        product_name:  p.name,
        description:   p.description || null,
        category_id:   p.category_id,
        category_name: p.category_name,
        variant:       firstVariant,
        pack_size:     '',          // base unit — no bulk pack size
        quantity:      1,
        unit_price:    price,
        system_price:  hasCliPrice ? price : sysPrice,
        gst_percent:   p.gst_percent,
        hsn_code:      p.hsn_code,
      });
      added++;
    }
    if (added > 0) toast(`Added ${added} product${added !== 1 ? 's' : ''} to quote.`, { kind: 'success' });
    else toast('All visible products are already in the quote.', { kind: 'info' });
  }, [filtered, cartKeys, addItem, toast, clientPrices]);

  // GST breakdown — dynamic, supports all GST rates (0, 3, 5, 12, 18, 28%)
  const gstBreakdown = useMemo(() => {
    const buckets = {};
    for (const it of items) {
      const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      const r = Number(it.gst_percent) || 0;
      if (!buckets[r]) buckets[r] = { base: 0, gst: 0 };
      buckets[r].base += line;
      buckets[r].gst += (line * r) / 100;
    }
    return buckets;
  }, [items]);

  const onGenerate = async (clientPayload) => {
    setSubmitting(true);
    try {
      setClient(clientPayload);
      const payload = {
        client_name: clientPayload.client_name,
        client_business_name: clientPayload.client_business_name,
        client_type: clientPayload.client_type,
        client_phone: clientPayload.client_phone,
        client_email: clientPayload.client_email || null,
        client_city: clientPayload.client_city,
        requirement_type: clientPayload.requirement_type,
        validity_days: clientPayload.validity_days || 30,
        notes: clientPayload.notes || null,
        next_follow_up_date: clientPayload.next_follow_up_date || null,
        expected_order_date: clientPayload.expected_order_date || null,
        gst_mode: gstMode,
        items: items.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          variant: it.variant,
          pack_size: it.pack_size,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          system_price: Number(it.system_price) || Number(it.unit_price) || 0,
          gst_percent: Number(it.gst_percent) || 0,
        })),
      };

      const { data } = await api.post('/api/quotes', payload);

      // If the user picked "sent" instead of draft, fire the status update.
      if (clientPayload.status === 'sent' && data?.quote?.id) {
        try {
          await api.patch(`/api/quotes/${data.quote.id}/status`, { status: 'sent' });
        } catch {
          // non-fatal — quote already exists as draft
        }
      }

      toast(`Quote ${data.quote.quote_number} created.`, { kind: 'success' });
      clearCart();
      setModalOpen(false);
      navigate(`/quotes/${data.quote.id}`);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to create quote', { kind: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* LEFT PANEL — Product Browser */}
      <section className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-4">
        {/* Onboarded client banner */}
        {clientPrices && (
          <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2"
               style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
            <span style={{ fontSize: 16 }}>🔒</span>
            <div className="text-xs" style={{ color: '#4338ca' }}>
              <strong>Onboarded client:</strong>{' '}
              {client?.client_business_name || client?.client_name} — previously billed prices are applied
              automatically for repeat products. New products use current system prices.
            </div>
          </div>
        )}
        {/* Search + Add-All bar */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name…"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
          />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {filtered.length} of {products.length}
            </span>
            {!loading && addableCount > 0 && (
              <button
                type="button"
                onClick={addAllVisible}
                title={`Add all ${addableCount} product${addableCount !== 1 ? 's' : ''} in current view to the quote with Qty 1`}
                className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Select All ({addableCount})
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="mt-3 -mx-1 px-1 relative">
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex gap-1.5 min-w-full pb-1">
              <CategoryTab active={activeCat === 'all'} onClick={() => setActiveCat('all')}>All</CategoryTab>
              {categories.map((c) => (
                <CategoryTab
                  key={c.id}
                  active={activeCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                >
                  <span className="mr-1">{c.icon_emoji}</span>{c.name}
                  <span className="ml-1 text-[10px] opacity-75">({c.product_count})</span>
                </CategoryTab>
              ))}
            </div>
          </div>
          {/* Fade-right hint */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-r from-transparent to-white" />
        </div>

        {/* Quick-quote hint banner when a category is selected */}
        {!loading && activeCat !== 'all' && filtered.length > 0 && (
          <div className="mt-2 flex items-center justify-between gap-3 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
            <p className="text-xs text-cyan-700">
              <span className="font-semibold">Quick quote:</span> Hit <strong>Select All</strong> to add all {filtered.length} products in this category at Qty 1, then click <strong>Generate Quote</strong>.
            </p>
            {addableCount > 0 && (
              <button
                type="button"
                onClick={addAllVisible}
                className="shrink-0 text-xs font-semibold px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors"
              >
                Select All
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-sm text-slate-500">Loading catalog…</div>
        ) : loadError ? (
          <div className="mt-6 text-sm text-rose-600">{loadError}</div>
        ) : filtered.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon="search"
              title="No products match"
              hint="Try clearing the search or switching to a different category."
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                inCart={cartKeys}
                onAdd={handleAddToCart}
                clientPrices={clientPrices}
                stockQty={
                  stockMap === null
                    ? null  // no stock data for this region
                    : (stockMap[`id:${p.id}`] ??
                       stockMap[`name:${(p.name || '').toLowerCase().trim()}`] ??
                       0)
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Mobile cart trigger pill */}
      {items.length > 0 && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="lg:hidden fixed left-4 right-4 bottom-16 z-30 text-white rounded-xl shadow-lg px-4 py-3 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #2563EB, #06B6D4)', boxShadow: '0 8px 22px rgba(37,99,235,.4)' }}
        >
          <span className="flex items-center gap-2 font-semibold">
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{totals.line_count}</span>
            View cart
          </span>
          <span className="font-bold">{formatINR(totals.total_amount)}</span>
        </button>
      )}

      {/* RIGHT PANEL / BOTTOM SHEET — Cart */}
      {sheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/40"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={[
          'lg:col-span-2 bg-white rounded-xl border border-slate-200 flex flex-col lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)]',
          // Mobile: bottom sheet
          'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:rounded-b-none max-lg:rounded-t-2xl max-lg:max-h-[80vh]',
          'max-lg:transition-transform max-lg:duration-200',
          sheetOpen ? 'max-lg:translate-y-0' : 'max-lg:translate-y-full',
        ].join(' ')}
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between"
             style={{ background: 'linear-gradient(135deg, #EFF6FF, #ECFEFF)' }}>
          <div className="flex items-center gap-2.5">
            <span style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #2563EB, #06B6D4)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(37,99,235,.3)' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11.2A2 2 0 0 0 9.5 17H17a2 2 0 0 0 2-1.6L21 8H6"/></svg>
            </span>
            <h2 className="font-extrabold" style={{ color: '#0F2B3A', fontSize: 15 }}>Quote Builder</h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#2563EB', color: '#fff' }}>
              {totals.line_count} {totals.line_count === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => { if (window.confirm('Clear all items?')) clearCart(); }}
                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600"
              >Clear</button>
            )}
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-700 text-xl leading-none"
              aria-label="Close cart"
            >×</button>
          </div>
        </div>

        {/* GST Mode Toggle */}
        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-600 shrink-0">GST Mode:</span>
          <div className="flex rounded-lg border border-slate-300 overflow-hidden text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setGstMode('with_gst')}
              className={gstMode === 'with_gst'
                ? 'px-3 py-1.5 bg-blue-600 text-white'
                : 'px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-50'}
            >With GST</button>
            <button
              type="button"
              onClick={() => setGstMode('without_gst')}
              className={gstMode === 'without_gst'
                ? 'px-3 py-1.5 bg-amber-500 text-white'
                : 'px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-50 border-l border-slate-300'}
            >Without GST</button>
          </div>
          {gstMode === 'without_gst' && (
            <span className="text-[10px] text-amber-600 italic">+5% applied · no GST</span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {items.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-12 px-4">
              No items yet. Pick products from the left to start building this quote.
            </div>
          ) : (
            items.map((it, i) => (
              <CartItem key={i} item={it} index={i} onUpdate={updateItem} onRemove={removeItem} />
            ))
          )}
        </div>

        <div className="border-t border-slate-200 p-4 space-y-2 bg-slate-50/50">
          {gstMode === 'with_gst' ? (
            <>
              <SummaryRow label="Subtotal (excl. GST)" value={formatINR(totals.subtotal)} />
              {Object.entries(gstBreakdown)
                .filter(([, v]) => v.base > 0)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([rate, v]) => (
                  <SummaryRow
                    key={rate}
                    label={`GST ${rate}% on ${formatINR(v.base)}`}
                    value={formatINR(v.gst)}
                    muted
                  />
                ))}
            </>
          ) : (
            <>
              <SummaryRow label="Subtotal (base price)" value={formatINR(totals.subtotal)} />
              <SummaryRow
                label="Markup (+5%)"
                value={`+${formatINR(+(totals.subtotal * WITHOUT_GST_MARKUP).toFixed(2))}`}
                muted
              />
            </>
          )}
          <div className="flex items-baseline justify-between pt-2 border-t border-slate-200">
            <span className="text-sm font-medium text-slate-700">Grand Total</span>
            <span className="text-2xl font-bold text-slate-900">
              {formatINR(gstMode === 'without_gst'
                ? +(totals.subtotal * (1 + WITHOUT_GST_MARKUP)).toFixed(2)
                : totals.total_amount)}
            </span>
          </div>
          {/* Discount warning */}
          {items.some(it => {
            const sys = Number(it.system_price) || 0;
            const qp  = Number(it.unit_price)   || 0;
            return sys > 0 && qp < sys && ((sys - qp) / sys * 100) > 10;
          }) && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1 flex items-center gap-2">
              <span>⚠️</span>
              <span><strong>Discount &gt;10%</strong> — admin approval required before sending.</span>
            </div>
          )}
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => setModalOpen(true)}
            className="w-full mt-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition-colors"
          >
            Generate Quote
          </button>
        </div>
      </aside>

      <ClientModal
        open={modalOpen}
        initial={client}
        submitting={submitting}
        onClose={() => !submitting && setModalOpen(false)}
        onSubmit={onGenerate}
      />
    </div>
  );
}

const CategoryTab = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full border transition-colors',
      active
        ? 'bg-cyan-600 text-white border-cyan-600'
        : 'bg-white text-slate-600 border-slate-300 hover:border-cyan-400',
    ].join(' ')}
  >{children}</button>
);

const SummaryRow = ({ label, value, muted }) => (
  <div className={['flex items-baseline justify-between text-sm',
    muted ? 'text-slate-500' : 'text-slate-700'].join(' ')}>
    <span>{label}</span>
    <span className={muted ? '' : 'font-medium'}>{value}</span>
  </div>
);
