import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { amountInWords } from '../utils/amountInWords';
import { isNative, downloadPdf, sharePdf } from '../utils/pdfNative';

/* ─── Platform helpers ──────────────────────────────────────── */
const canNativeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const canShareFiles = () =>
  canNativeShare() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] });

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

/** Replace fancy Unicode punctuation with plain ASCII equivalents for PDF rendering */
const pdfSafeText = (str) => {
  if (!str) return str;
  return str
    .replace(/[–—]/g, '-')   // en-dash, em-dash → hyphen
    .replace(/[‘’]/g, "'")   // curly single quotes → straight
    .replace(/[“”]/g, '"')   // curly double quotes → straight
    .replace(/•/g, '*')           // bullet → asterisk
    .replace(/ /g, ' ');          // non-breaking space → space
};

const fmtNum = (n, dec = 2) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: dec }).format(n || 0);

const formatDate = (iso) => {
  if (!iso) return '—';
  // Date-only strings (YYYY-MM-DD) → parse as local midnight to avoid TZ-shift
  // Full ISO timestamps (from Postgres TIMESTAMPTZ) → parse directly
  const s = String(iso);
  const d = s.length === 10 ? new Date(s + 'T00:00:00') : new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};


const WhatsAppIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.47 0 .14 5.33.14 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.57 0 11.9-5.33 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42zM12.05 21.5h-.01a9.6 9.6 0 0 1-4.9-1.34l-.35-.21-3.75.98 1-3.66-.23-.38a9.55 9.55 0 0 1-1.48-5.1c0-5.28 4.3-9.58 9.6-9.58 2.56 0 4.97 1 6.78 2.81a9.5 9.5 0 0 1 2.8 6.78c0 5.28-4.3 9.58-9.46 9.58zm5.45-7.18c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.18.2-.35.22-.65.07a8.18 8.18 0 0 1-2.4-1.48 9.04 9.04 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.5-.5-.67-.5l-.57-.01a1.1 1.1 0 0 0-.8.38c-.27.3-1.04 1.02-1.04 2.48 0 1.47 1.06 2.88 1.2 3.08.16.2 2.1 3.2 5.1 4.5.71.3 1.26.48 1.7.62.7.22 1.35.19 1.86.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z" />
  </svg>
);

const DownloadIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CheckIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ShareIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const SharePdfIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M10 12v6M10 18l-2-2M10 18l2-2"/>
  </svg>
);

// Group items by category — used in WhatsApp message only
const groupByCategory = (items) => {
  const groups = new Map();
  items.forEach((it, idx) => {
    const key = it.category_name || 'Items';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...it, _idx: idx + 1 });
  });
  return [...groups.entries()].map(([name, rows]) => {
    const subtotal = rows.reduce((a, r) => a + (r.line_total || 0), 0);
    return { name, rows, subtotal };
  });
};

const buildTaxSummary = (items) => {
  const buckets = {};
  for (const it of items) {
    const hsn  = it.hsn_code || '';
    const rate = Number(it.gst_percent) || 0;
    const key  = `${hsn}__${rate}`;
    if (!buckets[key]) buckets[key] = { hsn, rate, taxable: 0, cgst: 0, sgst: 0, total_tax: 0 };
    const base = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    const cgst = +(base * rate / 2 / 100).toFixed(2);
    const sgst = +(base * rate / 2 / 100).toFixed(2);
    buckets[key].taxable   += base;
    buckets[key].cgst      += cgst;
    buckets[key].sgst      += sgst;
    buckets[key].total_tax += cgst + sgst;
  }
  return Object.values(buckets).map((b) => ({
    ...b,
    taxable:   +b.taxable.toFixed(2),
    cgst:      +b.cgst.toFixed(2),
    sgst:      +b.sgst.toFixed(2),
    total_tax: +b.total_tax.toFixed(2),
  }));
};

const TH = ({ children, style }) => (
  <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10.5,
    background: '#1a2b5e', color: '#ffffff', borderBottom: 'none',
    borderRight: '1px solid #2d3f72', letterSpacing: 0.3, ...style }}>
    {children}
  </th>
);
const TD = ({ children, style }) => (
  <td style={{ padding: '6px 10px', fontSize: 11, color: '#1e293b',
    borderBottom: '1px solid #e8edf5', borderRight: '1px solid #eef1f7', ...style }}>
    {children}
  </td>
);

