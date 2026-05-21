import React from 'react';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const TrashIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export default function CartItem({ item, index, onUpdate, onRemove }) {
  const qty         = Number(item.quantity)     || 0;
  const systemPrice = Number(item.system_price) || Number(item.unit_price) || 0;
  const quotePrice  = Number(item.unit_price)   || 0;
  const lineTotal   = qty * quotePrice;

  const hasDiscount = quotePrice < systemPrice && systemPrice > 0;
  const hasOverride = quotePrice > systemPrice && systemPrice > 0;
  const discountPct = hasDiscount
    ? Math.round(((systemPrice - quotePrice) / systemPrice) * 100)
    : 0;

  return (
    <div className={[
      'border rounded-lg p-3 bg-white',
      hasDiscount ? 'border-emerald-200' : hasOverride ? 'border-amber-200' : 'border-slate-200',
    ].join(' ')}>

      {/* Product name + remove */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-slate-900 truncate" title={item.product_name}>
            {item.product_name}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {[item.variant, item.pack_size].filter(Boolean).join(' · ')} · GST {item.gst_percent}%
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-slate-400 hover:text-rose-600 p-1 shrink-0"
          aria-label="Remove item"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Catalog price row */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-slate-500">Catalog ₹:</span>
        <span className={[
          'text-[11px] font-medium',
          hasDiscount ? 'line-through text-slate-400' : 'text-slate-700',
        ].join(' ')}>
          {formatINR(systemPrice)}
        </span>
        {hasDiscount && (
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
            {discountPct}% off
          </span>
        )}
        {hasOverride && (
          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
            ↑ above catalog
          </span>
        )}
      </div>

      {/* Quote price input + qty controls */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-slate-500 mb-1">Client Quote Price (₹)</div>
          <input
            type="number"
            min={0}
            value={quotePrice}
            onChange={(e) => onUpdate(index, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
            className={[
              'w-full border rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500',
              hasDiscount
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : hasOverride
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-300 text-slate-900',
            ].join(' ')}
          />
        </div>

        <div>
          <div className="text-[11px] text-slate-500 mb-1">Quantity</div>
          <div className="inline-flex items-center border border-slate-300 rounded-md overflow-hidden w-full">
            <button
              type="button"
              onClick={() => onUpdate(index, { quantity: Math.max(1, qty - 1) })}
              className="px-2 py-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Decrease"
            >−</button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => onUpdate(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
              className="flex-1 text-center text-sm py-1.5 focus:outline-none min-w-0"
            />
            <button
              type="button"
              onClick={() => onUpdate(index, { quantity: qty + 1 })}
              className="px-2 py-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Increase"
            >+</button>
          </div>
        </div>
      </div>

      {/* Line total */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          {qty} × {formatINR(quotePrice)}
        </span>
        <span className="text-sm font-semibold text-slate-900">{formatINR(lineTotal)}</span>
      </div>
    </div>
  );
}
