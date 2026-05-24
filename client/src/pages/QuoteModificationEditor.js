import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../components/Toast';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const computeTotals = (items) => {
  let subtotal = 0, gst_amount = 0;
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    subtotal += line;
    gst_amount += (line * (Number(it.gst_percent) || 0)) / 100;
  }
  return {
    subtotal: +subtotal.toFixed(2),
    gst_amount: +gst_amount.toFixed(2),
    total_amount: +(subtotal + gst_amount).toFixed(2),
  };
};

/* ── Trash icon ─────────────────────────────────────────────── */
const TrashIcon = (p) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
const PlusIcon = (p) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.5" strokeLinecap="round" {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/* ── Inline editable item row ───────────────────────────────── */
function ItemRow({ item, index, onUpdate, onRemove }) {
  const qty        = Number(item.quantity) || 0;
  const price      = Number(item.unit_price) || 0;
  const sysPrice   = Number(item.system_price) || price;
  const hasDisc    = price < sysPrice && sysPrice > 0;
  const discPct    = hasDisc ? Math.round(((sysPrice - price) / sysPrice) * 100) : 0;
  const lineTotal  = qty * price;

  return (
    <div style={{
      border: `1px solid ${hasDisc ? '#6ee7b7' : '#e2e8f0'}`,
      borderRadius: 10,
      padding: '10px 12px',
      background: hasDisc ? '#f0fdf4' : '#fff',
      marginBottom: 8,
    }}>
      {/* Name + remove */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{item.product_name}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {[item.variant, item.pack_size].filter(Boolean).join(' · ')}
            {item.gst_percent ? ` · GST ${item.gst_percent}%` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6 }}
          title="Remove item"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Catalog price hint */}
      {sysPrice > 0 && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Catalog: {formatINR(sysPrice)}</span>
          {hasDisc && (
            <span style={{ background: '#d1fae5', color: '#065f46', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99 }}>
              {discPct}% off
            </span>
          )}
        </div>
      )}

      {/* Price + qty inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Client Price (₹)</div>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => onUpdate(index, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
            style={{
              width: '100%', border: `1.5px solid ${hasDisc ? '#6ee7b7' : '#cbd5e1'}`,
              borderRadius: 7, padding: '6px 9px', fontSize: 13, fontWeight: 600,
              color: hasDisc ? '#065f46' : '#0f172a', background: hasDisc ? '#f0fdf4' : '#fff',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Quantity</div>
          <div style={{ display: 'flex', border: '1.5px solid #cbd5e1', borderRadius: 7, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => onUpdate(index, { quantity: Math.max(1, qty - 1) })}
              style={{ padding: '6px 10px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontSize: 16, color: '#475569' }}
            >−</button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => onUpdate(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
              style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, border: 'none', outline: 'none', minWidth: 0, background: '#fff' }}
            />
            <button
              type="button"
              onClick={() => onUpdate(index, { quantity: qty + 1 })}
              style={{ padding: '6px 10px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontSize: 16, color: '#475569' }}
            >+</button>
          </div>
        </div>
      </div>

      {/* Line total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
        <span style={{ color: '#64748b' }}>{qty} × {formatINR(price)}</span>
        <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatINR(lineTotal)}</span>
      </div>
    </div>
  );
}

/* ── Product search mini-card ───────────────────────────────── */
function ProductPickCard({ product, onAdd, alreadyAdded }) {
  const firstSize    = (product.pack_sizes || [])[0];
  if (!firstSize) return null;
  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 9, padding: '9px 11px',
      background: alreadyAdded ? '#f8fafc' : '#fff',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{product.name}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          {firstSize.size} · {formatINR(firstSize.price)} · GST {product.gst_percent}%
        </div>
      </div>
      <button
        type="button"
        onClick={() => !alreadyAdded && onAdd(product)}
        disabled={alreadyAdded}
        style={{
          padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
          border: 'none', cursor: alreadyAdded ? 'default' : 'pointer',
          background: alreadyAdded ? '#f1f5f9' : '#0ea5e9',
          color: alreadyAdded ? '#94a3b8' : '#fff',
          whiteSpace: 'nowrap',
        }}
      >
        {alreadyAdded ? 'Added' : '+ Add'}
      </button>
    </div>
  );
}

