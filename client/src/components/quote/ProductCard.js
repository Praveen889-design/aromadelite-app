import React, { useMemo, useState } from 'react';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function ProductCard({ product, inCart, onAdd }) {
  const variants = product.variants || [];
  const sizes = product.pack_sizes || [];
  const [variant, setVariant] = useState(variants[0] || null);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [qty, setQty] = useState(1);

  const selectedSize = sizes[sizeIdx];

  const lineKey = useMemo(
    () => `${product.id}|${variant || ''}|${selectedSize?.size || ''}`,
    [product.id, variant, selectedSize]
  );
  const alreadyAdded = inCart.has(lineKey);

  const onClickAdd = () => {
    if (!selectedSize) return;
    onAdd({
      product_id: product.id,
      product_name: product.name,
      description: product.description || null,
      category_id: product.category_id,
      category_name: product.category_name,
      variant: variant || null,
      pack_size: selectedSize.size,
      quantity: Math.max(1, Number(qty) || 1),
      unit_price: selectedSize.price,
      gst_percent: product.gst_percent,
      hsn_code: product.hsn_code,
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none">{product.category_icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate" title={product.name}>
            {product.name}
          </h3>
          <div className="text-[11px] text-slate-500 mt-0.5">
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
        <label className="col-span-3 text-xs text-slate-600">
          <div className="mb-1">Pack size</div>
          <select
            value={sizeIdx}
            onChange={(e) => setSizeIdx(Number(e.target.value))}
            className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {sizes.map((s, i) => (
              <option key={`${s.size}-${i}`} value={i}>
                {s.size} — {formatINR(s.price)}
              </option>
            ))}
          </select>
        </label>
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
