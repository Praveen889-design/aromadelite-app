import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../components/Toast';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

// Without-GST invoices carry no GST; base subtotal is uplifted by this markup.
// Must mirror the server (bills.js / quotes.js).
const WITHOUT_GST_MARKUP = 0.05; // +5%

const computeTotals = (items, gst_mode) => {
  let subtotal = 0, gst_amount = 0;
  if (gst_mode === 'without_gst') {
    for (const it of items) subtotal += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    return { subtotal: +subtotal.toFixed(2), gst_amount: 0, total_amount: +(subtotal * (1 + WITHOUT_GST_MARKUP)).toFixed(2) };
  }
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    subtotal += line;
    gst_amount += (line * (Number(it.gst_percent) || 0)) / 100;
  }
  return { subtotal: +subtotal.toFixed(2), gst_amount: +gst_amount.toFixed(2), total_amount: +(subtotal + gst_amount).toFixed(2) };
};

const UNITS = ['Nos', 'Ltr', 'Kg', 'Box', 'Pcs', 'Mtr', 'Set', 'Pair'];
const GST_RATES = [0, 5, 12, 18, 28];

const emptyCustom = { name: '', hsn_code: '', unit: 'Nos', quantity: 1, unit_price: '', gst_percent: 18 };

export default function BillBuilder() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(null);
  const [items, setItems] = useState([]);
  const [gstMode, setGstMode] = useState('with_gst');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Client extra fields (can be edited)
  const [clientExtra, setClientExtra] = useState({
    client_gstin: '',
    client_state: '36-Telangana',
    place_of_supply: '36-Telangana',
  });

  // Add-item panel
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addMode, setAddMode] = useState('catalog'); // 'catalog' | 'custom'
  const [products, setProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [customItem, setCustomItem] = useState(emptyCustom);

  /* ─── Load quote ─── */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/quotes/${quoteId}/pdf-data`);
        const pdf = res.data.pdf;
        setQuote(pdf);
        // If admin approved a modification, bill should use modified items
        const sourceItems =
          pdf.quote.modification_status === 'approved' && pdf.modified_items?.length
            ? pdf.modified_items
            : pdf.items || [];
        setItems(sourceItems.map((it) => ({
          ...it,
          base_price: it.unit_price,
        })));
        setNotes(pdf.quote.notes || '');
      } catch (e) {
        toast(e?.response?.data?.error || 'Failed to load quote', { kind: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [quoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Load products (lazy, on panel open) ─── */
  const loadProducts = async () => {
    if (productsLoaded) return;
    try {
      const res = await api.get('/api/products');
      // Flatten pack sizes into individual entries for easy selection
      const flat = [];
      for (const p of (res.data.products || [])) {
        const packs = Array.isArray(p.pack_sizes) ? p.pack_sizes : [];
        if (packs.length > 0) {
          for (const ps of packs) {
            flat.push({
              product_id: p.id,
              product_name: ps.size ? `${p.name} [${ps.size}]` : p.name,
              display_name: p.name,
              pack_size: ps.size || null,
              hsn_code: p.hsn_code || '',
              unit: ps.unit || p.unit || 'Nos',
              base_price: ps.price || p.base_price || 0,
              gst_percent: p.gst_percent || 18,
              category_name: p.category_name || '',
            });
          }
        } else {
          flat.push({
            product_id: p.id,
            product_name: p.name,
            display_name: p.name,
            pack_size: null,
            hsn_code: p.hsn_code || '',
            unit: p.unit || 'Nos',
            base_price: p.base_price || 0,
            gst_percent: p.gst_percent || 18,
            category_name: p.category_name || '',
          });
        }
      }
      setProducts(flat);
      setProductsLoaded(true);
    } catch {
      toast('Failed to load products', { kind: 'error' });
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return p.product_name.toLowerCase().includes(q) || p.category_name.toLowerCase().includes(q) || (p.hsn_code || '').includes(q);
  });

  /* ─── GST mode change ─── */
  // unit_price is ALWAYS the base price in both modes. GST (with_gst) or the
  // flat +5% markup (without_gst) is applied only when totals are computed.
  const handleGstModeChange = (mode) => {
    setGstMode(mode);
    setItems((prev) => prev.map((it) => ({ ...it, unit_price: it.base_price })));
  };

  /* ─── Item editing ─── */
  const updateItem = (idx, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      const updated = { ...copy[idx], [field]: value };
      if (field === 'unit_price') {
        updated.base_price = Number(value); // unit_price IS the base price
      }
      copy[idx] = updated;
      return copy;
    });
  };

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  /* ─── Add from catalog ─── */
  const addCatalogItem = (prod) => {
    const baseP = prod.base_price;
    const gst   = prod.gst_percent;
    const newItem = {
      product_id:   prod.product_id,
      product_name: prod.product_name,
      hsn_code:     prod.hsn_code,
      unit:         prod.unit,
      pack_size:    prod.pack_size,
      variant:      null,
      quantity:     1,
      unit_price:   baseP,
      base_price:   baseP,
      gst_percent:  gst,
    };
    setItems((prev) => [...prev, newItem]);
    toast(`${prod.display_name} added.`, { kind: 'success' });
  };

  /* ─── Add custom item ─── */
  const addCustomItem = () => {
    if (!customItem.name.trim()) { toast('Item name is required', { kind: 'error' }); return; }
    if (!customItem.unit_price || Number(customItem.unit_price) <= 0) { toast('Enter a valid price', { kind: 'error' }); return; }
    const baseP = Number(customItem.unit_price);
    const newItem = {
      product_id:   null,
      product_name: customItem.name.trim(),
      hsn_code:     customItem.hsn_code.trim() || null,
      unit:         customItem.unit,
      pack_size:    null,
      variant:      null,
      quantity:     Number(customItem.quantity) || 1,
      unit_price:   Number(customItem.unit_price),
      base_price:   baseP,
      gst_percent:  Number(customItem.gst_percent),
    };
    setItems((prev) => [...prev, newItem]);
    setCustomItem(emptyCustom);
    toast('Custom item added.', { kind: 'success' });
  };

  const totals = useMemo(() => computeTotals(items, gstMode), [items, gstMode]);

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    if (items.length === 0) { toast('Add at least one item.', { kind: 'error' }); return; }
    setSubmitting(true);
    try {
      const payload = {
        quote_id:              Number(quoteId),
        client_name:           quote.client.name,
        client_business_name:  quote.client.business_name,
        client_type:           quote.client.type,
        client_phone:          quote.client.phone,
        client_email:          quote.client.email,
        client_city:           quote.client.city,
        requirement_type:      quote.client.requirement_type,
        client_gstin:          clientExtra.client_gstin,
        client_state:          clientExtra.client_state,
        place_of_supply:       clientExtra.place_of_supply,
        items,
        gst_mode:              gstMode,
        notes,
      };
      const res = await api.post('/api/bills', payload);
      toast('Bill generated!', { kind: 'success' });
      navigate(`/bills/${res.data.bill.id}`);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to generate bill', { kind: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500 p-4">Loading quote…</div>;
  if (!quote)  return <div className="text-sm text-rose-600 p-4">Quote not found.</div>;

  const { client } = quote;

  return (
    <div className="space-y-4 pb-10">

      {/* ── Header ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <button type="button" onClick={() => navigate(`/quotes/${quoteId}`)} className="text-slate-400 hover:text-slate-600 text-sm">
            ← Back
          </button>
          <h1 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Generate Bill
          </h1>
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            from {quote.quote.number}
          </span>
        </div>
        <p className="text-xs text-slate-500">Client details are locked from the quote. You can edit products &amp; quantities.</p>
      </div>

      {/* ── GST Mode ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3">GST Options</h2>
        <div className="flex gap-3 flex-wrap">
          {[
            { val: 'with_gst',    label: 'With GST',    desc: 'Base price shown; GST calculated separately in Tax Summary.' },
            { val: 'without_gst', label: 'Without GST', desc: 'No GST. Base price +5% markup. Issued as Vemuri Life Care.' },
          ].map(({ val, label, desc }) => (
            <label key={val}
              className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer flex-1 min-w-[200px] transition-all ${
                gstMode === val ? 'border-[#1F6BC7] bg-blue-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input type="radio" name="gst_mode" value={val} checked={gstMode === val}
                onChange={() => handleGstModeChange(val)} className="mt-0.5" />
              <div>
                <div className="font-semibold text-sm text-slate-800">{label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Client Details (locked + extra editable) ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span>🔒</span> Client Details
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-4">
          {[['Name', client.name], ['Business', client.business_name], ['Type', client.type],
            ['Phone', client.phone], ['Email', client.email], ['City', client.city]].map(([label, val]) =>
            val ? (
              <div key={label} className="flex gap-2">
                <span className="text-slate-400 min-w-[70px]">{label}:</span>
                <span className="text-slate-700 font-medium">{val}</span>
              </div>
            ) : null
          )}
        </div>
        {/* Editable extras */}
        <div className="border-t border-slate-100 pt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Client GSTIN (optional)</label>
            <input type="text" placeholder="e.g. 36XXXXXXXX"
              value={clientExtra.client_gstin}
              onChange={(e) => setClientExtra((p) => ({ ...p, client_gstin: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Client State</label>
            <input type="text" placeholder="e.g. 36-Telangana"
              value={clientExtra.client_state}
              onChange={(e) => setClientExtra((p) => ({ ...p, client_state: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Place of Supply</label>
            <input type="text" placeholder="e.g. 36-Telangana"
              value={clientExtra.place_of_supply}
              onChange={(e) => setClientExtra((p) => ({ ...p, place_of_supply: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>

      {/* ── Bill Items ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-700">Bill Items ({items.length})</h2>
          <button
            type="button"
            onClick={() => { setShowAddPanel(!showAddPanel); if (!showAddPanel) { setAddMode('catalog'); loadProducts(); } }}
            className="inline-flex items-center gap-1.5 bg-[#1F6BC7] hover:bg-[#155DA6] text-white text-xs font-bold rounded-lg px-3 py-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add Item
          </button>
        </div>

        {/* ─ Add Item Panel ─ */}
        {showAddPanel && (
          <div className="border border-blue-200 rounded-xl bg-blue-50 p-3 mb-4">
            {/* Mode tabs */}
            <div className="flex gap-2 mb-3">
              {[['catalog', '🛒 From Catalog'], ['custom', '✏️ Custom Item']].map(([m, label]) => (
                <button key={m} type="button" onClick={() => setAddMode(m)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    addMode === m ? 'bg-[#1F6BC7] text-white border-[#1F6BC7]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button type="button" onClick={() => setShowAddPanel(false)}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600 px-2">✕ Close</button>
            </div>

            {addMode === 'catalog' ? (
              <>
                <input
                  type="text"
                  placeholder="Search products by name, category or HSN code…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  autoFocus
                />
                {!productsLoaded ? (
                  <div className="text-center py-4 text-xs text-slate-400">Loading products…</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">No products found</div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {filteredProducts.map((p, i) => (
                      <button key={i} type="button"
                        onClick={() => addCatalogItem(p)}
                        className="w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 bg-white hover:bg-blue-100 rounded-lg border border-transparent hover:border-blue-200 transition-all"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{p.product_name}</div>
                          <div className="text-xs text-slate-400">
                            {p.category_name}{p.hsn_code ? ` · HSN ${p.hsn_code}` : ''} · {p.unit} · GST {p.gst_percent}%
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-[#1F6BC7]">
                            ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(p.base_price)}
                          </div>
                          <div className="text-xs text-slate-400">per {p.unit}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Custom item form */
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Item Name *</label>
                  <input type="text" placeholder="Product / Item name"
                    value={customItem.name}
                    onChange={(e) => setCustomItem((p) => ({ ...p, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">HSN / SAC Code</label>
                  <input type="text" placeholder="e.g. 3402"
                    value={customItem.hsn_code}
                    onChange={(e) => setCustomItem((p) => ({ ...p, hsn_code: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Unit</label>
                  <select value={customItem.unit} onChange={(e) => setCustomItem((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  >
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Base Price (₹) *
                  </label>
                  <input type="number" min="0" step="0.01" placeholder="0.00"
                    value={customItem.unit_price}
                    onChange={(e) => setCustomItem((p) => ({ ...p, unit_price: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Quantity</label>
                  <input type="number" min="1"
                    value={customItem.quantity}
                    onChange={(e) => setCustomItem((p) => ({ ...p, quantity: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">GST %</label>
                  <select value={customItem.gst_percent} onChange={(e) => setCustomItem((p) => ({ ...p, gst_percent: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  >
                    {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <button type="button" onClick={addCustomItem}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm"
                  >
                    ➕ Add Custom Item
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─ Item rows ─ */}
        {items.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">No items. Click "Add Item" to add products.</div>
        ) : (
          <div className="space-y-2">
            {items.map((it, idx) => {
              const lineBase = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
              const lineGst  = gstMode === 'with_gst' ? +((lineBase * (Number(it.gst_percent) || 0)) / 100).toFixed(2) : 0;
              const lineTotal = +(lineBase + lineGst).toFixed(2);
              return (
                <div key={idx} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-semibold text-sm text-slate-800">{it.product_name}</div>
                      <div className="text-xs text-slate-500">
                        {[it.hsn_code && `HSN ${it.hsn_code}`, it.unit].filter(Boolean).join(' · ')}
                        {gstMode === 'with_gst' && ` · GST ${it.gst_percent}%`}
                      </div>
                    </div>
                    <button type="button" onClick={() => removeItem(idx)}
                      className="text-rose-400 hover:text-rose-600 text-xs px-2 py-1 rounded border border-rose-100 hover:border-rose-200 bg-white shrink-0">
                      Remove
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 items-center">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Qty</div>
                      <input type="number" min="1" value={it.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                        className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">
                        Base Price ₹
                      </div>
                      <input type="number" min="0" step="0.01" value={it.unit_price}
                        onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))}
                        className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right" />
                    </div>
                    {gstMode === 'with_gst' && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">GST</div>
                        <div className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white text-slate-500">
                          {it.gst_percent}%
                        </div>
                      </div>
                    )}
                    <div className="ml-auto text-right">
                      <div className="text-xs text-slate-500 mb-1">Amount</div>
                      <div className="font-bold text-slate-800 text-sm">{formatINR(lineTotal)}</div>
                      {gstMode === 'with_gst' && lineGst > 0 && (
                        <div className="text-xs text-slate-400">+{formatINR(lineGst)} GST</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Notes ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-2">Notes (optional)</h2>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="Any special instructions or notes for this bill…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* ── Summary + Submit ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">Summary</h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal (base)</span>
            <span className="font-medium">{formatINR(totals.subtotal)}</span>
          </div>
          {gstMode === 'with_gst' && (
            <div className="flex justify-between text-slate-600">
              <span>GST</span>
              <span className="font-medium">{formatINR(totals.gst_amount)}</span>
            </div>
          )}
          {gstMode === 'without_gst' && (
            <div className="flex justify-between text-slate-600">
              <span>Markup (+5%)</span>
              <span className="font-medium">+{formatINR(+(totals.subtotal * WITHOUT_GST_MARKUP).toFixed(2))}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-800 border-t border-slate-100 pt-2">
            <span>Total Amount</span>
            <span className="text-[#1F6BC7] text-base">{formatINR(totals.total_amount)}</span>
          </div>
        </div>
        <button type="button" onClick={handleSubmit} disabled={submitting || items.length === 0}
          className="w-full py-3 bg-[#1F6BC7] hover:bg-[#155DA6] text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors"
          style={{ fontFamily: 'Manrope, sans-serif', minHeight: 48 }}
        >
          {submitting ? 'Generating…' : '📄 Generate Bill'}
        </button>
      </div>
    </div>
  );
}
