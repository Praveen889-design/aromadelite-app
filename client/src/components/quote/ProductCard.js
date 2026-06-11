import React, { useMemo, useState } from 'react';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

/**
 * Calculate the pack price from the size label and the per-unit base_price.
 * Only multiplies when the pack unit matches the product unit.
 *
 *   unit=ltr + size has "ltr/litre" → qty × base_price   (5ltr @ ₹40 = ₹200)
 *   unit=kg  + size has "kg/KG"    → qty × base_price   (10 KG @ ₹120 = ₹1200)
 *   unit=kg  + size has "gms/gm"   → (qty/1000) × base  (500gms @ ₹250 = ₹125)
 *   unit mismatch / no match       → base_price unchanged
 */
export function calcPackPrice(sizeLabel, basePrice, unit) {
  const base = Number(basePrice) || 0;
  const lbl  = (sizeLabel || '').toLowerCase().trim();
  const u    = (unit || '').toLowerCase().trim();

  if ((u === 'ltr' || u === 'litre' || u === 'l') && /ltr|litre/i.test(lbl)) {
    const qty = parseFloat(lbl);
    if (qty > 0) return Math.round(qty * base);
  }
  if (u === 'kg') {
    // Match "1 KG", "10kg", "1KG" etc.
    if (/\bkg\b/i.test(lbl)) {
      const qty = parseFloat(lbl);
      if (qty > 0) return Math.round(qty * base);
    }
    // Match "500gms", "500 gms", "500gm", "500 grams" — no leading \b needed
    if (/gms?\b|grams?\b/i.test(lbl)) {
      const qty = parseFloat(lbl);
      if (qty > 0) return Math.round((qty / 1000) * base);
    }
  }
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
    <div className="border rounded-xl p-4 transition-shadow flex flex-col bg-white border-slate-200 hover:shadow-md">
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none">{product.category_icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900 text-sm leading-tight" title={product.name}>
              {product.name}
            </h3>
            {stockLabel && (
              <span style={{
                flexShrink: 0,
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                background: stockColor.bg, color: stockColor.text,
                border: `1px solid ${stockColor.border}`,
                whiteSpace: 'nowrap',
              }}>
                {stockLabel}
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2" title={product.description}>
              {product.description}
            </p>
          )}
          <div className="text-[11px] text-slate-400 mt-1">
            GST {product.gst_percent}% · HSN {product.hsn_code || '—'}
          </div>
          {hasClientPrice && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                 style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
              🔒 Client Price {formatINR(effectivePrice)}
              {effectivePrice < systemPrice && (
                <span style={{ color: '#94a3b8', fontWeight: 500, textDecoration: 'line-through' }}>
                  {formatINR(systemPrice)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {variants.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {variants.map((v) => {
            const active = v === variant;
            return (
              <button key={v} type="button" onClick={() => setVariant(v)}
                className={[
                  'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                  active ? 'bg-cyan-600 text-white border-cyan-600'
                         : 'bg-white text-slate-600 border-slate-300 hover:border-cyan-400',
                ].join(' ')}
              >{v}</button>
            );
          })}
        </div>
      )}

      <div className="mt-3 grid grid-cols-5 gap-2">
        {allSizes.length > 0 ? (
          <label className="col-span-3 text-xs text-slate-600">
            <div className="mb-1">Pack size</div>
            <select
              value={sizeIdx}
              onChange={(e) => setSizeIdx(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {allSizes.map((s, i) => (
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
              {formatINR(effectivePrice)}
            </div>
          </div>
        )}
        <label className="col-span-2 text-xs text-slate-600">
          <div className="mb-1">Qty</div>
          <input
            type="number" min={1} value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </label>
      </div>

      <button type="button"
        onClick={onClickAdd}
        className={[
          'mt-3 w-full text-sm font-semibold rounded-lg py-2 transition-colors cursor-pointer',
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
