import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../components/Toast';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

/* ── Compute inclusive unit price (base + gst absorbed) ── */
const inclusivePrice = (basePrice, gstPercent) => {
  const base = Number(basePrice) || 0;
  const pct  = Number(gstPercent) || 0;
  return +(base * (1 + pct / 100)).toFixed(2);
};

/* ── Totals ── */
const computeTotals = (items, gst_mode) => {
  let subtotal = 0, gst_amount = 0;
  if (gst_mode === 'without_gst') {
    for (const it of items) subtotal += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    return { subtotal: +subtotal.toFixed(2), gst_amount: 0, total_amount: +subtotal.toFixed(2) };
  }
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    subtotal += line;
    gst_amount += (line * (Number(it.gst_percent) || 0)) / 100;
  }
  return { subtotal: +subtotal.toFixed(2), gst_amount: +gst_amount.toFixed(2), total_amount: +(subtotal + gst_amount).toFixed(2) };
};

export default function BillBuilder() {
  const { quoteId } = useParams(); // route: /bills/new/:quoteId
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(null);
  const [items, setItems] = useState([]);
  const [gstMode, setGstMode] = useState('with_gst');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* Load quote data */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/quotes/${quoteId}/pdf-data`);
        const pdf = res.data.pdf;
        setQuote(pdf);
        // Prefill items from quote; each item gets base_price stored for mode switching
        setItems(
          (pdf.items || []).map((it) => ({
            ...it,
            base_price: it.unit_price,           // original base (pre-GST)
          }))
        );
        setNotes(pdf.quote.notes || '');
      } catch (e) {
        toast(e?.response?.data?.error || 'Failed to load quote', { kind: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [quoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* When GST mode changes, recalculate unit_price for each item */
  const handleGstModeChange = (mode) => {
    setGstMode(mode);
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        unit_price:
          mode === 'without_gst'
            ? inclusivePrice(it.base_price, it.gst_percent)
            : it.base_price,
      }))
    );
  };

  const updateItem = (idx, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      const updated = { ...copy[idx], [field]: value };

      if (field === 'unit_price') {
        // When user manually edits price, keep base_price in sync
        if (gstMode === 'with_gst') {
          updated.base_price = value;
        } else {
          // In without_gst mode, the user is editing the inclusive price directly
          updated.base_price = +(Number(value) / (1 + (Number(updated.gst_percent) || 0) / 100)).toFixed(2);
        }
      }
      copy[idx] = updated;
      return copy;
    });
  };

  const removeItem = (idx) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const totals = useMemo(() => computeTotals(items, gstMode), [items, gstMode]);

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast('Add at least one item.', { kind: 'error' });
      return;
    }
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
        items,
        gst_mode:              gstMode,
        notes,
      };
      const res = await api.post('/api/bills', payload);
      const billId = res.data.bill.id;
      toast('Bill generated!', { kind: 'success' });
      navigate(`/bills/${billId}`);
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
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            type="button"
            onClick={() => navigate(`/quotes/${quoteId}`)}
            className="text-slate-400 hover:text-slate-600"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Generate Bill
          </h1>
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            from {quote.quote.number}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Client details are locked from the quote. You can edit products & quantities.
        </p>
      </div>

      {/* Client Details (locked) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span className="text-base">🔒</span> Client Details (Locked)
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {[
            ['Name',         client.name],
            ['Business',     client.business_name],
            ['Type',         client.type],
            ['Phone',        client.phone],
            ['Email',        client.email],
            ['City',         client.city],
            ['Requirement',  client.requirement_type],
          ].map(([label, val]) =>
            val ? (
              <div key={label} className="flex gap-2">
                <span className="text-slate-400 min-w-[80px]">{label}:</span>
                <span className="text-slate-700 font-medium">{val}</span>
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* GST Mode */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3">GST Options</h2>
        <div className="flex gap-3 flex-wrap">
          <label
            className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer flex-1 min-w-[200px] transition-all ${
              gstMode === 'with_gst'
                ? 'border-[#1F6BC7] bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="gst_mode"
              value="with_gst"
              checked={gstMode === 'with_gst'}
              onChange={() => handleGstModeChange('with_gst')}
              className="mt-0.5"
            />
            <div>
              <div className="font-semibold text-sm text-slate-800">With GST</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Base price shown. GST calculated & displayed separately as a line item.
              </div>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer flex-1 min-w-[200px] transition-all ${
              gstMode === 'without_gst'
                ? 'border-[#1F6BC7] bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="gst_mode"
              value="without_gst"
              checked={gstMode === 'without_gst'}
              onChange={() => handleGstModeChange('without_gst')}
              className="mt-0.5"
            />
            <div>
              <div className="font-semibold text-sm text-slate-800">Without GST</div>
              <div className="text-xs text-slate-500 mt-0.5">
                GST absorbed into unit price (Base + GST = Final price). No separate GST line on bill.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Bill Items</h2>

        {items.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">No items. All items were removed.</div>
        ) : (
          <div className="space-y-2">
            {items.map((it, idx) => {
              const lineTotal = +(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2);
              const gstAmt = gstMode === 'with_gst'
                ? +((lineTotal * (Number(it.gst_percent) || 0)) / 100).toFixed(2)
                : 0;
              return (
                <div
                  key={idx}
                  className="border border-slate-100 rounded-xl p-3 bg-slate-50 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm text-slate-800">
                        {it.product_name || it.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {[it.variant, it.pack_size].filter(Boolean).join(' · ')}
                        {it.category_name ? ` · ${it.category_name}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-rose-400 hover:text-rose-600 text-xs px-2 py-1 rounded border border-rose-100 hover:border-rose-200 bg-white"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    {/* Quantity */}
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Qty</div>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                        className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center"
                      />
                    </div>

                    {/* Unit Price */}
                    <div>
                      <div className="text-xs text-slate-500 mb-1">
                        {gstMode === 'without_gst' ? 'Price (incl. GST) ₹' : 'Base Price ₹'}
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.unit_price}
                        onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))}
                        className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right"
                      />
                    </div>

                    {/* GST % (read-only in with_gst mode) */}
                    {gstMode === 'with_gst' && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">GST %</div>
                        <div className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white text-slate-600">
                          {it.gst_percent || 0}%
                        </div>
                      </div>
                    )}

                    {/* Line total */}
                    <div className="ml-auto text-right">
                      <div className="text-xs text-slate-500 mb-1">Line Total</div>
                      <div className="font-semibold text-slate-800 text-sm">{formatINR(lineTotal)}</div>
                      {gstMode === 'with_gst' && gstAmt > 0 && (
                        <div className="text-xs text-slate-500">+{formatINR(gstAmt)} GST</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-2">Notes (optional)</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any special instructions or notes for this bill…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* Summary + Submit */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">Summary</h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-medium">{formatINR(totals.subtotal)}</span>
          </div>
          {gstMode === 'with_gst' && (
            <div className="flex justify-between text-slate-600">
              <span>GST</span>
              <span className="font-medium">{formatINR(totals.gst_amount)}</span>
            </div>
          )}
          {gstMode === 'without_gst' && (
            <div className="flex justify-between text-xs text-slate-400 italic">
              <span>GST absorbed in prices</span>
              <span>—</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-800 border-t border-slate-100 pt-2">
            <span>Total</span>
            <span className="text-[#1F6BC7] text-base">{formatINR(totals.total_amount)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          className="w-full py-3 bg-[#1F6BC7] hover:bg-[#155DA6] active:bg-[#0F4A8C] text-white font-bold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ fontFamily: 'Manrope, sans-serif', minHeight: 48 }}
        >
          {submitting ? 'Generating…' : '📄 Generate Bill'}
        </button>
      </div>
    </div>
  );
}
