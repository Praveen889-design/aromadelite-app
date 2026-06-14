import React from 'react';
import { colors, radii, shadow, tint } from '../../theme/tokens';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const TrashIcon = (p) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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
  const discountPct = hasDiscount ? Math.round(((systemPrice - quotePrice) / systemPrice) * 100) : 0;

  const accent = hasDiscount ? colors.green : hasOverride ? colors.orange : colors.primary;
  const meta = [item.variant, item.pack_size].filter(Boolean).join(' · ');

  return (
    <div style={{
      background: '#fff', borderRadius: radii.md,
      border: `1px solid ${colors.border}`, borderLeft: `3px solid ${accent}`,
      padding: '11px 12px', boxShadow: shadow.sm,
    }}>
      {/* Title + remove */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13.5, color: colors.ink, lineHeight: 1.25 }} title={item.product_name}>
            {item.product_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {meta && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: colors.body, background: '#F1F5F9', padding: '2px 7px', borderRadius: 999 }}>{meta}</span>
            )}
            <span style={{ fontSize: 10.5, fontWeight: 700, color: colors.sub }}>GST {item.gst_percent}%</span>
          </div>
        </div>
        <button type="button" onClick={() => onRemove(index)} aria-label="Remove item"
          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tint(colors.red, .08), color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrashIcon />
        </button>
      </div>

      {/* Controls: Price · Qty · Total */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 9, alignItems: 'end', marginTop: 10 }}>
        {/* Price */}
        <label style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: colors.sub, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Quote Price ₹</div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: colors.faint, fontWeight: 700 }}>₹</span>
            <input
              type="number" min={0} value={quotePrice}
              onChange={(e) => onUpdate(index, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
              style={{
                width: '100%', boxSizing: 'border-box', borderRadius: 9, padding: '8px 8px 8px 20px',
                fontSize: 14, fontWeight: 700, outline: 'none',
                border: `1.5px solid ${hasDiscount ? '#86efac' : hasOverride ? '#fcd34d' : colors.border}`,
                background: hasDiscount ? '#F0FDF4' : hasOverride ? '#FFFBEB' : '#fff',
                color: hasDiscount ? '#15803d' : hasOverride ? '#b45309' : colors.ink,
              }}
            />
          </div>
        </label>

        {/* Qty stepper */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: colors.sub, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'center' }}>Qty</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', border: `1.5px solid ${colors.border}`, borderRadius: 9, overflow: 'hidden', background: '#fff' }}>
            <button type="button" onClick={() => onUpdate(index, { quantity: Math.max(1, qty - 1) })} aria-label="Decrease"
              style={{ width: 30, height: 36, border: 'none', background: '#F8FAFF', color: colors.primary, fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>−</button>
            <input type="number" min={1} value={qty}
              onChange={(e) => onUpdate(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
              style={{ width: 40, textAlign: 'center', border: 'none', outline: 'none', fontSize: 14, fontWeight: 800, color: colors.ink, padding: '8px 0' }} />
            <button type="button" onClick={() => onUpdate(index, { quantity: qty + 1 })} aria-label="Increase"
              style={{ width: 30, height: 36, border: 'none', background: '#F8FAFF', color: colors.primary, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>+</button>
          </div>
        </div>

        {/* Line total */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: colors.sub, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Total</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: colors.ink, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{formatINR(lineTotal)}</div>
        </div>
      </div>

      {/* Catalog / discount note */}
      {(hasDiscount || hasOverride) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
          <span style={{ fontSize: 11, color: colors.faint }}>Catalog <span style={{ textDecoration: 'line-through' }}>{formatINR(systemPrice)}</span></span>
          {hasDiscount && (
            <span style={{ fontSize: 10.5, fontWeight: 800, background: tint(colors.green, .14), color: '#15803d', padding: '2px 8px', borderRadius: 999 }}>↓ {discountPct}% off</span>
          )}
          {hasOverride && (
            <span style={{ fontSize: 10.5, fontWeight: 800, background: tint(colors.orange, .16), color: '#b45309', padding: '2px 8px', borderRadius: 999 }}>↑ above catalog</span>
          )}
        </div>
      )}
    </div>
  );
}
