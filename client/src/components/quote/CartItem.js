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
  const qty = Number(item.quantity) || 0;
  const lineTotal = qty * (Number(item.unit_price) || 0);

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
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
          className="text-slate-400 hover:text-rose-600 p-1"
          aria-label="Remove item"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="inline-flex items-center border border-slate-300 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => onUpdate(index, { quantity: Math.max(1, qty - 1) })}
            className="px-2 py-1 text-slate-600 hover:bg-slate-100"
            aria-label="Decrease quantity"
          >−</button>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => onUpdate(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
            className="w-12 text-center text-sm py-1 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onUpdate(index, { quantity: qty + 1 })}
            className="px-2 py-1 text-slate-600 hover:bg-slate-100"
            aria-label="Increase quantity"
          >+</button>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-500">
            {qty} × {formatINR(item.unit_price)}
          </div>
          <div className="text-sm font-semibold text-slate-900">{formatINR(lineTotal)}</div>
        </div>
      </div>
    </div>
  );
}
