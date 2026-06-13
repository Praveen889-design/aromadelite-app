import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { useToast } from '../Toast';

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600';

const Field = ({ label, children, required }) => (
  <label className="block">
    <div className="text-xs font-medium text-slate-700 mb-1">{label}{required && <span className="text-rose-600"> *</span>}</div>
    {children}
  </label>
);

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);

// Base selling price from cost + margin.
//   basis 'cost'  → cost × (1 + margin/100)        (markup on cost)
//   basis 'price' → cost ÷ (1 − margin/100)        (margin on selling price)
const computeBase = (cost, margin, basis) => {
  const c = Number(cost) || 0;
  const m = Number(margin) || 0;
  if (c <= 0) return 0;
  if (basis === 'price') {
    if (m >= 100) return 0;            // 100% margin on price is undefined
    return r2(c / (1 - m / 100));
  }
  return r2(c * (1 + m / 100));
};

// Reverse: implied margin % from cost + base price (for edit mode + manual overrides)
const marginFromBase = (cost, base, basis) => {
  const c = Number(cost) || 0;
  const b = Number(base) || 0;
  if (c <= 0 || b <= 0) return '';
  return basis === 'price' ? r2(((b - c) / b) * 100) : r2(((b / c) - 1) * 100);
};

export default function ProductModal({ open, mode = 'create', product, categories, onClose, onSaved }) {
  const { toast } = useToast();
  const [v, setV] = useState({
    category_id: '', name: '', description: '', unit: '',
    base_price: 0, manufacturing_cost: 0, margin_percent: '', margin_basis: 'cost',
    gst_percent: 18, hsn_code: '',
    variantsText: '', packSizesText: '', is_active: true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && product) {
      const cost = product.manufacturing_cost || 0;
      const base = product.base_price || 0;
      setV({
        category_id: product.category_id,
        name: product.name || '',
        description: product.description || '',
        unit: product.unit || '',
        base_price: base,
        manufacturing_cost: cost,
        margin_percent: marginFromBase(cost, base, 'cost'),
        margin_basis: 'cost',
        gst_percent: product.gst_percent || 18,
        hsn_code: product.hsn_code || '',
        variantsText: (product.variants || []).join(', '),
        packSizesText: (product.pack_sizes || []).map((p) => `${p.size}=${p.price}`).join(', '),
        is_active: !!product.is_active,
      });
    } else {
      setV((s) => ({ ...s, category_id: categories[0]?.id || '', name: '', description: '', unit: '', base_price: 0, manufacturing_cost: 0, margin_percent: '', margin_basis: 'cost', gst_percent: 18, hsn_code: '', variantsText: '', packSizesText: '', is_active: true }));
    }
  }, [open, mode, product, categories]);

  if (!open) return null;
  const upd = (patch) => setV((s) => ({ ...s, ...patch }));

  // ── Pricing calculator handlers (bidirectional: cost/margin ⇄ base) ──
  const editCost = (val) => setV((s) => ({
    ...s, manufacturing_cost: val,
    base_price: s.margin_percent !== '' ? computeBase(val, s.margin_percent, s.margin_basis) : s.base_price,
  }));
  const editMargin = (val) => setV((s) => ({
    ...s, margin_percent: val,
    base_price: computeBase(s.manufacturing_cost, val, s.margin_basis),
  }));
  const editBase = (val) => setV((s) => ({
    ...s, base_price: val,
    margin_percent: marginFromBase(s.manufacturing_cost, val, s.margin_basis),
  }));
  const changeBasis = (basis) => setV((s) => ({
    ...s, margin_basis: basis,
    margin_percent: marginFromBase(s.manufacturing_cost, s.base_price, basis),
  }));

  const parsePackSizes = (text) =>
    text.split(',').map((s) => s.trim()).filter(Boolean).map((kv) => {
      const [size, price] = kv.split('=').map((x) => x?.trim());
      return { size, price: Number(price) || 0 };
    });

  const submit = async () => {
    setBusy(true);
    const payload = {
      category_id: Number(v.category_id),
      name: v.name.trim(),
      description: v.description.trim() || null,
      unit: v.unit.trim() || null,
      base_price: Number(v.base_price) || 0,
      manufacturing_cost: Number(v.manufacturing_cost) || 0,
      gst_percent: Number(v.gst_percent),
      hsn_code: v.hsn_code.trim() || null,
      variants: v.variantsText.split(',').map((s) => s.trim()).filter(Boolean),
      pack_sizes: parsePackSizes(v.packSizesText),
      is_active: v.is_active,
    };
    try {
      if (mode === 'edit' && product) {
        await api.patch(`/api/products/${product.id}`, payload);
        toast(`${payload.name} updated.`, { kind: 'success' });
      } else {
        await api.post('/api/products', payload);
        toast(`${payload.name} created.`, { kind: 'success' });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast(err?.response?.data?.error || 'Failed to save product', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 px-3 py-6"
         onMouseDown={(e) => e.target === e.currentTarget && onClose()}
         role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{mode === 'edit' ? 'Edit product' : 'Add new product'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl" aria-label="Close">×</button>
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          <Field label="Category" required>
            <select className={inputCls} value={v.category_id} onChange={(e) => upd({ category_id: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon_emoji} {c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Active">
            <select className={inputCls} value={v.is_active ? '1' : '0'} onChange={(e) => upd({ is_active: e.target.value === '1' })}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Name" required>
              <input className={inputCls} value={v.name} onChange={(e) => upd({ name: e.target.value })} />
            </Field>
          </div>
          <Field label="Unit">
            <input className={inputCls} value={v.unit} onChange={(e) => upd({ unit: e.target.value })} placeholder="L / pc / pair" />
          </Field>
          <Field label="HSN Code">
            <input className={inputCls} value={v.hsn_code} onChange={(e) => upd({ hsn_code: e.target.value })} placeholder="3402" />
          </Field>

          {/* ── Pricing calculator ─────────────────────────────── */}
          <div className="sm:col-span-2 rounded-xl border border-cyan-200 bg-cyan-50/40 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs font-bold text-cyan-800">💡 Price Calculator</div>
              <div className="flex rounded-lg border border-cyan-300 overflow-hidden text-[10px] font-semibold bg-white">
                <button type="button" onClick={() => changeBasis('cost')}
                  className={v.margin_basis === 'cost' ? 'px-2.5 py-1 bg-cyan-600 text-white' : 'px-2.5 py-1 text-slate-600'}>
                  Markup on cost
                </button>
                <button type="button" onClick={() => changeBasis('price')}
                  className={v.margin_basis === 'price' ? 'px-2.5 py-1 bg-cyan-600 text-white' : 'px-2.5 py-1 text-slate-600 border-l border-cyan-300'}>
                  Margin on price
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Mfg Cost (₹)" required>
                <input className={inputCls} type="number" min={0} value={v.manufacturing_cost}
                       onChange={(e) => editCost(e.target.value)} placeholder="0" />
              </Field>
              <Field label={`Margin % ${v.margin_basis === 'cost' ? '(on cost)' : '(on price)'}`}>
                <input className={inputCls} type="number" min={0} value={v.margin_percent}
                       onChange={(e) => editMargin(e.target.value)} placeholder="e.g. 100" />
              </Field>
              <Field label="GST %" required>
                <select className={inputCls} value={v.gst_percent} onChange={(e) => upd({ gst_percent: Number(e.target.value) })}>
                  <option value={0}>0%</option>
                  <option value={3}>3%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
              </Field>
            </div>

            <div className="mt-2.5">
              <Field label="Base selling price (₹) — auto, editable">
                <input className={`${inputCls} font-semibold`} type="number" min={0} value={v.base_price}
                       onChange={(e) => editBase(e.target.value)} />
              </Field>
            </div>

            {/* Live preview */}
            {(() => {
              const base   = Number(v.base_price) || 0;
              const cost   = Number(v.manufacturing_cost) || 0;
              const gstAmt = r2(base * (Number(v.gst_percent) || 0) / 100);
              const incl   = r2(base + gstAmt);
              const profit = r2(base - cost);
              return (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-white border border-slate-200 px-2 py-2">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Base price</div>
                    <div className="text-sm font-bold text-slate-800">{fmt(base)}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200 px-2 py-2">
                    <div className="text-[9px] uppercase font-bold text-slate-400">GST {v.gst_percent}%</div>
                    <div className="text-sm font-bold text-slate-600">{fmt(gstAmt)}</div>
                  </div>
                  <div className="rounded-lg bg-cyan-600 px-2 py-2">
                    <div className="text-[9px] uppercase font-bold text-cyan-100">Incl. GST</div>
                    <div className="text-sm font-bold text-white">{fmt(incl)}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-emerald-200 px-2 py-2">
                    <div className="text-[9px] uppercase font-bold text-emerald-500">Profit / unit</div>
                    <div className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmt(profit)}</div>
                  </div>
                </div>
              );
            })()}
            <p className="mt-2 text-[10px] text-slate-500 leading-snug">
              Enter Mfg Cost + Margin and the base selling price fills in automatically. GST is always stored and shown separately. You can still type a base price directly to override.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Field label="Variants (comma-separated)">
              <input className={inputCls} value={v.variantsText}
                     onChange={(e) => upd({ variantsText: e.target.value })}
                     placeholder="Standard, Concentrated, Lemon" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Pack sizes (size=price, comma-separated)">
              <input className={inputCls} value={v.packSizesText}
                     onChange={(e) => upd({ packSizesText: e.target.value })}
                     placeholder="1L=35, 5L=160, 20L=580" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea rows={2} className={inputCls} value={v.description}
                        onChange={(e) => upd({ description: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={busy}
                  className="px-4 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold disabled:opacity-60">
            {busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add product'}
          </button>
        </div>
      </div>
    </div>
  );
}
