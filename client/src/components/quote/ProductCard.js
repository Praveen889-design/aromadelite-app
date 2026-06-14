import React, { useMemo, useState } from 'react';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// Per-category colour identity (stable) — keeps the quote browser vibrant
const CAT_PALETTE = ['#2563EB', '#06B6D4', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#EF4444', '#0EA5E9', '#14B8A6'];
const catColor = (name = '') => {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return CAT_PALETTE[h % CAT_PALETTE.length];
};
const tintHex = (hex, a = 0.12) => {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};

/**
 * Calculate the pack price from the size label and the per-unit base_price.
 * The pack LABEL carries the quantity + unit, so "5L" = 5 × base regardless
 * of how product.unit is stored ("L", "l", "ltr", or even blank).
 *
 *   "1L"=base   "5L"=5×base   "20L"=20×base   "500ml"=0.5×base
 *   "1 Kg"=base "10kg"=10×base "500gms"=0.5×base
 *   bare number ("5") + litre/kg product unit → 5×base
 *   no recognizable measure → base_price unchanged
 */
export function calcPackPrice(sizeLabel, basePrice, unit) {
  const base = Number(basePrice) || 0;
  const lbl  = (sizeLabel || '').toLowerCase().trim();
  const u    = (unit || '').toLowerCase().trim();
  const qty  = parseFloat(lbl);
  if (!(qty > 0)) return base;

  // Unit written in the pack label itself (most reliable)
  const lblMl    = /\d\s*ml\b/.test(lbl);
  const lblLitre = !lblMl && /\d\s*(l\b|ltr|litre|liter)/.test(lbl);
  const lblGram  = /\d\s*(gms?\b|grams?\b)/.test(lbl);
  const lblKg    = !lblGram && /\d\s*kgs?\b/.test(lbl);

  if (lblMl)    return Math.round((qty / 1000) * base);
  if (lblLitre) return Math.round(qty * base);
  if (lblGram)  return Math.round((qty / 1000) * base);
  if (lblKg)    return Math.round(qty * base);

  // Label is a bare number with no unit token — scale by the product's
  // measure unit (litre/kg). Non-measure units (pc/box/pair) stay flat.
  const unitLitre = u === 'l' || u === 'ltr' || u === 'litre' || u === 'liter' || u === 'litres';
  const unitKg    = u === 'kg' || u === 'kgs' || u === 'kilogram';
  if (unitLitre || unitKg) return Math.round(qty * base);

  return base;
}

/** Returns "1 Ltr", "1 Kg", "1 Box", "1 Pc", "1 Unit" based on product unit */
export function baseUnitLabel(unit) {
  const u = (unit || '').toLowerCase().trim();
  if (u === 'ltr' || u === 'litre' || u === 'l') return '1 Ltr';
  if (u === 'kg')                                  return '1 Kg';
  if (u === 'box')                                 return '1 Box';
  if (u === 'no' || u === 'pair' || u === 'pairs') return '1 Pc';
  return '1 Unit';
}

/**
 * Look up a client's last-billed price for product + pack size combo.
 * Map keys mirror the server: `${product_id}::${pack_size || unit || ''}`.
 * Returns null when the client never bought this combo.
 */
export function lookupClientPrice(clientPrices, productId, packSize, unit) {
  if (!clientPrices) return null;
  const tryKeys = packSize
    ? [`${productId}::${packSize.trim()}`]
    : [`${productId}::${(unit || '').trim()}`, `${productId}::`];
  for (const k of tryKeys) {
    if (clientPrices[k] !== undefined) return Number(clientPrices[k]);
  }
  return null;
}

export default function ProductCard({ product, inCart, onAdd, stockQty = null, clientPrices = null }) {
  // stockQty: null = no stock tracking for this region
  //           0    = out of stock
  //           n>0  = n units available
  const stockLabel  =stockQty === null  ? null
                    : stockQty === 0     ? 'No Stock'
                    : stockQty <= 10     ? `Low: ${stockQty} left`
                    : `In Stock: ${stockQty}`;
  const stockColor  = stockQty === null  ? null
                    : stockQty === 0     ? { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' }
                    : stockQty <= 10     ? { bg: '#fffbeb', text: '#b45309', border: '#fcd34d' }
                    : { bg: '#f0fdf4', text: '#15803d', border: '#86efac' };

  const accent   = catColor(product.category_name);
  const variants = product.variants || [];
  const rawSizes = product.pack_sizes || [];

  // Build size list:
  // - If a stored size already equals 1× base unit (e.g. "1 KG"), move it to front.
  // - Otherwise prepend a virtual "1 Ltr / 1 Kg / 1 Unit" option.
  const baseLabel = baseUnitLabel(product.unit);
  const isOneUnit = (s) => Math.abs(calcPackPrice(s.size, 1, product.unit) - 1) < 0.01;
  const oneUnitSizes = rawSizes.filter(isOneUnit);
  const bulkSizes    = rawSizes.filter(s => !isOneUnit(s));
  const allSizes = rawSizes.length > 0
    ? oneUnitSizes.length > 0
      ? [...oneUnitSizes, ...bulkSizes]                               // existing 1-unit first
      : [{ size: baseLabel, price: 0, isBase: true }, ...rawSizes]   // prepend virtual 1-unit
    : [];

  const [variant, setVariant] = useState(variants[0] || null);
  const [sizeIdx, setSizeIdx] = useState(0);   // 0 = base unit by default
  const [qty,     setQty]     = useState(1);

  const selectedSize = allSizes[sizeIdx];

  const lineKey = useMemo(
    () => `${product.id}|${variant || ''}|${selectedSize?.size || ''}`,
    [product.id, variant, selectedSize]
  );
  const alreadyAdded = inCart.has(lineKey);

  // Price for the selected pack option (current system price)
  const systemPrice = selectedSize
    ? calcPackPrice(selectedSize.size, product.base_price, product.unit)
    : (product.base_price || 0);

  // Onboarded client: lock to their last billed price for this product+pack —
  // but never charge more than the current system price (lower of the two wins).
  const selPackSize  = selectedSize?.isBase ? '' : (selectedSize?.size || '');
  const clientPrice  = lookupClientPrice(clientPrices, product.id, selPackSize, product.unit);
  const hasClientPrice = clientPrice !== null && clientPrice > 0;
  const effectivePrice = hasClientPrice ? Math.min(clientPrice, systemPrice) : systemPrice;

  const onClickAdd = () => {
    // Unit shown on quote: pack size label if a non-base pack is selected (e.g. "5 Ltr"),
    // otherwise the product's base unit (e.g. "Ltr", "Kg", "Nos")
    const packSize = selPackSize;
    const unit     = packSize || product.unit || 'Nos';

    onAdd({
      product_id:    product.id,
      product_name:  product.name,
      description:   product.description || null,
      category_id:   product.category_id,
      category_name: product.category_name,
      variant:       variant || null,
      pack_size:     packSize,
      unit,
      quantity:      Math.max(1, Number(qty) || 1),
      unit_price:    effectivePrice,
      // Client price is already an approved billed price — using it as system_price
      // avoids re-triggering discount approval for established repeat-order pricing
      system_price:  hasClientPrice ? effectivePrice : systemPrice,
      gst_percent:   product.gst_percent,
      hsn_code:      product.hsn_code,
    });
  };

  return (
    <div className="qcard" style={{
      position: 'relative', overflow: 'hidden', background: '#fff',
      border: `1px solid ${alreadyAdded ? '#86efac' : '#E8EEF6'}`,
      borderRadius: 16, boxShadow: '0 2px 8px rgba(8,42,56,.06)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Category accent stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: `linear-gradient(180deg, ${accent}, ${accent}aa)` }} />

      <div style={{ padding: '13px 14px 14px 17px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <span style={{ width: 36, height: 36, borderRadius: 11, background: tintHex(accent, .14), color: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>
            {product.category_icon || '📦'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 style={{ fontWeight: 800, fontSize: 14, color: '#0F2B3A', lineHeight: 1.25 }} title={product.name}>
                {product.name}
              </h3>
              {stockLabel && (
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                  background: stockColor.bg, color: stockColor.text, border: `1px solid ${stockColor.border}`, whiteSpace: 'nowrap' }}>
                  {stockLabel}
                </span>
              )}
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
              fontSize: 9, fontWeight: 800, color: accent, letterSpacing: '.07em', textTransform: 'uppercase' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
              {product.category_name || 'Product'}
            </span>
          </div>
        </div>

        {product.description && (
          <p className="line-clamp-2" style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.45, marginTop: 7 }} title={product.description}>
            {product.description}
          </p>
        )}
        <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 6 }}>
          GST {product.gst_percent}% · HSN {product.hsn_code || '—'}
        </div>
        {hasClientPrice && (
          <div className="inline-flex items-center gap-1" style={{ marginTop: 7, alignSelf: 'flex-start',
            fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
            🔒 Client {formatINR(effectivePrice)}
            {effectivePrice < systemPrice && (
              <span style={{ color: '#94a3b8', fontWeight: 500, textDecoration: 'line-through' }}>{formatINR(systemPrice)}</span>
            )}
          </div>
        )}

        {/* Variants */}
        {variants.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
            {variants.map((v) => {
              const active = v === variant;
              return (
                <button key={v} type="button" onClick={() => setVariant(v)} style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
                  border: `1.5px solid ${active ? accent : '#E2E8F0'}`,
                  background: active ? tintHex(accent, .12) : '#fff', color: active ? accent : '#64748B',
                }}>{v}</button>
              );
            })}
          </div>
        )}

        {/* Pack + Qty */}
        <div className="grid grid-cols-5 gap-2" style={{ marginTop: 11 }}>
          {allSizes.length > 0 ? (
            <label className="col-span-3" style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <div style={{ marginBottom: 4 }}>Pack size</div>
              <select value={sizeIdx} onChange={(e) => setSizeIdx(Number(e.target.value))}
                style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 9, padding: '8px', fontSize: 13, fontWeight: 600, color: '#0F2B3A', background: '#F8FAFF', outline: 'none' }}>
                {allSizes.map((s, i) => (
                  <option key={`${s.size}-${i}`} value={i}>{s.size} — {formatINR(calcPackPrice(s.size, product.base_price, product.unit))}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="col-span-3" style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <div style={{ marginBottom: 4 }}>Unit price</div>
              <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 9, padding: '8px', background: '#F8FAFF', fontSize: 13.5, fontWeight: 800, color: accent }}>
                {formatINR(effectivePrice)}
              </div>
            </div>
          )}
          <label className="col-span-2" style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            <div style={{ marginBottom: 4 }}>Qty</div>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2E8F0', borderRadius: 9, padding: '8px', fontSize: 13.5, fontWeight: 700, color: '#0F2B3A', outline: 'none' }} />
          </label>
        </div>

        <button type="button" onClick={onClickAdd} style={{
          marginTop: 12, width: '100%', height: 42, borderRadius: 11, cursor: 'pointer',
          border: alreadyAdded ? '1.5px solid #059669' : 'none',
          background: alreadyAdded ? '#F0FDF4' : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          color: alreadyAdded ? '#059669' : '#fff',
          fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: alreadyAdded ? 'none' : `0 5px 14px ${tintHex(accent, .35)}`,
        }}>
          {alreadyAdded ? '✓ Added' : '+ Add to Quote'}
        </button>
      </div>
    </div>
  );
}