export default function QuotePreview() {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [editDates, setEditDates] = useState(false);
  const [datesForm, setDatesForm] = useState({ next_follow_up_date: '', expected_order_date: '' });
  const [savingDates, setSavingDates] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [reviewingMod, setReviewingMod] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const [gettingLink, setGettingLink] = useState(false);
  const [approvalLink, setApprovalLink] = useState('');
  const [linkCopied, setLinkCopied]     = useState(false);
  const [waEnabled,       setWaEnabled]       = useState(false);
  const [sendingWA,       setSendingWA]       = useState(false);
  const [waMessages,      setWaMessages]      = useState([]);
  const [generatingFinal, setGeneratingFinal] = useState(false);
  const [showFinalModal,  setShowFinalModal]  = useState(false);
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);
  const [portalLink,         setPortalLink]         = useState('');
  const [gettingPortalLink,  setGettingPortalLink]  = useState(false);
  const [portalLinkCopied,   setPortalLinkCopied]   = useState(false);
  const docRef    = useRef(null);
  const headerRef = useRef(null);

  const fetchQuote = async () => {
    try {
      const res = await api.get(`/api/quotes/${id}/pdf-data`);
      setData(res.data.pdf);
      setDatesForm({
        next_follow_up_date:  res.data.pdf.quote.next_follow_up_date  || '',
        expected_order_date:  res.data.pdf.quote.expected_order_date  || '',
      });
      // Pre-populate approval link if token already exists
      if (res.data.pdf.quote.client_approval_token) {
        const base = window.location.origin;
        setApprovalLink(`${base}/q/${res.data.pdf.quote.client_approval_token}`);
      }
      // Pre-populate portal link if client already has a token
      if (res.data.pdf.quote.portal_token) {
        const base = window.location.origin;
        setPortalLink(`${base}/portal/${res.data.pdf.quote.portal_token}`);
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load quote');
    }
  };

  const fetchWAMessages = async (quoteId) => {
    try {
      const res = await api.get(`/api/whatsapp/messages?quote_id=${quoteId}`);
      setWaMessages(res.data.messages || []);
    } catch { /* silent — WA may not be configured */ }
  };

  useEffect(() => {
    fetchQuote();
    // Check if WA is configured
    api.get('/api/whatsapp/config')
      .then(({ data }) => { setWaEnabled(!!data.config?.phone_number_id); })
      .catch(() => {});
    fetchWAMessages(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSaveDates = async () => {
    setSavingDates(true);
    try {
      await api.patch(`/api/quotes/${id}/dates`, datesForm);
      toast('Dates updated.', { kind: 'success' });
      setEditDates(false);
      await fetchQuote();
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to save dates', { kind: 'error' });
    } finally {
      setSavingDates(false);
    }
  };

  const isWithoutGst = data?.quote?.gst_mode === 'without_gst';

  const taxSummary = useMemo(() => {
    if (!data || isWithoutGst) return [];
    return buildTaxSummary(data.items);
  }, [data, isWithoutGst]);

  const taxTotals = useMemo(() => {
    return taxSummary.reduce(
      (a, b) => ({
        taxable:   +(a.taxable + b.taxable).toFixed(2),
        cgst:      +(a.cgst    + b.cgst).toFixed(2),
        sgst:      +(a.sgst    + b.sgst).toFixed(2),
        total_tax: +(a.total_tax + b.total_tax).toFixed(2),
      }),
      { taxable: 0, cgst: 0, sgst: 0, total_tax: 0 }
    );
  }, [taxSummary]);

  /* ── Modification diff rows — computed before render ── */
  const diffRows = useMemo(() => {
    if (!data?.modified_items?.length) return [];
    const fmtKey = (it) => `${it.product_id}|${it.variant || ''}|${it.pack_size || ''}`;
    const origMap = {};
    (data.items || []).forEach((it) => { origMap[fmtKey(it)] = it; });
    const modMap  = {};
    (data.modified_items || []).forEach((it) => { modMap[fmtKey(it)] = it; });

    const rows = [];
    // Modified / new / unchanged items
    data.modified_items.forEach((mod, i) => {
      const orig       = origMap[fmtKey(mod)];
      const origPrice  = orig ? Number(orig.unit_price) : null;
      const modPrice   = Number(mod.unit_price);
      const origQty    = orig ? Number(orig.quantity) : null;
      const modQty     = Number(mod.quantity);
      const gst        = Number(mod.gst_percent) || 0;
      const origTotal  = orig != null ? +(origQty * origPrice * (1 + gst / 100)).toFixed(2) : null;
      const modTotal   = +(modQty * modPrice * (1 + gst / 100)).toFixed(2);
      const priceDiff  = orig != null ? +(modPrice - origPrice).toFixed(2) : null;
      const diffPct    = (orig != null && origPrice > 0) ? +((priceDiff / origPrice) * 100).toFixed(1) : null;
      const tag = orig == null ? 'new'
        : priceDiff < 0 ? 'discount'
        : priceDiff > 0 ? 'increase'
        : modQty !== origQty ? 'qty_change'
        : 'unchanged';
      rows.push({ mod, orig, origPrice, modPrice, origQty, modQty, origTotal, modTotal, priceDiff, diffPct, tag, serial: i + 1 });
    });
    // Removed items (in original but not in modified)
    (data.items || []).forEach((orig) => {
      if (!modMap[fmtKey(orig)]) {
        const gst = Number(orig.gst_percent) || 0;
        const origTotal = +(Number(orig.quantity) * Number(orig.unit_price) * (1 + gst / 100)).toFixed(2);
        rows.push({ mod: null, orig, origPrice: Number(orig.unit_price), modPrice: null, origQty: Number(orig.quantity), modQty: null, origTotal, modTotal: null, priceDiff: null, diffPct: null, tag: 'removed', serial: null });
      }
    });
    return rows;
  }, [data]);

  if (error) return <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-4 text-sm">{error}</div>;
  if (!data) return <div className="text-sm text-slate-500">Loading quote…</div>;

  const { quote, client, items, totals } = data;
  const subTotal   = totals.total_amount;
  const roundOff   = +(Math.round(subTotal) - subTotal).toFixed(2);
  const grandTotal = +(subTotal + roundOff).toFixed(2);

  // Firm identity switches with GST mode. Without-GST documents are issued
  // under "Vemuri Life Care" (no GST registration) — GSTIN hidden everywhere.
  const firm = isWithoutGst
    ? { name: 'VEMURI LIFE CARE', gstin: null }
    : { name: 'SRI VEMURI SAI ENTERPRISES', gstin: '36AQJPV7026L2Z5' };
  const colCount = isWithoutGst ? 5 : 7;

  const fileName = `Aromadelite_Quote_${quote.number}.pdf`;

  /* ── Shared PDF builder — smart row-aware page breaks ── */
  const buildPdf = async () => {
    const scale      = 2;
    const containerEl = docRef.current;

    // ── 1. Measure every tagged row BEFORE canvas capture ──────────────────
    // getBoundingClientRect gives CSS pixels; multiply by scale → canvas pixels
    const containerTop = containerEl.getBoundingClientRect().top;
    const rowEls       = containerEl.querySelectorAll('[data-pdf-row]');
    const rowBounds    = Array.from(rowEls)
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          top:    Math.round((r.top    - containerTop) * scale),
          bottom: Math.round((r.bottom - containerTop) * scale),
          keepWithNext: el.dataset.pdfRow === 'cat-header',
        };
      })
      .sort((a, b) => a.top - b.top);

    // Return the largest Y ≤ targetY that does NOT cut through any row.
    // Also respects "keep-with-next": a cat-header is never the last thing on a page.
    const safeCutY = (targetY) => {
      let y = targetY;
      // Walk backward until we're between two rows
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = rowBounds.length - 1; i >= 0; i--) {
          const row = rowBounds[i];
          if (row.top >= y) continue;
          if (row.bottom <= y) {
            // row ends before cut — perfect gap, but check keep-with-next
            if (row.keepWithNext && y === row.bottom) {
              // category header at the very bottom — push cut before it
              y = row.top;
              changed = true;
            }
            break;
          }
          // row straddles y — move cut to just before this row
          y = row.top;
          changed = true;
          break;
        }
      }
      return Math.max(y, 1); // never return 0 (would produce empty page)
    };

    // ── 2. Capture canvases ─────────────────────────────────────────────────
    const [fullCanvas, headerCanvas] = await Promise.all([
      html2canvas(containerEl,       { scale, useCORS: true, backgroundColor: '#ffffff' }),
      html2canvas(headerRef.current, { scale, useCORS: true, backgroundColor: '#ffffff' }),
    ]);

    const pdf   = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const pxToPt  = pageW / fullCanvas.width;
    const pageHpx = pageH / pxToPt;

    const hdrNormH = Math.round((headerCanvas.height / headerCanvas.width) * fullCanvas.width);
    const hdrHpt   = hdrNormH * pxToPt;

    // Reuse ONE temp canvas for all crops
    const tmp    = document.createElement('canvas');
    tmp.width    = fullCanvas.width;
    const tmpCtx = tmp.getContext('2d');

    const crop = (src, srcY, srcH, srcNatW) => {
      const h = Math.ceil(Math.min(srcH, src.height - srcY));
      if (h <= 0) return null;
      tmp.height = h;
      tmpCtx.clearRect(0, 0, tmp.width, h);
      tmpCtx.drawImage(src, 0, srcY, srcNatW, srcH, 0, 0, tmp.width, h);
      return tmp.toDataURL('image/jpeg', 0.92);
    };

    const hdrData = crop(headerCanvas, 0, headerCanvas.height, headerCanvas.width);

    // ── 3. Page 1 — smart cut at first page boundary ────────────────────────
    const rawP1Cut = Math.min(pageHpx, fullCanvas.height);
    const p1Cut    = fullCanvas.height <= pageHpx ? rawP1Cut : safeCutY(rawP1Cut);
    const p1Data   = crop(fullCanvas, 0, p1Cut, fullCanvas.width);
    pdf.addImage(p1Data, 'JPEG', 0, 0, pageW, p1Cut * pxToPt, undefined, 'FAST');

    // ── 4. Page 2+ — header stripe + smart-cut content slice ────────────────
    let srcY = p1Cut;
    while (srcY < fullCanvas.height) {
      pdf.addPage();
      pdf.addImage(hdrData, 'JPEG', 0, 0, pageW, hdrHpt, undefined, 'FAST');

      const contentH = pageHpx - hdrNormH;
      const rawCut   = srcY + contentH;
      const cut      = rawCut >= fullCanvas.height
        ? fullCanvas.height
        : safeCutY(rawCut);

      // Safety: if safeCutY collapsed back to srcY (ultra-tall row), force advance
      const advance = Math.max(cut - srcY, Math.ceil(contentH * 0.1));
      const sliceH  = Math.min(advance, fullCanvas.height - srcY);

      if (sliceH > 0) {
        const sliceData = crop(fullCanvas, srcY, sliceH, fullCanvas.width);
        if (sliceData) {
          pdf.addImage(sliceData, 'JPEG', 0, hdrHpt, pageW, sliceH * pxToPt, undefined, 'FAST');
        }
      }
      srcY += sliceH;
    }
    return pdf;
  };

  const onDownloadPdf = async () => {
    if (!docRef.current) return;
    setDownloading(true);
    try {
      const pdf = await buildPdf();
      await downloadPdf(pdf, fileName);
      toast(isNative() ? 'PDF saved to Documents.' : 'PDF downloaded.', { kind: 'success' });
    } catch (e) {
      toast('PDF export failed.', { kind: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  /* ── Build rich WhatsApp message ───────────────────────────── */
  const buildWhatsAppMessage = () => {
    const ddmm = (iso) => {
      if (!iso) return '—';
      const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const fmtAmt = (n) =>
      new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

    const greeting = client.business_name
      ? `Dear *${client.business_name}* (Attn: ${client.name}),`
      : `Dear *${client.name}*,`;

    // Item lines grouped by category
    const itemLines = [];
    let serial = 1;
    for (const [catName, catItems] of groupByCategory(items).map((g) => [g.name, g.rows])) {
      if (catItems.length) itemLines.push(`\n📦 *${catName}*`);
      for (const it of catItems) {
        const sysP  = it.system_price && it.system_price !== it.unit_price
          ? ` _(was ₹${fmtAmt(it.system_price)})_`
          : '';
        itemLines.push(
          `${serial}. *${it.product_name || it.name}*` +
          (it.variant ? ` – ${it.variant}` : '') +
          `\n   Qty: ${it.quantity} × ₹${fmtAmt(it.unit_price)}${sysP} = *₹${fmtAmt(it.line_total)}*`
        );
        serial++;
      }
    }

    const discountLine = totals.subtotal < items.reduce((s, i) => s + (i.quantity || 0) * (i.system_price || i.unit_price || 0), 0)
      ? `🏷️ Client Discount Applied\n` : '';

    const followUp = quote.next_follow_up_date
      ? `\n📅 *Next Follow-up:* ${ddmm(quote.next_follow_up_date)}` : '';
    const orderDate = quote.expected_order_date
      ? `\n🛒 *Expected Order:* ${ddmm(quote.expected_order_date)}` : '';

    return `🌿 *AROMADELITE*
_${firm.name === 'VEMURI LIFE CARE' ? 'Vemuri Life Care' : 'Sri Vemuri Sai Enterprises'}_

${greeting}

Thank you for your enquiry. Please find your quotation below:

━━━━━━━━━━━━━━━━━━━
📋 *Quote No:* ${quote.number}
📅 *Date:* ${ddmm(quote.created_at)}
⏳ *Valid Till:* ${ddmm(quote.valid_until)}
━━━━━━━━━━━━━━━━━━━
${itemLines.join('\n')}

━━━━━━━━━━━━━━━━━━━
${discountLine}${isWithoutGst
  ? `*TOTAL:    ₹${fmtAmt(grandTotal)}* _(Prices inclusive of GST)_`
  : `Subtotal:  ₹${fmtAmt(totals.subtotal)}\nGST:       ₹${fmtAmt(totals.gst_amount)}\n*TOTAL:    ₹${fmtAmt(grandTotal)}*`}
━━━━━━━━━━━━━━━━━━━${followUp}${orderDate}

📞 *6304382947*
✉️ sales@aromadelite.in
📍 Hyderabad, Telangana

_Reliable supply. Factory-direct pricing. Reach us anytime._
🌿 *Aromadelite Team*`;
  };

  /* ── WhatsApp direct ────────────────────────────────────────── */
  /* ── WhatsApp: always try PDF first on both web and native ── */
  const onShareWhatsApp = async () => {
    if (!docRef.current) return;
    setSharingPdf(true);
    try {
      const pdf  = await buildPdf();
      const name = `Aromadelite_Quote_${quote.number}.pdf`;
      // sharePdf: native → Capacitor Share sheet | web → navigator.share or download
      await sharePdf(pdf, name, `Quote ${quote.number} – Aromadelite`);
      toast('PDF shared.', { kind: 'success' });
    } catch (e) {
      const cancelled = e?.name === 'AbortError' || e?.message === 'Share canceled';
      if (!cancelled) {
        // Last resort: open WhatsApp with text (desktop browsers without share API)
        const msg   = buildWhatsAppMessage();
        const phone = (client.phone || '').replace(/\D/g, '');
        const url   = phone
          ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setSharingPdf(false);
    }
  };

  /* ── Native share sheet (text fallback for web) ────────────── */
  const onNativeShare = async () => {
    const msg = buildWhatsAppMessage();
    if (canNativeShare()) {
      try {
        await navigator.share({ title: `Quote ${quote.number} – Aromadelite`, text: msg });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    onShareWhatsApp();
  };

  /* ── Share / Download PDF ──────────────────────────────────── */
  const onSharePdf = async () => {
    if (!docRef.current) return;
    setSharingPdf(true);
    try {
      const pdf  = await buildPdf();
      const name = `Aromadelite_Quote_${quote.number}.pdf`;
      await sharePdf(pdf, name, `Quote ${quote.number} – Aromadelite`);
      toast('PDF shared.', { kind: 'success' });
    } catch (e) {
      if (e?.message !== 'Share canceled') toast('PDF export failed.', { kind: 'error' });
    } finally {
      setSharingPdf(false);
    }
  };

  /* ── Admin: review modification (approve / reject) ── */
  const onReviewModification = async (decision) => {
    if (decision === 'rejected' && !rejectNote.trim()) {
      setShowRejectInput(true);
      return;
    }
    setReviewingMod(true);
    try {
      await api.patch(`/api/quotes/${id}/modification/review`, {
        decision,
        admin_note: decision === 'rejected' ? rejectNote.trim() : null,
      });
      toast(
        decision === 'approved'
          ? '✅ Modification approved! Associate can now generate the bill.'
          : '❌ Modification rejected. Associate will be notified.',
        { kind: decision === 'approved' ? 'success' : 'info' }
      );
      setShowRejectInput(false);
      setRejectNote('');
      await fetchQuote();
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to review modification', { kind: 'error' });
    } finally {
      setReviewingMod(false);
    }
  };

  const onMarkSent = async () => {
    setMarking(true);
    try {
      await api.patch(`/api/quotes/${id}/status`, { status: 'sent' });
      toast('Quote marked as sent.', { kind: 'success' });
      await fetchQuote();
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update status', { kind: 'error' });
    } finally {
      setMarking(false);
    }
  };

  const onUpdateStatus = async (status) => {
    setShowStatusMenu(false);
    setUpdatingStatus(true);
    try {
      await api.patch(`/api/quotes/${id}/status`, { status });
      const labels = {
        accepted: 'Quote accepted! 🎉',
        modifications_required: 'Marked: Modifications Required.',
        hold: 'Quote placed on Hold.',
        rejected: 'Quote marked as Rejected.',
      };
      toast(labels[status] || 'Status updated.', { kind: status === 'accepted' ? 'success' : 'info' });
      await fetchQuote();
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update status', { kind: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const statusPill = {
    draft:                  'bg-slate-100 text-slate-700',
    sent:                   'bg-blue-100 text-blue-800',
    accepted:               'bg-emerald-100 text-emerald-800',
    modifications_required: 'bg-amber-100 text-amber-800',
    hold:                   'bg-purple-100 text-purple-800',
    rejected:               'bg-rose-100 text-rose-700',
    final_quoted:           'bg-teal-100 text-teal-800',
    order_placed:           'bg-indigo-100 text-indigo-800',
    order_delivered:        'bg-cyan-100 text-cyan-800',
  }[quote.status] || 'bg-slate-100 text-slate-700';

  const statusLabel = {
    draft:                  'Draft',
    sent:                   'Sent',
    accepted:               'Accepted',
    modifications_required: 'Modifications Required',
    hold:                   'Hold',
    rejected:               'Rejected',
    final_quoted:           'Final Quote Ready',
    order_placed:           'Order Placed',
    order_delivered:        'Order Delivered',
  }[quote.status] || quote.status;

  /* Progress steps for the order pipeline */
  const PIPELINE_STEPS = [
    { key: 'draft',          label: 'Draft' },
    { key: 'sent',           label: 'Sent' },
    { key: 'accepted',       label: 'Accepted' },
    { key: 'final_quoted',   label: 'Final Quote' },
    { key: 'order_placed',   label: 'Order Placed' },
    { key: 'order_delivered',label: 'Delivered' },
  ];
  const pipelineIdx = PIPELINE_STEPS.findIndex((s) => s.key === quote.status);
  const showPipeline = pipelineIdx >= 2; // show from 'accepted' onwards

  /* Status options shown after quote is sent */
  const CLIENT_STATUSES = [
    { value: 'accepted',               label: '✅ Accepted',               color: '#059669' },
    { value: 'modifications_required', label: '✏️ Modifications Required',  color: '#d97706' },
    { value: 'hold',                   label: '⏸️ Hold',                    color: '#7c3aed' },
    { value: 'rejected',               label: '❌ Rejected',                color: '#dc2626' },
  ];

  /* ── derive onMobile for label tweaks ── */
  const onMobile = isNative() || (typeof window !== 'undefined' && window.innerWidth < 640);

  const fmtN = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);
  const TAG_CFG = {
    discount:   { bg: '#f0fdf4', border: '#86efac', tag: '#065f46', tagBg: '#dcfce7', label: '▼ Discount'   },
    increase:   { bg: '#fff7ed', border: '#fbbf24', tag: '#9a3412', tagBg: '#ffedd5', label: '▲ Increase'   },
    new:        { bg: '#eff6ff', border: '#93c5fd', tag: '#1e40af', tagBg: '#dbeafe', label: '✦ New'         },
    removed:    { bg: '#fef2f2', border: '#fca5a5', tag: '#991b1b', tagBg: '#fee2e2', label: '✕ Removed'    },
    qty_change: { bg: '#fafaf9', border: '#d6d3d1', tag: '#44403c', tagBg: '#f5f5f4', label: '⇄ Qty Changed' },
    unchanged:  { bg: '#ffffff', border: '#f1f5f9', tag: '#94a3b8', tagBg: '#f8fafc', label: ''              },
  };

  const onRepeatOrder = async () => {
    setRepeating(true);
    try {
      const { data } = await api.post(`/api/quotes/${id}/repeat`);
      toast('🔁 Repeat order created as new draft!', { kind: 'success' });
      navigate(`/quotes/${data.quote.id}`);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to repeat order', { kind: 'error' });
    } finally {
      setRepeating(false);
    }
  };

  const onGetApprovalLink = async () => {
    if (approvalLink) {
      // Already generated — just copy again
      navigator.clipboard?.writeText(approvalLink).catch(() => {});
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
      return;
    }
    setGettingLink(true);
    try {
      const { data: resp } = await api.post(`/api/quotes/${id}/approval-link`);
      setApprovalLink(resp.url);
      navigator.clipboard?.writeText(resp.url).catch(() => {});
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
      toast('📋 Approval link copied to clipboard!', { kind: 'success' });
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to generate link', { kind: 'error' });
    } finally {
      setGettingLink(false);
    }
  };

  const onShareApprovalLink = async () => {
    const url = approvalLink || (await (async () => {
      setGettingLink(true);
      try {
        const { data: resp } = await api.post(`/api/quotes/${id}/approval-link`);
        setApprovalLink(resp.url);
        return resp.url;
      } catch { return null; } finally { setGettingLink(false); }
    })());
    if (!url) return;
    const msg = `Hi ${data?.client?.business_name || data?.client?.name || ''},\n\nPlease review and approve your Aromadelite quotation:\n\n${url}\n\nLet us know if you have any questions!\n🌿 Aromadelite Team`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: `Quotation ${quote.number}`, text: msg, url }).catch(() => {});
    } else {
      const phone = (data?.client?.phone || '').replace(/\D/g, '');
      const wa = phone
        ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(wa, '_blank', 'noopener,noreferrer');
    }
  };

  /* ── Send quote via WhatsApp Cloud API ─────────────────────── */
  const onSendWA = async () => {
    setSendingWA(true);
    try {
      const { data: resp } = await api.post(`/api/whatsapp/send/quote/${id}`);
      toast('✅ WhatsApp message sent to client!', { kind: 'success' });
      setWaMessages((prev) => [resp.message, ...prev].slice(0, 10));
    } catch (e) {
      toast(e?.response?.data?.error || 'WhatsApp send failed', { kind: 'error' });
    } finally {
      setSendingWA(false);
    }
  };

  /* ── Confirm Final Quote (status: accepted → final_quoted) ─── */
  const onConfirmFinalQuote = async (flagDeviation = false) => {
    setGeneratingFinal(true);
    try {
      if (flagDeviation) {
        // Submit for deviation approval (reuse discount approval mechanism)
        await api.post(`/api/quotes/${id}/flag-deviation`);
        toast('⚠️ Deviation flagged — awaiting admin approval.', { kind: 'success' });
      } else {
        await api.patch(`/api/quotes/${id}/status`, { status: 'final_quoted' });
        toast('📋 Final quote generated! Share it with the client.', { kind: 'success' });
      }
      setShowFinalModal(false);
      await fetchQuote();
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed', { kind: 'error' });
    } finally {
      setGeneratingFinal(false);
    }
  };

  /* ── Generic order-flow status updater ─────────────────────── */
  const onAdvanceOrderStatus = async (newStatus, successMsg) => {
    setUpdatingOrderStatus(true);
    try {
      await api.patch(`/api/quotes/${id}/status`, { status: newStatus });
      toast(successMsg, { kind: 'success' });
      await fetchQuote();
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update status', { kind: 'error' });
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  /* ── Get / copy client order portal link ───────────────────── */
  const onGetPortalLink = async () => {
    if (portalLink) {
      navigator.clipboard?.writeText(portalLink).catch(() => {});
      setPortalLinkCopied(true);
      setTimeout(() => setPortalLinkCopied(false), 2500);
      return;
    }
    const clientId = quote.client_id;
    if (!clientId) {
      toast('No client record found. Open the Clients page to create one first.', { kind: 'error' });
      return;
    }
    setGettingPortalLink(true);
    try {
      const { data: resp } = await api.post(`/api/clients/${clientId}/portal-link`);
      const url = resp.url;
      setPortalLink(url);
      navigator.clipboard?.writeText(url).catch(() => {});
      setPortalLinkCopied(true);
      setTimeout(() => setPortalLinkCopied(false), 2500);
      toast('🛒 Portal link copied! Share it with the client.', { kind: 'success' });
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to generate portal link', { kind: 'error' });
    } finally {
      setGettingPortalLink(false);
    }
  };

  const onSharePortalLink = () => {
    if (!portalLink) return;
    const clientDisplay = client.business_name || client.name;
    const msg = `Hi ${clientDisplay},\n\nYou can now place your Aromadelite orders directly using this link:\n\n${portalLink}\n\nBrowse our products, see your prices, and place orders anytime!\n🌿 Aromadelite Team`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'Aromadelite Order Portal', text: msg, url: portalLink }).catch(() => {});
    } else {
      const phone = (client.phone || '').replace(/\D/g, '');
      const wa = phone
        ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(wa, '_blank', 'noopener,noreferrer');
    }
  };

  // Bill already generated for this quote?
  const billGenerated = !!quote.bill_id;
  const billId        = quote.bill_id;
  const billNumber    = quote.bill_number;
  const billPayStatus = quote.bill_payment_status; // 'pending' | 'partial' | 'completed'

  // Block ALL client-facing actions (share/send) while discount approval is pending or rejected
  const discountBlocked = quote.discount_approval_status === 'pending' || quote.discount_approval_status === 'rejected';
  const blockTitle = quote.discount_approval_status === 'pending'
    ? 'Awaiting discount approval — sharing is disabled until an admin approves'
    : quote.discount_approval_status === 'rejected'
    ? 'Discount rejected — revise pricing before sharing'
    : undefined;

  return (
    <div className="space-y-4">

      {/* ══ ADMIN MODIFICATION REVIEW PANEL — pinned at top ══ */}
      {isAdmin && quote.modification_status === 'pending_approval' && (
        <div style={{ border: '2px solid #fb923c', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>

          {/* Banner header */}
          <div style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', padding: '12px 16px', borderBottom: '1.5px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#9a3412' }}>🔔 Modification Pending Your Approval</div>
              <div style={{ fontSize: 12, color: '#7c2d12', marginTop: 2 }}>
                {quote.employee_name || 'Associate'} submitted updated pricing. Review changes below then approve or reject.
              </div>
              {quote.modification_note && (
                <div style={{ marginTop: 6, background: '#fff', border: '1px solid #fed7aa', borderRadius: 7, padding: '6px 10px', fontSize: 12, color: '#7c2d12', fontStyle: 'italic' }}>
                  Note: "{quote.modification_note}"
                </div>
              )}
            </div>
            {/* Totals comparison */}
            {data.modified_totals && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, padding: '8px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Original</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#64748b' }}>₹{fmtN(totals.total_amount)}</div>
                </div>
                <div style={{ fontSize: 20, color: '#94a3b8' }}>→</div>
                <div style={{ textAlign: 'center', background: '#fff7ed', border: '2px solid #fb923c', borderRadius: 9, padding: '8px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modified</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#9a3412' }}>₹{fmtN(data.modified_totals.total_amount)}</div>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 900, padding: '6px 14px', borderRadius: 99,
                  background: data.modified_totals.total_amount < totals.total_amount ? '#dcfce7' : '#ffedd5',
                  color:      data.modified_totals.total_amount < totals.total_amount ? '#065f46' : '#9a3412',
                }}>
                  {data.modified_totals.total_amount < totals.total_amount ? '▼' : '▲'} ₹{fmtN(Math.abs(data.modified_totals.total_amount - totals.total_amount))}
                </div>
              </div>
            )}
          </div>

          {/* Diff table */}
          {diffRows.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 640 }}>
                <thead>
                  <tr style={{ background: '#fff7ed' }}>
                    {['#','Product','Orig Qty','Mod Qty','Orig Price','Client Price','Price Diff','Orig Total','Mod Total','Change'].map((h) => (
                      <th key={h} style={{ padding: '7px 10px', fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa', textAlign: ['#','Orig Qty','Mod Qty'].includes(h) ? 'center' : h === 'Change' ? 'center' : 'right', whiteSpace: 'nowrap' }}>
                        {h === 'Product' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map((r, i) => {
                    const C = TAG_CFG[r.tag] || TAG_CFG.unchanged;
                    const name    = r.mod ? r.mod.product_name : r.orig.product_name;
                    const variant = r.mod ? ([r.mod.variant, r.mod.pack_size].filter(Boolean).join(' · ')) : ([r.orig.variant, r.orig.pack_size].filter(Boolean).join(' · '));
                    const lineChange = r.origTotal != null && r.modTotal != null ? +(r.modTotal - r.origTotal).toFixed(2) : null;
                    return (
                      <tr key={i} style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>{r.serial ?? '—'}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <div style={{ fontWeight: 700, color: r.tag === 'removed' ? '#991b1b' : '#0f172a', textDecoration: r.tag === 'removed' ? 'line-through' : 'none' }}>{name}</div>
                          {variant && <div style={{ fontSize: 10, color: '#94a3b8' }}>{variant}</div>}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b' }}>{r.origQty ?? '—'}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {r.modQty != null ? (
                            <span style={{ fontWeight: 700, color: r.origQty != null && r.modQty !== r.origQty ? '#1d4ed8' : '#374151' }}>
                              {r.modQty}
                              {r.origQty != null && r.modQty !== r.origQty && (
                                <span style={{ fontSize: 10, marginLeft: 3, color: r.modQty > r.origQty ? '#16a34a' : '#dc2626' }}>
                                  ({r.modQty > r.origQty ? '+' : ''}{r.modQty - r.origQty})
                                </span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b' }}>{r.origPrice != null ? `₹ ${fmtN(r.origPrice)}` : '—'}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          {r.modPrice != null ? (
                            <span style={{ fontWeight: 800, color: r.tag === 'discount' ? '#16a34a' : r.tag === 'increase' ? '#dc2626' : '#0f172a' }}>
                              ₹ {fmtN(r.modPrice)}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          {r.priceDiff != null && r.priceDiff !== 0 ? (
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 12, color: r.priceDiff < 0 ? '#16a34a' : '#dc2626' }}>
                                {r.priceDiff > 0 ? '+' : ''}₹ {fmtN(r.priceDiff)}
                              </div>
                              <div style={{ fontSize: 10, color: r.priceDiff < 0 ? '#16a34a' : '#dc2626' }}>
                                ({r.diffPct > 0 ? '+' : ''}{r.diffPct}%)
                              </div>
                            </div>
                          ) : r.tag === 'new' || r.tag === 'removed' ? (
                            <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 11 }}>no change</span>
                          )}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b' }}>{r.origTotal != null ? `₹ ${fmtN(r.origTotal)}` : '—'}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          {r.modTotal != null ? (
                            <span style={{ fontWeight: 700, color: lineChange != null && lineChange < 0 ? '#16a34a' : lineChange != null && lineChange > 0 ? '#dc2626' : '#374151' }}>
                              ₹ {fmtN(r.modTotal)}
                            </span>
                          ) : <span style={{ color: '#dc2626', fontWeight: 700 }}>—</span>}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {C.label && (
                            <span style={{ fontSize: 10, fontWeight: 800, background: C.tagBg, color: C.tag, padding: '3px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                              {C.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#fff7ed', borderTop: '2px solid #fb923c' }}>
                    <td colSpan={7} style={{ padding: '8px 12px', fontWeight: 800, color: '#9a3412', fontSize: 13 }}>Grand Total</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#64748b', fontSize: 13 }}>₹ {fmtN(totals.total_amount)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#9a3412', fontSize: 14 }}>
                      {data.modified_totals ? `₹ ${fmtN(data.modified_totals.total_amount)}` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {data.modified_totals && (
                        <span style={{
                          fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 99,
                          background: data.modified_totals.total_amount < totals.total_amount ? '#dcfce7' : '#ffedd5',
                          color:      data.modified_totals.total_amount < totals.total_amount ? '#065f46' : '#9a3412',
                        }}>
                          {data.modified_totals.total_amount < totals.total_amount ? '▼ ' : '▲ '}
                          ₹ {fmtN(Math.abs(data.modified_totals.total_amount - totals.total_amount))}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div style={{ padding: '16px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
              No modified items data yet.
            </div>
          )}

          {/* Approve / Reject buttons */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #fed7aa', background: '#fffbeb', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
            {showRejectInput && (
              <div style={{ width: '100%' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7c2d12', display: 'block', marginBottom: 4 }}>
                  Reason for rejection (required before confirming)
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. Margin too low — minimum price for Floor Cleaner is ₹38…"
                  style={{ width: '100%', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '7px 10px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#7f1d1d' }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => onReviewModification('approved')}
              disabled={reviewingMod}
              style={{ padding: '10px 22px', borderRadius: 9, border: 'none', cursor: reviewingMod ? 'not-allowed' : 'pointer', background: reviewingMod ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', fontSize: 13, fontWeight: 800 }}
            >
              {reviewingMod ? 'Processing…' : '✅ Approve Modification'}
            </button>
            <button
              type="button"
              onClick={() => { if (!showRejectInput) { setShowRejectInput(true); return; } onReviewModification('rejected'); }}
              disabled={reviewingMod}
              style={{ padding: '10px 22px', borderRadius: 9, border: '1.5px solid #fca5a5', cursor: reviewingMod ? 'not-allowed' : 'pointer', background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 800 }}
            >
              ❌ {showRejectInput ? 'Confirm Reject' : 'Reject'}
            </button>
            {showRejectInput && (
              <button type="button" onClick={() => { setShowRejectInput(false); setRejectNote(''); }}
                style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Action bar — not part of PDF ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">

        {/* Row 1: status chip + quote number */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${statusPill}`}>
            {statusLabel}
          </span>
          <span className="text-xs font-mono text-slate-500">{quote.number}</span>
          {quote.next_follow_up_date && (
            <span className="flex items-center gap-1 bg-cyan-50 border border-cyan-200 text-cyan-700 px-2 py-1 rounded-lg text-xs font-medium">
              📅 Follow-up: {formatDate(quote.next_follow_up_date)}
            </span>
          )}
          {quote.expected_order_date && (
            <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-2 py-1 rounded-lg text-xs font-medium">
              🛒 Exp. Order: {formatDate(quote.expected_order_date)}
            </span>
          )}
        </div>

        {/* Discount approval banner */}
        {quote.discount_approval_status === 'pending' && (
          <div style={{
            background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 10,
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                Awaiting Discount Approval
              </div>
              <div style={{ fontSize: 11, color: '#a16207', marginTop: 1 }}>
                This quote has a {Number(quote.max_discount_pct).toFixed(0)}% discount — above the approval threshold.
                You cannot send it until an admin approves.
              </div>
            </div>
          </div>
        )}
        {quote.discount_approval_status === 'rejected' && (
          <div style={{
            background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10,
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>❌</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
                Discount Rejected
              </div>
              <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 1 }}>
                {quote.discount_approval_note || 'Admin rejected this discount. Please revise the pricing and create a new quote.'}
              </div>
            </div>
          </div>
        )}
        {quote.discount_approval_status === 'approved' && (
          <div style={{
            background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10,
            padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>✅</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>
              Discount approved — you can send this quote.
            </span>
          </div>
        )}

        {/* Client approval response banners */}
        {quote.client_approval_status === 'approved' && (
          <div style={{
            background: '#f0fdf4', border: '2px solid #6ee7b7', borderRadius: 10,
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#065f46' }}>
                Client Approved This Quote!
              </div>
              <div style={{ fontSize: 11, color: '#047857', marginTop: 1 }}>
                {quote.client_approved_by_name
                  ? `${quote.client_approved_by_name} approved on ${new Date(quote.client_approval_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}.`
                  : `Client approved on ${new Date(quote.client_approval_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}.`
                }
                {' '}Mark it Accepted above to generate the bill.
              </div>
            </div>
          </div>
        )}
        {quote.client_approval_status === 'changes_requested' && (
          <div style={{
            background: '#fefce8', border: '1.5px solid #fde047', borderRadius: 10,
            padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>✏️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>
                Client Requested Changes
              </div>
              {quote.client_approval_note && (
                <div style={{ fontSize: 11, color: '#78350f', marginTop: 3, fontStyle: 'italic' }}>
                  "{quote.client_approval_note}"
                </div>
              )}
              <div style={{ fontSize: 11, color: '#78350f', marginTop: 4 }}>
                Review their feedback and create a revised quote or contact them directly.
              </div>
            </div>
          </div>
        )}

        {/* Order pipeline progress bar — visible from 'accepted' onwards */}
        {showPipeline && (
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {PIPELINE_STEPS.slice(2).map((step, i) => {
                const absIdx = i + 2;
                const done   = pipelineIdx > absIdx;
                const active = pipelineIdx === absIdx;
                return (
                  <React.Fragment key={step.key}>
                    {i > 0 && (
                      <div style={{ flex: 1, height: 3, borderRadius: 2, background: done ? '#059669' : active ? '#1F6BC7' : '#e2e8f0' }} />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 11,
                        fontWeight: 800, flexShrink: 0,
                        background: done ? '#059669' : active ? '#1F6BC7' : '#e2e8f0',
                        color: (done || active) ? '#fff' : '#94a3b8',
                        boxShadow: active ? '0 0 0 3px #dbeafe' : 'none',
                      }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: active ? 800 : 600, textAlign: 'center', lineHeight: 1.2,
                        color: done ? '#059669' : active ? '#1F6BC7' : '#94a3b8',
                      }}>
                        {step.label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 2: action buttons — all share/send disabled when discount approval is pending/rejected */}
        <div className="flex flex-wrap gap-2">

          {/* WhatsApp — primary share on mobile */}
          <button
            type="button"
            onClick={onShareWhatsApp}
            disabled={discountBlocked}
            title={blockTitle}
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe59] active:bg-[#17a84e] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ minHeight: 44 }}
          >
            <WhatsAppIcon />
            <span>{onMobile ? 'WhatsApp' : 'Share via WhatsApp'}</span>
          </button>

          {/* Native share sheet (works in Capacitor + modern browsers) */}
          {canNativeShare() && (
            <button
              type="button"
              onClick={onNativeShare}
              disabled={discountBlocked}
              title={blockTitle}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ minHeight: 44 }}
            >
              <ShareIcon />
              <span>{onMobile ? 'Share' : 'Share Quote'}</span>
            </button>
          )}

          {/* Share / Download PDF */}
          <button
            type="button"
            onClick={onSharePdf}
            disabled={sharingPdf || discountBlocked}
            title={blockTitle}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ minHeight: 44 }}
          >
            {canShareFiles() ? <SharePdfIcon /> : <DownloadIcon />}
            <span>
              {sharingPdf
                ? 'Preparing…'
                : canShareFiles()
                  ? (onMobile ? 'Share PDF' : 'Share PDF File')
                  : (downloading ? 'Generating…' : 'Download PDF')}
            </span>
          </button>

          {/* Download PDF separately when share-files is available */}
          {canShareFiles() && (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={downloading || discountBlocked}
              title={blockTitle}
              className="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ minHeight: 44 }}
            >
              <DownloadIcon />
              <span>{downloading ? 'Saving…' : 'Save PDF'}</span>
            </button>
          )}

          {/* Mark as sent (only for draft) */}
          {quote.status === 'draft' && (
            <button
              type="button"
              onClick={onMarkSent}
              disabled={marking || discountBlocked}
              title={blockTitle}
              className="inline-flex items-center gap-2 bg-[#1F6BC7] hover:bg-[#155DA6] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ minHeight: 44 }}
            >
              <CheckIcon />
              <span>{marking ? 'Updating…' : 'Mark Sent'}</span>
            </button>
          )}

          {/* Client response status dropdown — shown once quote is sent, hidden once billed */}
          {['sent', 'modifications_required', 'hold'].includes(quote.status) && !billGenerated && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowStatusMenu((p) => !p)}
                disabled={updatingStatus}
                className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
                style={{ minHeight: 44 }}
              >
                <span>{updatingStatus ? 'Updating…' : '📋 Update Status'}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {showStatusMenu && (
                <div
                  style={{
                    position: 'absolute', top: '110%', left: 0, zIndex: 50,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220,
                    padding: 6,
                  }}
                >
                  {CLIENT_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => onUpdateStatus(s.value)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '9px 14px', fontSize: 13, fontWeight: 600,
                        color: s.color, background: 'transparent', border: 'none',
                        borderRadius: 8, cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {s.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowStatusMenu(false)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '7px 14px', fontSize: 12, color: '#94a3b8',
                      background: 'transparent', border: 'none',
                      borderTop: '1px solid #f1f5f9', marginTop: 4, cursor: 'pointer',
                    }}
                  >Cancel</button>
                </div>
              )}
            </div>
          )}

          {/* ── Order-flow action buttons (hidden once bill is generated) ── */}

          {/* Generate Final Quote — shown when accepted (new order flow) */}
          {quote.status === 'accepted' && !billGenerated && (
            <button
              type="button"
              onClick={() => setShowFinalModal(true)}
              className="inline-flex items-center gap-2 text-white text-sm font-bold rounded-xl px-5 py-2.5 shadow-sm"
              style={{ minHeight: 44, background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}
            >
              <span>📋 Generate Final Quote</span>
            </button>
          )}

          {/* Mark Order Placed — shown when final_quoted */}
          {quote.status === 'final_quoted' && !billGenerated && (
            <button
              type="button"
              onClick={() => onAdvanceOrderStatus('order_placed', '📦 Order marked as placed!')}
              disabled={updatingOrderStatus}
              className="inline-flex items-center gap-2 text-white text-sm font-bold rounded-xl px-5 py-2.5 shadow-sm disabled:opacity-60"
              style={{ minHeight: 44, background: 'linear-gradient(135deg, #4f46e5, #4338ca)' }}
            >
              <span>{updatingOrderStatus ? 'Updating…' : '📦 Mark Order Placed'}</span>
            </button>
          )}

          {/* Mark Order Delivered — shown when order_placed */}
          {quote.status === 'order_placed' && !billGenerated && (
            <button
              type="button"
              onClick={() => onAdvanceOrderStatus('order_delivered', '🚚 Order marked as delivered!')}
              disabled={updatingOrderStatus}
              className="inline-flex items-center gap-2 text-white text-sm font-bold rounded-xl px-5 py-2.5 shadow-sm disabled:opacity-60"
              style={{ minHeight: 44, background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
            >
              <span>{updatingOrderStatus ? 'Updating…' : '🚚 Mark Order Delivered'}</span>
            </button>
          )}

          {/* Generate Bill — shown when order_delivered OR modification flow approved — only if NOT yet billed */}
          {(quote.status === 'order_delivered' || quote.modification_status === 'approved') && !billGenerated && (
            <button
              type="button"
              onClick={() => navigate(`/bills/new/${id}`)}
              className="inline-flex items-center gap-2 text-white text-sm font-bold rounded-xl px-5 py-2.5 shadow-sm"
              style={{ minHeight: 44, background: 'linear-gradient(135deg, #059669, #047857)' }}
            >
              <span>🧾 Generate Bill</span>
            </button>
          )}

          {/* View Bill — shown once a bill has been generated */}
          {billGenerated && (
            <button
              type="button"
              onClick={() => navigate(`/bills/${billId}`)}
              className="inline-flex items-center gap-2 text-white text-sm font-bold rounded-xl px-5 py-2.5 shadow-sm"
              style={{ minHeight: 44, background: 'linear-gradient(135deg, #0369a1, #0284c7)' }}
            >
              <span>
                {billPayStatus === 'completed' ? '✅' : billPayStatus === 'partial' ? '💰' : '🧾'}
                {' '}View Bill {billNumber ? `· ${billNumber}` : ''}
              </span>
            </button>
          )}

          {/* ✏️ Edit & Resubmit — associate sees this when modifications_required + no pending approval */}
          {quote.status === 'modifications_required' &&
            !quote.modification_status && (
            <button
              type="button"
              onClick={() => navigate(`/quotes/${id}/modify`)}
              className="inline-flex items-center gap-2 text-white text-sm font-bold rounded-xl px-5 py-2.5 shadow-sm"
              style={{ minHeight: 44, background: 'linear-gradient(135deg, #d97706, #b45309)' }}
            >
              <span>✏️ Edit &amp; Resubmit</span>
            </button>
          )}

          {/* Re-edit after rejection */}
          {quote.status === 'modifications_required' &&
            quote.modification_status === 'rejected' && (
            <button
              type="button"
              onClick={() => navigate(`/quotes/${id}/modify`)}
              className="inline-flex items-center gap-2 text-white text-sm font-bold rounded-xl px-5 py-2.5 shadow-sm"
              style={{ minHeight: 44, background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
            >
              <span>✏️ Re-edit &amp; Resubmit</span>
            </button>
          )}

          {/* 🔁 Repeat Order */}
          <button
            type="button"
            onClick={onRepeatOrder}
            disabled={repeating}
            className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
            style={{ minHeight: 44, background: '#f0fdf4', color: '#15803d', border: '1.5px solid #86efac' }}
          >
            <span>{repeating ? 'Creating…' : '🔁 Repeat Order'}</span>
          </button>

          {/* 📋 Client Approval Link */}
          <button
            type="button"
            onClick={onGetApprovalLink}
            disabled={gettingLink || discountBlocked}
            title={discountBlocked ? 'Resolve discount approval first' : approvalLink ? 'Copy link again' : 'Generate a link to share with client for approval'}
            className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: 44, background: '#eff6ff', color: '#1d4ed8', border: '1.5px solid #93c5fd' }}
          >
            <span>
              {gettingLink ? 'Generating…'
                : linkCopied ? '✅ Link Copied!'
                : approvalLink ? '📋 Copy Approval Link'
                : '📋 Get Client Approval Link'}
            </span>
          </button>

          {/* WhatsApp share of approval link */}
          {approvalLink && !discountBlocked && (
            <button
              type="button"
              onClick={onShareApprovalLink}
              className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm"
              style={{ minHeight: 44, background: '#f0fdf4', color: '#15803d', border: '1.5px solid #86efac' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.47 0 .14 5.33.14 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.57 0 11.9-5.33 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42z" />
              </svg>
              <span>Send to Client</span>
            </button>
          )}

          {/* WhatsApp Cloud API send — shown only when WA is configured */}
          {waEnabled && (
            <button
              type="button"
              onClick={onSendWA}
              disabled={sendingWA || discountBlocked}
              title={discountBlocked ? blockTitle : 'Send quote directly via WhatsApp Business API'}
              className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ minHeight: 44, background: '#075e54', color: '#fff', border: 'none' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.47 0 .14 5.33.14 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.57 0 11.9-5.33 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42z" />
              </svg>
              <span>{sendingWA ? 'Sending…' : '📲 Send via API'}</span>
            </button>
          )}

          <Link
            to="/quotes/new"
            className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl px-4 py-2.5"
            style={{ minHeight: 44 }}
          >← Builder</Link>
        </div>

        {/* ── Approval link display row ── */}
        {approvalLink && !discountBlocked && (
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5 }}>
              🔗 Client Approval Link
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                readOnly
                value={approvalLink}
                onFocus={(e) => e.target.select()}
                style={{
                  flex: 1, border: '1px solid #bfdbfe', borderRadius: 8,
                  padding: '6px 10px', fontSize: 11, color: '#1e40af',
                  background: '#eff6ff', outline: 'none', fontFamily: 'monospace',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              />
              <button
                type="button"
                onClick={onGetApprovalLink}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 8,
                  border: '1px solid #bfdbfe', background: linkCopied ? '#dcfce7' : '#eff6ff',
                  color: linkCopied ? '#15803d' : '#1d4ed8', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {linkCopied ? '✅ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>
        )}

        {/* ── Client Order Portal link section ── */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            🛒 Client Order Portal
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={onGetPortalLink}
              disabled={gettingPortalLink}
              title={portalLink ? 'Copy portal link again' : 'Generate a permanent order portal link for this client'}
              className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: 40, background: '#fdf4ff', color: '#7c3aed', border: '1.5px solid #d8b4fe' }}
            >
              <span>
                {gettingPortalLink ? 'Generating…'
                  : portalLinkCopied ? '✅ Link Copied!'
                  : portalLink ? '📋 Copy Portal Link'
                  : '🛒 Get Client Order Link'}
              </span>
            </button>
            {portalLink && (
              <button
                type="button"
                onClick={onSharePortalLink}
                className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm"
                style={{ minHeight: 40, background: '#f0fdf4', color: '#15803d', border: '1.5px solid #86efac' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.47 0 .14 5.33.14 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.57 0 11.9-5.33 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42z" />
                </svg>
                <span>Send via WhatsApp</span>
              </button>
            )}
          </div>
          {portalLink && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
              <input
                readOnly
                value={portalLink}
                onFocus={(e) => e.target.select()}
                style={{
                  flex: 1, border: '1px solid #d8b4fe', borderRadius: 8,
                  padding: '6px 10px', fontSize: 11, color: '#6d28d9',
                  background: '#fdf4ff', outline: 'none', fontFamily: 'monospace',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              />
              <button
                type="button"
                onClick={onGetPortalLink}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 8,
                  border: '1px solid #d8b4fe',
                  background: portalLinkCopied ? '#dcfce7' : '#fdf4ff',
                  color: portalLinkCopied ? '#15803d' : '#7c3aed',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {portalLinkCopied ? '✅ Copied' : '📋 Copy'}
              </button>
            </div>
          )}
        </div>

        {/* ── WhatsApp API message log ── */}
        {waEnabled && waMessages.length > 0 && (
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              📲 WhatsApp API — Recent Messages
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {waMessages.slice(0, 5).map((m) => {
                const statusColor = {
                  sent:      { bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', label: 'Sent' },
                  delivered: { bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e', label: 'Delivered' },
                  read:      { bg: '#f0fdf4', border: '#86efac', dot: '#059669', label: 'Read ✓✓' },
                  failed:    { bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444', label: 'Failed' },
                  pending:   { bg: '#fafaf9', border: '#e7e5e4', dot: '#a8a29e', label: 'Pending' },
                }[m.status] || { bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8', label: m.status };
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: statusColor.bg, border: `1px solid ${statusColor.border}`,
                    borderRadius: 7, padding: '5px 10px', fontSize: 11,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: statusColor.dot, display: 'inline-block' }} />
                    <span style={{ flex: 1, color: '#374151' }}>
                      <strong>{m.message_type}</strong> → {m.to_name || m.to_phone}
                    </span>
                    <span style={{ color: statusColor.dot, fontWeight: 700 }}>{statusColor.label}</span>
                    <span style={{ color: '#94a3b8', marginLeft: 6 }}>
                      {new Date(m.sent_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Follow-up / Expected Order date editor ── */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
          {!editDates ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  📅 <strong>Follow-up:</strong>{' '}
                  <span style={{ color: quote.next_follow_up_date ? '#1F6BC7' : '#94a3b8' }}>
                    {quote.next_follow_up_date ? formatDate(quote.next_follow_up_date) : 'Not set'}
                  </span>
                </span>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  🛒 <strong>Exp. Order:</strong>{' '}
                  <span style={{ color: quote.expected_order_date ? '#d97706' : '#94a3b8' }}>
                    {quote.expected_order_date ? formatDate(quote.expected_order_date) : 'Not set'}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditDates(true)}
                style={{
                  fontSize: 12, fontWeight: 600, color: '#1F6BC7',
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >✏️ Edit Dates</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>📅 Next Follow-up Date</div>
                <input
                  type="date"
                  value={datesForm.next_follow_up_date}
                  onChange={(e) => setDatesForm((p) => ({ ...p, next_follow_up_date: e.target.value }))}
                  style={{
                    border: '1.5px solid #93C5FD', borderRadius: 8,
                    padding: '7px 10px', fontSize: 13, outline: 'none',
                    color: '#1e293b', background: '#fff',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>🛒 Expected Order Date</div>
                <input
                  type="date"
                  value={datesForm.expected_order_date}
                  min={datesForm.next_follow_up_date || undefined}
                  onChange={(e) => setDatesForm((p) => ({ ...p, expected_order_date: e.target.value }))}
                  style={{
                    border: '1.5px solid #FCD34D', borderRadius: 8,
                    padding: '7px 10px', fontSize: 13, outline: 'none',
                    color: '#1e293b', background: '#fff',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={onSaveDates}
                  disabled={savingDates}
                  style={{
                    fontSize: 13, fontWeight: 700, color: '#fff',
                    background: savingDates ? '#93C5FD' : '#1F6BC7',
                    border: 'none', borderRadius: 8,
                    padding: '8px 16px', cursor: savingDates ? 'not-allowed' : 'pointer',
                    minHeight: 38,
                  }}
                >{savingDates ? 'Saving…' : '✓ Save'}</button>
                <button
                  type="button"
                  onClick={() => setEditDates(false)}
                  style={{
                    fontSize: 13, fontWeight: 600, color: '#64748b',
                    background: '#fff', border: '1px solid #e2e8f0',
                    borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                    minHeight: 38,
                  }}
                >Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ ORDER FLOW BANNERS ════════════════════════════ */}

      {/* ── Bill already generated — lock banner ── */}
      {billGenerated && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '2px solid #6ee7b7', borderRadius: 14,
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>
            {billPayStatus === 'completed' ? '✅' : billPayStatus === 'partial' ? '💰' : '🧾'}
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#15803d' }}>
              Bill Generated — {billPayStatus === 'completed' ? 'Fully Paid' : billPayStatus === 'partial' ? 'Partially Paid' : 'Awaiting Payment'}
            </div>
            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 3 }}>
              {billNumber ? `Bill ${billNumber} has been created for this quote.` : 'A bill has already been created for this quote.'}
              {' '}All quote actions are locked. Use the bill page to record payments.
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/bills/${billId}`)}
            style={{
              flexShrink: 0, padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #0369a1, #0284c7)', color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {billPayStatus === 'completed' ? '✅ View Bill' : '💳 Go to Bill & Pay'}
          </button>
        </div>
      )}

      {/* accepted → generate final quote */}
      {quote.status === 'accepted' && !billGenerated && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)',
          border: '2px solid #6ee7b7', borderRadius: 14,
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>✅</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#065f46' }}>
              Quote Accepted — Next: Generate Final Quote
            </div>
            <div style={{ fontSize: 12, color: '#047857', marginTop: 3 }}>
              The client has approved this quote. Review items and pricing, then generate the final quote to proceed.
              If anything has changed, flag it as a deviation for admin approval.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFinalModal(true)}
            style={{
              flexShrink: 0, padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            📋 Generate Final Quote
          </button>
        </div>
      )}

      {/* final_quoted → share with client + mark order placed */}
      {quote.status === 'final_quoted' && !billGenerated && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdfa, #e6fffa)',
          border: '2px solid #14b8a6', borderRadius: 14,
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>📋</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#0f766e' }}>
              Final Quote Ready — Share with Client
            </div>
            <div style={{ fontSize: 12, color: '#0d9488', marginTop: 3 }}>
              Share the final quote with the client using the WhatsApp or PDF buttons above.
              Once the client confirms and places the order, mark it below.
            </div>
            {quote.final_quote_generated_at && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                📅 Generated: {formatDate(quote.final_quote_generated_at)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onAdvanceOrderStatus('order_placed', '📦 Order marked as placed!')}
            disabled={updatingOrderStatus}
            style={{
              flexShrink: 0, padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#fff',
              fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
              cursor: updatingOrderStatus ? 'not-allowed' : 'pointer',
              opacity: updatingOrderStatus ? 0.6 : 1,
            }}
          >
            {updatingOrderStatus ? 'Updating…' : '📦 Mark Order Placed'}
          </button>
        </div>
      )}

      {/* order_placed → mark order delivered */}
      {quote.status === 'order_placed' && !billGenerated && (
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
          border: '2px solid #93c5fd', borderRadius: 14,
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>📦</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1e40af' }}>
              Order Placed — Awaiting Delivery
            </div>
            <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 3 }}>
              The client has confirmed this order. Mark it as delivered once the goods reach the client.
            </div>
            {quote.order_placed_at && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                📅 Placed on: {formatDate(quote.order_placed_at)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onAdvanceOrderStatus('order_delivered', '🚚 Order marked as delivered!')}
            disabled={updatingOrderStatus}
            style={{
              flexShrink: 0, padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff',
              fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
              cursor: updatingOrderStatus ? 'not-allowed' : 'pointer',
              opacity: updatingOrderStatus ? 0.6 : 1,
            }}
          >
            {updatingOrderStatus ? 'Updating…' : '🚚 Mark Order Delivered'}
          </button>
        </div>
      )}

      {/* order_delivered → generate bill */}
      {quote.status === 'order_delivered' && !billGenerated && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '2px solid #6ee7b7', borderRadius: 14,
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>🚚</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#15803d' }}>
              Order Delivered! — Generate the Bill
            </div>
            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 3 }}>
              The order has been successfully delivered to the client. You can now generate the final bill.
            </div>
            {quote.order_delivered_at && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                📅 Delivered on: {formatDate(quote.order_delivered_at)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(`/bills/new/${id}`)}
            style={{
              flexShrink: 0, padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            🧾 Generate Bill
          </button>
        </div>
      )}

      {/* ══ Modification Workflow Banners ════════════════════════════ */}

      {/* ⏳ Pending approval — seen by associate */}
      {quote.modification_status === 'pending_approval' && !isAdmin && (
        <div style={{
          background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12,
          padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>⏳</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#92400e' }}>Awaiting Admin Approval</div>
            <div style={{ fontSize: 12, color: '#78350f', marginTop: 3 }}>
              Your modified quote has been submitted. The admin will review and approve or reject it.
            </div>
            {quote.modification_note && (
              <div style={{ fontSize: 12, color: '#78350f', marginTop: 6, fontStyle: 'italic' }}>
                Your note: "{quote.modification_note}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✅ Approved — seen by associate */}
      {quote.modification_status === 'approved' && !isAdmin && (
        <div style={{
          background: '#f0fdf4', border: '1.5px solid #6ee7b7', borderRadius: 12,
          padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>✅</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#065f46' }}>Modification Approved!</div>
            <div style={{ fontSize: 12, color: '#047857', marginTop: 3 }}>
              Admin has approved your updated quote. Click "📄 Generate Bill" above to create the bill.
            </div>
            {quote.admin_note && (
              <div style={{ fontSize: 12, color: '#047857', marginTop: 4, fontStyle: 'italic' }}>
                Admin note: "{quote.admin_note}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* ❌ Rejected — seen by associate */}
      {quote.modification_status === 'rejected' && !isAdmin && (
        <div style={{
          background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12,
          padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>❌</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#991b1b' }}>Modification Rejected</div>
            <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 3 }}>
              Admin has rejected your modification request. Click "✏️ Re-edit &amp; Resubmit" to make changes.
            </div>
            {quote.admin_note && (
              <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 4, fontWeight: 600 }}>
                Reason: "{quote.admin_note}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Admin: approved / rejected compact pills ── */}
      {isAdmin && quote.modification_status === 'approved' && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#065f46' }}>
          ✅ <strong>You approved</strong> this modification.{quote.admin_note ? ` Note: "${quote.admin_note}"` : ''} Associate can now generate the bill.
        </div>
      )}
      {isAdmin && quote.modification_status === 'rejected' && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#991b1b' }}>
          ❌ <strong>You rejected</strong> this modification.{quote.admin_note ? ` Reason: "${quote.admin_note}"` : ''} Associate will re-edit and resubmit.
        </div>
      )}

      {/* ══ FINAL QUOTE CONFIRMATION MODAL ════════════════════════════ */}
      {showFinalModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => { if (!generatingFinal) setShowFinalModal(false); }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 18, padding: 28,
              maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f766e', marginBottom: 8 }}>
              📋 Generate Final Quote
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 20 }}>
              Are the prices and quantities the same as the accepted quote, or do any items differ?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => onConfirmFinalQuote(false)}
                disabled={generatingFinal}
                style={{
                  padding: '13px 20px', borderRadius: 10, border: 'none', textAlign: 'left',
                  cursor: generatingFinal ? 'not-allowed' : 'pointer',
                  background: generatingFinal ? '#99f6e4' : 'linear-gradient(135deg, #0d9488, #0f766e)',
                  color: '#fff', fontSize: 14, fontWeight: 800,
                }}
              >
                ✅ Confirm — No changes, same as accepted quote
              </button>
              <button
                type="button"
                onClick={() => onConfirmFinalQuote(true)}
                disabled={generatingFinal}
                style={{
                  padding: '13px 20px', borderRadius: 10, textAlign: 'left',
                  border: '1.5px solid #f59e0b',
                  cursor: generatingFinal ? 'not-allowed' : 'pointer',
                  background: '#fffbeb', color: '#92400e', fontSize: 14, fontWeight: 800,
                }}
              >
                ⚠️ Flag Deviation — Prices / quantities differ (needs admin approval)
              </button>
              <button
                type="button"
                onClick={() => setShowFinalModal(false)}
                disabled={generatingFinal}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF-capturable document */}
      <div style={{ background: '#e8edf5', padding: '28px 24px', borderRadius: 12 }}>
        <div
          ref={docRef}
          style={{
            width: 794, background: '#ffffff',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 11, color: '#1e293b', margin: '0 auto',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          }}
        >
          {/* ══ HEADER BAND ══ */}
          <div ref={headerRef}>
            {/* Top accent stripe */}
            <div style={{ height: 5, background: 'linear-gradient(90deg, #1a2b5e 0%, #1F6BC7 60%, #38bdf8 100%)' }} />

            {/* Company block */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 28px 16px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
              {/* Logo */}
              <div style={{ width: 100, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src="/aromadelite-logo.png" alt="Aromadelite" style={{ width: 100, height: 'auto', maxHeight: 64, objectFit: 'contain' }} />
              </div>
              {/* Company info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 19, fontWeight: 900, color: '#1a2b5e', letterSpacing: 0.5, lineHeight: 1.1 }}>
                  {firm.name}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, letterSpacing: 0.1 }}>
                  SAI NAGAR HNO 8-229/8, NVV NAGAR, CHINTAL, QUTHBULLAPUR, MALKAJGIRI – 500054
                </div>
                <div style={{ display: 'flex', gap: 24, marginTop: 5, fontSize: 10, color: '#475569' }}>
                  <span>📞 +91 63043 82947</span>
                  <span>✉ contact@aromadelite.in</span>
                  <span>🌐 aromadelite.in</span>
                </div>
                {firm.gstin && (
                  <div style={{ display: 'flex', gap: 24, marginTop: 3, fontSize: 10, color: '#475569' }}>
                    <span><strong style={{ color: '#1a2b5e' }}>GSTIN:</strong> {firm.gstin}</span>
                    <span><strong style={{ color: '#1a2b5e' }}>State:</strong> 36-Telangana</span>
                  </div>
                )}
              </div>
              {/* QUOTATION label */}
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1a2b5e', letterSpacing: 2, textTransform: 'uppercase', lineHeight: 1 }}>
                  QUOTATION
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1F6BC7', marginTop: 4, letterSpacing: 0.5 }}>
                  {quote.number}
                </div>
              </div>
            </div>
          </div>
          {/* ══ END HEADER BAND ══ */}

          {/* ── Bill To / Quote Details ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            {/* Bill To */}
            <div style={{ padding: '14px 20px', borderRight: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#94a3b8', marginBottom: 8 }}>
                BILL TO
              </div>
              {client.business_name && (
                <div style={{ fontWeight: 900, fontSize: 13, color: '#1a2b5e', lineHeight: 1.2 }}>{client.business_name}</div>
              )}
              <div style={{ fontWeight: client.business_name ? 600 : 800, fontSize: client.business_name ? 11 : 13, color: '#334155', marginTop: client.business_name ? 2 : 0 }}>
                {client.name}
              </div>
              {client.type && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{client.type}</div>}
              {client.city && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{client.city}</div>}
              {client.phone && (
                <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                  <strong>Contact:</strong> {client.phone}
                </div>
              )}
              {client.requirement_type && (
                <div style={{ marginTop: 8 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8,
                    background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: 20,
                    display: 'inline-block',
                  }}>
                    {client.requirement_type}
                  </span>
                </div>
              )}
            </div>
            {/* Quote Details */}
            <div style={{ padding: '14px 20px' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#94a3b8', marginBottom: 8 }}>
                QUOTE DETAILS
              </div>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {[
                    ['Quote No.', quote.number, '#1F6BC7', true],
                    ['Date', formatDate(quote.created_at), null, false],
                    ['Valid Until', formatDate(quote.valid_until), null, false],
                    ...(quote.next_follow_up_date ? [['Follow-up', formatDate(quote.next_follow_up_date), null, false]] : []),
                  ].map(([label, value, color, bold]) => (
                    <tr key={label}>
                      <td style={{ padding: '3px 0', fontSize: 10, color: '#64748b', width: 80, verticalAlign: 'top' }}>{label}</td>
                      <td style={{ padding: '3px 0', fontSize: 10, color: '#475569', width: 10 }}>:</td>
                      <td style={{ padding: '3px 0', fontSize: 10, fontWeight: bold ? 800 : 600, color: color || '#1e293b' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isWithoutGst && (
                <div style={{ marginTop: 10 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8,
                    background: '#ede9fe', color: '#5b21b6', padding: '3px 10px', borderRadius: 20,
                    display: 'inline-block',
                  }}>
                    Prices Excl. GST · CGST + SGST Applicable
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Items Table ── */}
          {/* With GST:  # | Product | Qty | Unit | Base Price | GST | Amount
              Without GST: # | Product | Qty | Unit | Amount  (no GST shown) */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH style={{ width: 30, textAlign: 'center', paddingLeft: 10 }}>#</TH>
                <TH>Product Name</TH>
                <TH style={{ width: 58, textAlign: 'right' }}>Qty</TH>
                <TH style={{ width: 44, textAlign: 'center' }}>Unit</TH>
                {!isWithoutGst && <TH style={{ width: 88, textAlign: 'right' }}>Base Price (₹)</TH>}
                {!isWithoutGst && <TH style={{ width: 84, textAlign: 'right' }}>GST (₹)</TH>}
                <TH style={{ width: 96, textAlign: 'right', borderRight: 'none', paddingRight: 14 }}>Amount (₹)</TH>
              </tr>
            </thead>
            <tbody>
              {groupByCategory(items).map((group) => (
                <React.Fragment key={group.name}>
                  {/* ── Category header row ── */}
                  <tr data-pdf-row="cat-header">
                    <td colSpan={colCount} style={{
                      padding: '6px 14px 6px 12px',
                      background: '#f1f5f9',
                      borderTop: '1px solid #e2e8f0',
                      borderBottom: '1px solid #e2e8f0',
                      borderLeft: '3px solid #1F6BC7',
                      fontWeight: 800,
                      fontSize: 10.5,
                      color: '#1e40af',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}>
                      {group.rows[0]?.category_icon && (
                        <span style={{ marginRight: 6 }}>{group.rows[0].category_icon}</span>
                      )}
                      {group.name}
                    </td>
                  </tr>
                  {/* ── Items in this category ── */}
                  {group.rows.map((it, i) => {
                    const lineTotal = it.line_total || 0;
                    const gst       = Number(it.gst_percent) || 0;
                    const lineBase  = +((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)).toFixed(2);
                    const lineGst   = +(lineBase * gst / 100).toFixed(2);
                    return (
                      <tr key={it._idx} data-pdf-row="item" style={{ background: i % 2 === 0 ? '#ffffff' : '#fafbfd' }}>
                        <TD style={{ textAlign: 'center', color: '#94a3b8', fontSize: 10, paddingLeft: 10 }}>{it._idx}</TD>
                        <TD style={{ paddingLeft: 14 }}>
                          <span style={{ fontWeight: 700, color: '#1e293b' }}>{it.product_name}</span>
                          {it.variant && (
                            <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 10 }}>
                              {' '}· {it.variant}
                            </span>
                          )}
                          {it.description && (
                            <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 400, marginTop: 2, lineHeight: 1.35 }}>
                              {pdfSafeText(it.description)}
                            </div>
                          )}
                        </TD>
                        <TD style={{ textAlign: 'right', fontWeight: 600 }}>{fmtNum(it.quantity, 0)}</TD>
                        <TD style={{ textAlign: 'center', color: '#64748b', fontSize: 10 }}>{it.unit || 'Nos'}</TD>
                        {!isWithoutGst && (
                          <TD style={{ textAlign: 'right' }}>
                            {it.system_price && it.system_price > it.unit_price ? (
                              <div>
                                <div style={{ textDecoration: 'line-through', color: '#cbd5e1', fontSize: 9 }}>
                                  ₹ {fmtNum(it.system_price)}
                                </div>
                                <div style={{ color: '#059669', fontWeight: 700 }}>₹ {fmtNum(it.unit_price)}</div>
                              </div>
                            ) : <span style={{ color: '#334155' }}>₹ {fmtNum(it.unit_price)}</span>}
                          </TD>
                        )}
                        {!isWithoutGst && (
                          <TD style={{ textAlign: 'right', color: '#475569' }}>
                            ₹ {fmtNum(lineGst)}
                            <span style={{ color: '#94a3b8', fontSize: 9 }}> ({gst}%)</span>
                          </TD>
                        )}
                        <TD style={{ textAlign: 'right', fontWeight: 700, color: '#1e293b', borderRight: 'none', paddingRight: 14 }}>
                          ₹ {fmtNum(lineTotal)}
                        </TD>
                      </tr>
                    );
                  })}
                  {/* ── Category subtotal row ── */}
                  <tr data-pdf-row="subtotal" style={{ background: '#f8fafc' }}>
                    <td colSpan={colCount - 1} style={{
                      padding: '5px 14px 5px 10px', fontSize: 10, textAlign: 'right',
                      color: '#475569', borderBottom: '1px solid #e2e8f0',
                      borderRight: '1px solid #eef1f7', fontStyle: 'italic',
                    }}>
                      {group.name} subtotal
                    </td>
                    <td style={{
                      padding: '5px 14px 5px 10px', fontSize: 10.5, textAlign: 'right',
                      color: '#1e40af', fontWeight: 800, borderBottom: '1px solid #e2e8f0',
                    }}>
                      ₹ {fmtNum(group.subtotal)}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
              {/* ── Grand Total row ── */}
              <tr style={{ background: '#1a2b5e' }}>
                <td colSpan={2} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 900, color: '#ffffff', paddingLeft: 14 }}>
                  TOTAL
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                  {fmtNum(items.reduce((s, it) => s + (Number(it.quantity) || 0), 0), 0)}
                </td>
                <td style={{ padding: '10px 8px' }}></td>
                {!isWithoutGst && <td style={{ padding: '10px 8px' }}></td>}
                {!isWithoutGst && <td style={{ padding: '10px 8px' }}></td>}
                <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
                  ₹ {fmtNum(subTotal)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ══ TAX SUMMARY (With GST only) ══ */}
          {!isWithoutGst && taxSummary.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ borderRight: '1px solid #e2e8f0' }}>
                <div style={{ background: '#f1f5f9', padding: '6px 12px', fontWeight: 800, fontSize: 10.5, color: '#1e40af', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Tax Summary
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['HSN/SAC', 'Taxable (₹)', 'CGST %', 'CGST (₹)', 'SGST %', 'SGST (₹)', 'Tax Total (₹)'].map((h) => (
                        <th key={h} style={{ padding: '5px 8px', fontSize: 9.5, fontWeight: 700, textAlign: 'right',
                          borderBottom: '1px solid #e2e8f0', color: '#475569', letterSpacing: 0.2 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {taxSummary.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfd' }}>
                        {[row.hsn || '—', fmtNum(row.taxable), row.rate / 2, fmtNum(row.cgst), row.rate / 2, fmtNum(row.sgst), fmtNum(row.total_tax)].map((v, j) => (
                          <td key={j} style={{ padding: '4px 8px', fontSize: 10, textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{v}</td>
                        ))}
                      </tr>
                    ))}
                    <tr style={{ background: '#1a2b5e' }}>
                      <td style={{ padding: '5px 8px', fontSize: 10, fontWeight: 800, color: '#fff' }}>TOTAL</td>
                      {[fmtNum(taxTotals.taxable), '', fmtNum(taxTotals.cgst), '', fmtNum(taxTotals.sgst), fmtNum(taxTotals.total_tax)].map((v, j) => (
                        <td key={j} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 800, textAlign: 'right', color: '#e2e8f0' }}>{v}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Right: totals */}
              <div style={{ background: '#f8fafc' }}>
                <div style={{ background: '#f1f5f9', padding: '6px 14px', fontWeight: 800, fontSize: 10.5, color: '#1e40af', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Summary
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 14px', fontSize: 10.5, color: '#475569' }}>Sub Total</td>
                      <td style={{ padding: '6px 14px', fontSize: 10.5, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>{formatINR(subTotal)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 14px', fontSize: 10.5, color: '#475569' }}>GST</td>
                      <td style={{ padding: '6px 14px', fontSize: 10.5, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>{formatINR(taxTotals.total_tax)}</td>
                    </tr>
                    {roundOff !== 0 && (
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 14px', fontSize: 10.5, color: '#475569' }}>Round Off</td>
                        <td style={{ padding: '6px 14px', fontSize: 10.5, textAlign: 'right', color: roundOff > 0 ? '#059669' : '#dc2626' }}>
                          {roundOff > 0 ? '+' : ''}{formatINR(roundOff)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ background: '#1a2b5e' }}>
                      <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 900, color: '#fff' }}>TOTAL</td>
                      <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 900, textAlign: 'right', color: '#fff' }}>{formatINR(grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                    Amount in Words
                  </div>
                  <div style={{ fontSize: 10, color: '#334155', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {amountInWords(grandTotal)} Only
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ WITHOUT GST — totals ══ */}
          {isWithoutGst && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', minWidth: 300 }}>
                <div style={{ background: '#f1f5f9', padding: '6px 14px', fontWeight: 800, fontSize: 10.5, color: '#1e40af', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Summary
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {roundOff !== 0 && (
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 14px', fontSize: 10.5, color: '#475569' }}>Round Off</td>
                        <td style={{ padding: '6px 14px', fontSize: 10.5, textAlign: 'right', color: roundOff > 0 ? '#059669' : '#dc2626' }}>
                          {roundOff > 0 ? '+' : ''}{formatINR(roundOff)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ background: '#1a2b5e' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 900, color: '#fff' }}>TOTAL</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 900, textAlign: 'right', color: '#fff' }}>{formatINR(grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                    Amount in Words
                  </div>
                  <div style={{ fontSize: 10, color: '#334155', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {amountInWords(grandTotal)} Only
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          {quote.notes && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 10.5, color: '#92400e', borderLeft: '3px solid #f59e0b' }}>
              <strong>Notes:</strong> {quote.notes}
            </div>
          )}

          {/* ── Terms & Conditions + Bank + Signature ── */}
          <div style={{ marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>

            {/* Terms header */}
            <div style={{ background: '#f1f5f9', padding: '7px 14px', fontWeight: 800, fontSize: 10.5, color: '#1e40af', letterSpacing: 0.3, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
              Terms &amp; Conditions
            </div>
            <div style={{ padding: '8px 14px 10px', fontSize: 10, color: '#475569', lineHeight: 1.8, background: '#fafbfd' }}>
              <span style={{ marginRight: 18 }}>1. This quotation is valid for 7 days from date of issue.</span>
              <span style={{ marginRight: 18 }}>2. Prices are subject to change without prior notice.</span>
              <span>3. Delivery within 3–5 working days from confirmed order.</span>
            </div>

            {/* Bank + Signature */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #e2e8f0' }}>
              {/* Bank Details */}
              <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#94a3b8', marginBottom: 8 }}>
                  BANK DETAILS
                </div>
                <table style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      ['Bank', 'INDIAN BANK, CHINTHAL'],
                      ['Account No.', '6878749399'],
                      ['IFSC Code', 'IDIB000C135'],
                      ['Account Name', firm.name],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ padding: '2px 0', fontSize: 10, color: '#64748b', width: 90, verticalAlign: 'top' }}>{label}</td>
                        <td style={{ padding: '2px 4px', fontSize: 10, color: '#475569' }}>:</td>
                        <td style={{ padding: '2px 0', fontSize: 10, fontWeight: 600, color: '#1e293b' }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Signature */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#1a2b5e', textAlign: 'right' }}>
                  For {firm.name}
                </div>
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <img
                    src="/signature.png"
                    alt="Authorized Signature"
                    style={{ maxWidth: 150, maxHeight: 70, display: 'block', margin: '6px auto', mixBlendMode: 'multiply' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ display: 'inline-block', borderTop: '1.5px solid #94a3b8', paddingTop: 5, fontSize: 10, fontWeight: 700, color: '#475569', minWidth: 160, textAlign: 'center', marginTop: 2 }}>
                    Authorized Signatory
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom padding */}
          <div style={{ height: 20 }} />

        </div>
      </div>
    </div>
  );
}
