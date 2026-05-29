import React, { useMemo, useState } from 'react';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

/**
 * Calculate the pack price from the size label and the per-unit base_price.
 *
 * Rules (unit-aware — only multiply when the pack unit matches the product unit):
 *   unit=ltr  + size has "ltr/litre/L"  →  qty × base_price
 *   unit=kg   + size has "kg/KG"        →  qty × base_price
 *   unit=kg   + size has "gms/gm/g"     →  (qty/1000) × base_price
 *   anything else                        →  base_price (no multiplier)
 *
 * Examples:
 *   "5ltr"   unit=ltr  base=40  → 5 × 40 = ₹200
 *   "10 KG"  unit=kg   base=120 → 10 × 120 = ₹1200
 *   "500gms" unit=kg   base=250 → 0.5 × 250 = ₹125
 *   "400 GMS" unit=BOX base=180 → ₹180  (unit mismatch – keep base)
 *   "50 GMS"  unit=1   base=48  → ₹48   (unit mismatch – keep base)
 */
export function calcPackPrice(sizeLabel, basePrice, unit) {
  const base = Number(basePrice) || 0;
  const lbl  = (sizeLabel || '').toLowerCase().trim();
  const u    = (unit    || '').toLowerCase().trim();

  // Litres
  if ((u === 'ltr' || u === 'litre' || u === 'l') && /ltr|litre/i.test(lbl)) {
    const qty = parseFloat(lbl);
    if (qty > 0) return Math.round(qty * base);
  }

  // Kilograms
  if (u === 'kg') {
    if (/\bkg\b/i.test(lbl)) {
      const qty = parseFloat(lbl);
      if (qty > 0) return Math.round(qty * base);
    }
    if (/\bgms?\b|\bgram(me)?s?\b/i.test(lbl)) {
      const qty = parseFloat(lbl);
      if (qty > 0) return Math.round((qty / 1000) * base);
    }
  }

  // No matching multiplier → return base price
  return base;
}

export default function ProductCard({ product, inCart, onAdd }) {
  const variants = product.variants || [];
  const sizes    = product.pack_sizes || [];
  const [variant,  setVariant]  = useState(variants[0] || null);
  const [sizeIdx,  setSizeIdx]  = useState(0);
  const [qty,      setQty]      = useState(1);

  const selectedSize = sizes[sizeIdx];

  const lineKey = useMemo(
    () => `${product.id}|${variant || ''}|${selectedSize?.size || ''}`,
    [product.id, variant, selectedSize]
  );
  const alreadyAdded = inCart.has(lineKey);

  // Price for the currently selected pack (or base_price for unit-sold products)
  const effectivePrice = selectedSize
    ? calcPackPrice(selectedSize.size, product.base_price, product.unit)
    : (product.base_price || 0);

  const onClickAdd = () => {
    onAdd({
      product_id:    product.id,
      product_name:  product.name,
      description:   product.description || null,
      category_id:   product.category_id,
      category_name: product.category_name,
      variant:       variant || null,
      pack_size:     selectedSize?.size || '',
      quantity:      Math.max(1, Number(qty) || 1),
      unit_price:    effectivePrice,
      gst_percent:   product.gst_percent,
      hsn_code:      product.hsn_code,
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none">{product.category_icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm leading-tight" title={product.name}>
            {product.name}
          </h3>
          {product.description && (
            <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2" title={product.description}>
              {product.description}
            </p>
          )}
          <div className="text-[11px] text-slate-400 mt-1">
            GST {product.gst_percent}% · HSN {product.hsn_code || '—'}
          </div>
        </div>
      </div>

      {variants.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {variants.map((v) => {
            const active = v === variant;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                className={[
                  'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                  active
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-cyan-400',
                ].join(' ')}
              >
                {v}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 grid grid-cols-5 gap-2">
        {sizes.length > 0 ? (
          <label className="col-span-3 text-xs text-slate-600">
            <div className="mb-1">Pack size</div>
            <select
              value={sizeIdx}
              onChange={(e) => setSizeIdx(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {sizes.map((s, i) => (
                <option key={`${s.size}-${i}`} value={i}>
                  {s.size} — {formatINR(calcPackPrice(s.size, product.base_price, product.unit))}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="col-span-3 text-xs text-slate-600">
            <div className="mb-1">Unit price</div>
            <div className="border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 text-sm font-medium text-slate-700">
              {formatINR(product.base_price)}
            </div>
          </div>
        )}
        <label className="col-span-2 text-xs text-slate-600">
          <div className="mb-1">Qty</div>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onClickAdd}
        className={[
          'mt-3 w-full text-sm font-semibold rounded-lg py-2 transition-colors',
          alreadyAdded
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-cyan-600 hover:bg-cyan-700 text-white',
        ].join(' ')}
      >
        {alreadyAdded ? '✓ Added' : 'Add to Quote'}
      </button>
    </div>
  );
}