/* ══ Main Editor ══════════════════════════════════════════════ */
export default function QuoteModificationEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading]         = useState(true);
  const [quoteData, setQuoteData]     = useState(null);
  const [items, setItems]             = useState([]);
  const [note, setNote]               = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [products, setProducts]       = useState([]);
  const [catSearch, setCatSearch]     = useState('');
  const [catLoading, setCatLoading]   = useState(false);

  /* ── Load quote ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/quotes/${id}/pdf-data`);
        const pdf = res.data.pdf;
        setQuoteData(pdf);

        // Pre-load with modified_items if they exist (re-editing a rejection), else original
        const seed = pdf.modified_items || pdf.items || [];
        setItems(seed.map((it) => ({
          product_id:   it.product_id,
          product_name: it.product_name,
          variant:      it.variant || null,
          pack_size:    it.pack_size || null,
          quantity:     Number(it.quantity) || 1,
          unit_price:   Number(it.unit_price) || 0,
          system_price: Number(it.system_price) || Number(it.unit_price) || 0,
          gst_percent:  Number(it.gst_percent) || 0,
          hsn_code:     it.hsn_code || null,
          unit:         it.unit || 'Nos',
          category_name: it.category_name || 'Items',
          category_icon: it.category_icon || null,
        })));

        // Pre-fill note if previous modification had a note
        if (pdf.quote.modification_note) setNote(pdf.quote.modification_note);
      } catch (e) {
        toast(e?.response?.data?.error || 'Failed to load quote', { kind: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load products for catalog ── */
  const loadProducts = useCallback(async () => {
    if (products.length > 0) return;
    setCatLoading(true);
    try {
      const res = await api.get('/api/products');
      setProducts(res.data.products || []);
    } catch {
      toast('Failed to load product catalog', { kind: 'error' });
    } finally {
      setCatLoading(false);
    }
  }, [products.length, toast]);

  const openCatalog = () => {
    setShowCatalog(true);
    loadProducts();
  };

  /* ── Item helpers ── */
  const updateItem = (idx, patch) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const removeItem = (idx) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  /* ── Add product from catalog ── */
  const addFromCatalog = (product) => {
    const firstSize = (product.pack_sizes || [])[0];
    if (!firstSize) return;
    const key = `${product.id}|${(product.variants || [])[0] || ''}|${firstSize.size}`;
    const exists = items.some((it) =>
      `${it.product_id}|${it.variant || ''}|${it.pack_size || ''}` === key
    );
    if (exists) { toast('Already in the list', { kind: 'info' }); return; }
    setItems((prev) => [...prev, {
      product_id:   product.id,
      product_name: product.name,
      variant:      (product.variants || [])[0] || null,
      pack_size:    firstSize.size,
      quantity:     1,
      unit_price:   firstSize.price,
      system_price: firstSize.price,
      gst_percent:  product.gst_percent || 18,
      hsn_code:     product.hsn_code || null,
      unit:         product.unit || 'Nos',
      category_name: product.category_name || 'Items',
      category_icon: product.category_icon || null,
    }]);
    toast(`${product.name} added.`, { kind: 'success' });
  };

  /* ── Totals ── */
  const totals = useMemo(() => computeTotals(items), [items]);

  /* ── Submit for approval ── */
  const onSubmit = async () => {
    if (items.length === 0) { toast('Add at least one item', { kind: 'error' }); return; }
    setSubmitting(true);
    try {
      await api.patch(`/api/quotes/${id}/modification`, {
        items: items.map((it) => ({
          product_id:   it.product_id,
          product_name: it.product_name,
          variant:      it.variant || null,
          pack_size:    it.pack_size || null,
          quantity:     Number(it.quantity) || 1,
          unit_price:   Number(it.unit_price) || 0,
          system_price: Number(it.system_price) || Number(it.unit_price) || 0,
          gst_percent:  Number(it.gst_percent) || 0,
          hsn_code:     it.hsn_code || null,
          unit:         it.unit || 'Nos',
          category_name: it.category_name || 'Items',
          category_icon: it.category_icon || null,
        })),
        modification_note: note.trim() || null,
      });
      toast('Modification submitted for Admin approval! ✅', { kind: 'success' });
      navigate(`/quotes/${id}`);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to submit modification', { kind: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Filtered catalog ── */
  const filteredCatalog = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, catSearch]);

  const addedKeys = useMemo(() => {
    const s = new Set();
    for (const it of items) s.add(`${it.product_id}|${it.variant || ''}|${it.pack_size || ''}`);
    return s;
  }, [items]);

  /* ─── Render ─────────────────────────────────────────────── */
  if (loading) return <div style={{ padding: 24, fontSize: 14, color: '#64748b' }}>Loading quote…</div>;
  if (!quoteData) return <div style={{ padding: 24, fontSize: 14, color: '#dc2626' }}>Quote not found.</div>;

  const { quote, client } = quoteData;

  if (quote.status !== 'modifications_required') {
    return (
      <div style={{ padding: 24, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, fontSize: 14, color: '#991b1b' }}>
        This quote is not in "Modifications Required" status.{' '}
        <Link to={`/quotes/${id}`} style={{ color: '#1F6BC7', textDecoration: 'underline' }}>Go back</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link
          to={`/quotes/${id}`}
          style={{ color: '#64748b', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
        >
          ← Back
        </Link>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            ✏️ Edit & Resubmit Quote
          </h2>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {quote.number} · {client.business_name || client.name}
          </div>
        </div>
      </div>

      {/* ── Admin rejection note (if re-editing) ── */}
      {quote.admin_note && quote.modification_status === 'rejected' && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
          padding: '10px 14px', marginBottom: 14, fontSize: 13,
        }}>
          <span style={{ fontWeight: 700, color: '#dc2626' }}>❌ Admin Rejected: </span>
          <span style={{ color: '#7f1d1d' }}>{quote.admin_note}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
        {/* LEFT: items list */}
        <div>

          {/* Items */}
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '14px 14px 10px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                Items ({items.length})
              </div>
              <button
                type="button"
                onClick={openCatalog}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <PlusIcon /> Add Product
              </button>
            </div>

            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
                No items. Click "Add Product" to start.
              </div>
            ) : (
              items.map((item, idx) => (
                <ItemRow
                  key={idx}
                  item={item}
                  index={idx}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                />
              ))
            )}
          </div>

          {/* Note to admin */}
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '12px 14px',
          }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              📝 Note to Admin (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Explain the client's request (e.g. client asked for 10% discount on chemical items)…"
              style={{
                width: '100%', border: '1.5px solid #cbd5e1', borderRadius: 8,
                padding: '8px 10px', fontSize: 13, resize: 'vertical',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                color: '#0f172a',
              }}
            />
          </div>
        </div>

        {/* RIGHT: sticky summary + submit */}
        <div style={{ minWidth: 200, position: 'sticky', top: 16 }}>
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Summary
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              Subtotal
              <span style={{ float: 'right', color: '#0f172a', fontWeight: 600 }}>{formatINR(totals.subtotal)}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              GST
              <span style={{ float: 'right', color: '#0f172a', fontWeight: 600 }}>{formatINR(totals.gst_amount)}</span>
            </div>
            <div style={{
              fontSize: 14, fontWeight: 900, color: '#0f172a',
              borderTop: '2px solid #f1f5f9', paddingTop: 8,
            }}>
              Total
              <span style={{ float: 'right', color: '#1F6BC7' }}>{formatINR(totals.total_amount)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || items.length === 0}
            style={{
              marginTop: 10, width: '100%', padding: '12px 0',
              background: submitting ? '#93c5fd' : 'linear-gradient(135deg, #1F6BC7, #1558a8)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 800, cursor: submitting || items.length === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: 0.3,
            }}
          >
            {submitting ? 'Submitting…' : '📤 Submit for Approval'}
          </button>

          <Link
            to={`/quotes/${id}`}
            style={{
              display: 'block', textAlign: 'center', marginTop: 8,
              fontSize: 12, color: '#64748b', textDecoration: 'none',
            }}
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* ── Catalog picker drawer ── */}
      {showCatalog && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCatalog(false); }}
        >
          <div style={{
            background: '#fff', borderRadius: '18px 18px 0 0',
            width: '100%', maxWidth: 640, maxHeight: '75vh',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Drawer header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px 10px',
              borderBottom: '1px solid #f1f5f9',
            }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Add Products</div>
              <button
                type="button"
                onClick={() => setShowCatalog(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 700 }}
              >
                Done
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: '10px 16px 6px' }}>
              <input
                type="search"
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder="Search products…"
                autoFocus
                style={{
                  width: '100%', border: '1.5px solid #cbd5e1', borderRadius: 9,
                  padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Product list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 16px 16px' }}>
              {catLoading ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>Loading catalog…</div>
              ) : filteredCatalog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>No products found.</div>
              ) : (
                filteredCatalog.map((p) => {
                  const firstSize = (p.pack_sizes || [])[0];
                  if (!firstSize) return null;
                  const key = `${p.id}|${(p.variants || [])[0] || ''}|${firstSize.size}`;
                  return (
                    <ProductPickCard
                      key={p.id}
                      product={p}
                      onAdd={addFromCatalog}
                      alreadyAdded={addedKeys.has(key)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
