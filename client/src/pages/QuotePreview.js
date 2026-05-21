import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { amountInWords } from '../utils/amountInWords';

/* ─── Platform helpers ──────────────────────────────────────── */
const isCapacitor = () =>
  typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.());
const canNativeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const canShareFiles = () =>
  canNativeShare() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] });

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso : iso + 'Z');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const COMPANY = {
  name: 'Aromadelite',
  legal: 'Sri Vemuri Sai Enterprises',
  address: 'Hyderabad, Telangana, India',
  phone: '+91 90000 00000',
  email: 'sales@aromadelite.in',
  gstin: '36AAAAA0000A1Z5',
};

const BANK = {
  name: 'Sri Vemuri Sai Enterprises',
  bank: 'HDFC Bank',
  branch: 'Banjara Hills, Hyderabad',
  account: 'XXXXXXXXXXXXX',
  ifsc: 'HDFC0000XXX',
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

// Group items by category, preserving original index for the # column.
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

export default function QuotePreview() {
  const { id } = useParams();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const docRef = useRef(null);

  const fetchQuote = async () => {
    try {
      const res = await api.get(`/api/quotes/${id}/pdf-data`);
      setData(res.data.pdf);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load quote');
    }
  };

  useEffect(() => { fetchQuote(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const gstBuckets = useMemo(() => {
    const buckets = { 12: { base: 0, gst: 0 }, 18: { base: 0, gst: 0 } };
    if (!data) return buckets;
    for (const it of data.items) {
      const r = Number(it.gst_percent) || 0;
      if (!buckets[r]) buckets[r] = { base: 0, gst: 0 };
      const base = (it.quantity || 0) * (it.unit_price || 0);
      buckets[r].base += base;
      buckets[r].gst += (base * r) / 100;
    }
    return buckets;
  }, [data]);

  if (error) return <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-4 text-sm">{error}</div>;
  if (!data) return <div className="text-sm text-slate-500">Loading quote…</div>;

  const { quote, client, employee, items, totals } = data;
  const groups = groupByCategory(items);

  const fileName = `Aromadelite_Quote_${quote.number}.pdf`;

  const onDownloadPdf = async () => {
    if (!docRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(docRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      let remaining = imgH;
      let y = 0;
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, y, imgW, imgH, undefined, 'FAST');
        remaining -= pageH;
        if (remaining > 0) {
          pdf.addPage();
          y -= pageH;
        }
      }
      pdf.save(fileName);
      toast('PDF downloaded.', { kind: 'success' });
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
          (it.pack_size ? ` [${it.pack_size}]` : '') +
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
_Sri Vemuri Sai Enterprises_

${greeting}

Thank you for your enquiry. Please find your quotation below:

━━━━━━━━━━━━━━━━━━━
📋 *Quote No:* ${quote.number}
📅 *Date:* ${ddmm(quote.created_at)}
⏳ *Valid Till:* ${ddmm(quote.valid_until)}
━━━━━━━━━━━━━━━━━━━
${itemLines.join('\n')}

━━━━━━━━━━━━━━━━━━━
${discountLine}Subtotal:  ₹${fmtAmt(totals.subtotal)}
GST:       ₹${fmtAmt(totals.gst_amount)}
*TOTAL:    ₹${fmtAmt(totals.total_amount)}*
━━━━━━━━━━━━━━━━━━━${followUp}${orderDate}

📞 *6304382947*
✉️ sales@aromadelite.in
📍 Hyderabad, Telangana

_Reliable supply. Factory-direct pricing. Reach us anytime._
🌿 *Aromadelite Team*`;
  };

  /* ── WhatsApp direct ────────────────────────────────────────── */
  const onShareWhatsApp = () => {
    const msg   = buildWhatsAppMessage();
    const phone = (client.phone || '').replace(/\D/g, '');
    const url   = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    // On Capacitor/mobile, window.open launches the correct Intent
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* ── Native share sheet (text) ─────────────────────────────── */
  const onNativeShare = async () => {
    const msg = buildWhatsAppMessage();
    if (canNativeShare()) {
      try {
        await navigator.share({ title: `Quote ${quote.number} – Aromadelite`, text: msg });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return; // user dismissed — not an error
      }
    }
    // Fallback → WhatsApp link
    onShareWhatsApp();
  };

  /* ── Share as PDF file ─────────────────────────────────────── */
  const onSharePdf = async () => {
    if (!docRef.current) return;
    setSharingPdf(true);
    try {
      const canvas = await html2canvas(docRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let remaining = imgH, y = 0;
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, y, pageW, imgH, undefined, 'FAST');
        remaining -= pageH;
        if (remaining > 0) { pdf.addPage(); y -= pageH; }
      }

      const pdfName = `Aromadelite_Quote_${quote.number}.pdf`;

      // Try native file share (works in Capacitor & modern mobile browsers)
      if (canShareFiles()) {
        const blob = pdf.output('blob');
        const file = new File([blob], pdfName, { type: 'application/pdf' });
        try {
          await navigator.share({
            title: `Quote ${quote.number} – Aromadelite`,
            text: `Please find the quotation attached.`,
            files: [file],
          });
          toast('PDF shared.', { kind: 'success' });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return;
          // fall through to download
        }
      }

      // Fallback: download
      pdf.save(pdfName);
      toast('PDF downloaded.', { kind: 'success' });
    } catch (e) {
      toast('PDF export failed.', { kind: 'error' });
    } finally {
      setSharingPdf(false);
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

  const statusPill = {
    draft:    'bg-slate-100 text-slate-700',
    sent:     'bg-cyan-100 text-cyan-800',
    accepted: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-rose-100 text-rose-700',
  }[quote.status] || 'bg-slate-100 text-slate-700';

  /* ── derive onMobile for label tweaks ── */
  const onMobile = isCapacitor() || (typeof window !== 'undefined' && window.innerWidth < 640);

  return (
    <div className="space-y-4">
      {/* ── Action bar — not part of PDF ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">

        {/* Row 1: status chip + quote number */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${statusPill}`}>
            {quote.status}
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

        {/* Row 2: action buttons */}
        <div className="flex flex-wrap gap-2">

          {/* WhatsApp — primary share on mobile */}
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe59] active:bg-[#17a84e] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm"
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
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm"
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
            disabled={sharingPdf}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
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
              disabled={downloading}
              className="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
              style={{ minHeight: 44 }}
            >
              <DownloadIcon />
              <span>{downloading ? 'Saving…' : 'Save PDF'}</span>
            </button>
          )}

          {/* Mark as sent */}
          <button
            type="button"
            onClick={onMarkSent}
            disabled={marking || quote.status === 'sent' || quote.status === 'accepted'}
            className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ minHeight: 44 }}
          >
            <CheckIcon />
            <span>
              {quote.status === 'sent' || quote.status === 'accepted'
                ? 'Sent ✓'
                : marking ? 'Updating…' : 'Mark Sent'}
            </span>
          </button>

          <Link
            to="/quotes/new"
            className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl px-4 py-2.5"
            style={{ minHeight: 44 }}
          >← Builder</Link>
        </div>
      </div>

      {/* PDF-capturable document */}
      <div className="bg-slate-100 p-4 lg:p-6 rounded-xl">
        <div
          ref={docRef}
          className="bg-white mx-auto shadow-sm text-slate-800"
          style={{ width: '794px', minHeight: '1123px', padding: '40px 44px', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          {/* HEADER */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-extrabold text-xl"
                   style={{ backgroundColor: '#0891B2' }}>A</div>
              <div>
                <div className="text-2xl font-extrabold tracking-tight" style={{ color: '#0891B2' }}>
                  {COMPANY.name}
                </div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{COMPANY.legal}</div>
                <div className="text-xs text-slate-600 mt-1">{COMPANY.address}</div>
                <div className="text-xs text-slate-600">
                  {COMPANY.phone} · {COMPANY.email}
                </div>
                <div className="text-xs text-slate-600">GSTIN: {COMPANY.gstin}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-wide text-slate-900">QUOTATION</div>
              <div className="text-sm font-semibold mt-1" style={{ color: '#0891B2' }}>{quote.number}</div>
              <div className="text-xs text-slate-600 mt-2">
                <div>Date: <span className="font-medium text-slate-800">{formatDate(quote.created_at)}</span></div>
                <div>Valid Until: <span className="font-medium text-slate-800">{formatDate(quote.valid_until)}</span></div>
              </div>
            </div>
          </div>

          {/* Accent line */}
          <div className="mt-4 mb-5 h-[3px] rounded-full" style={{ backgroundColor: '#0891B2' }} />

          {/* BILL TO */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1.5">Bill To</div>
              <div className="text-base font-semibold text-slate-900">{client.business_name || client.name}</div>
              <div className="text-xs text-slate-700 mt-0.5">{client.name} · {client.type}</div>
              <div className="text-xs text-slate-600">{client.city}</div>
              <div className="text-xs text-slate-600 mt-1">
                {client.phone}{client.email ? ` · ${client.email}` : ''}
              </div>
              <div className="mt-2">
                <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#ECFEFF', color: '#0e7490', border: '1px solid #67E8F9' }}>
                  {client.requirement_type}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1.5">Prepared By</div>
              <div className="text-sm font-semibold text-slate-900">{employee.name}</div>
              <div className="text-xs text-slate-600">{employee.employee_id}{employee.region ? ` · ${employee.region}` : ''}</div>
              <div className="text-xs text-slate-600">{employee.phone}</div>
              {employee.email && <div className="text-xs text-slate-600">{employee.email}</div>}
            </div>
          </div>

          {/* Follow-up & Expected Order dates bar */}
          {(quote.next_follow_up_date || quote.expected_order_date) && (
            <div className="mt-3 flex gap-6 text-[11px]" style={{ color: '#374151' }}>
              {quote.next_follow_up_date && (
                <div>
                  <span style={{ fontWeight: 600, color: '#0E7490' }}>Next Follow-up: </span>
                  {formatDate(quote.next_follow_up_date)}
                </div>
              )}
              {quote.expected_order_date && (
                <div>
                  <span style={{ fontWeight: 600, color: '#92400E' }}>Expected Order: </span>
                  {formatDate(quote.expected_order_date)}
                </div>
              )}
            </div>
          )}

          {/* ITEMS TABLE */}
          <table className="w-full mt-4 border border-slate-300 text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="text-slate-700" style={{ backgroundColor: '#CFFAFE' }}>
                <th className="text-left  px-2 py-2 border border-slate-300 w-8">#</th>
                <th className="text-left  px-2 py-2 border border-slate-300">Product</th>
                <th className="text-left  px-2 py-2 border border-slate-300">Variant</th>
                <th className="text-left  px-2 py-2 border border-slate-300">Pack</th>
                <th className="text-right px-2 py-2 border border-slate-300 w-12">Qty</th>
                <th className="text-right px-2 py-2 border border-slate-300">Unit ₹</th>
                <th className="text-right px-2 py-2 border border-slate-300 w-12">GST%</th>
                <th className="text-right px-2 py-2 border border-slate-300">GST ₹</th>
                <th className="text-right px-2 py-2 border border-slate-300">Total ₹</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.name}>
                  <tr style={{ backgroundColor: '#F1F5F9' }}>
                    <td colSpan={9} className="px-2 py-1.5 border border-slate-300 text-[11px] uppercase tracking-wider font-semibold text-slate-700">
                      {g.name}
                    </td>
                  </tr>
                  {g.rows.map((it, i) => {
                    const gstAmt = (it.line_total * (it.gst_percent || 0)) / 100;
                    return (
                      <tr key={it._idx} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F0FDFF' }}>
                        <td className="px-2 py-1.5 border border-slate-200 align-top">{it._idx}</td>
                        <td className="px-2 py-1.5 border border-slate-200 align-top font-medium text-slate-900">
                          {it.product_name}
                        </td>
                        <td className="px-2 py-1.5 border border-slate-200 align-top text-slate-600">{it.variant || '—'}</td>
                        <td className="px-2 py-1.5 border border-slate-200 align-top text-slate-600">{it.pack_size || '—'}</td>
                        <td className="px-2 py-1.5 border border-slate-200 align-top text-right">{it.quantity}</td>
                        <td className="px-2 py-1.5 border border-slate-200 align-top text-right">
                          {it.system_price && it.system_price > it.unit_price ? (
                            <div>
                              <div style={{ textDecoration: 'line-through', color: '#9CA3AF', fontSize: '10px' }}>
                                {formatINR(it.system_price)}
                              </div>
                              <div style={{ color: '#059669', fontWeight: 600 }}>{formatINR(it.unit_price)}</div>
                            </div>
                          ) : formatINR(it.unit_price)}
                        </td>
                        <td className="px-2 py-1.5 border border-slate-200 align-top text-right">{it.gst_percent}%</td>
                        <td className="px-2 py-1.5 border border-slate-200 align-top text-right">{formatINR(gstAmt)}</td>
                        <td className="px-2 py-1.5 border border-slate-200 align-top text-right font-medium">
                          {formatINR(it.line_total + gstAmt)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={8} className="px-2 py-1.5 border border-slate-300 text-right text-slate-600">
                      Subtotal — {g.name}
                    </td>
                    <td className="px-2 py-1.5 border border-slate-300 text-right font-semibold">
                      {formatINR(g.subtotal)}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
              <tr style={{ backgroundColor: '#0891B2', color: '#fff' }}>
                <td colSpan={8} className="px-2 py-2 border border-slate-300 text-right font-bold uppercase tracking-wide">
                  Grand Total (incl. GST)
                </td>
                <td className="px-2 py-2 border border-slate-300 text-right font-bold">
                  {formatINR(totals.total_amount)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* TOTALS BLOCK */}
          <div className="mt-5 flex flex-col items-end gap-1 text-sm">
            <SummaryRow label="Subtotal (excl. GST)" value={formatINR(totals.subtotal)} />
            {gstBuckets[12].base > 0 && (
              <SummaryRow label={`GST @ 12% (on ${formatINR(gstBuckets[12].base)})`} value={formatINR(gstBuckets[12].gst)} muted />
            )}
            {gstBuckets[18].base > 0 && (
              <SummaryRow label={`GST @ 18% (on ${formatINR(gstBuckets[18].base)})`} value={formatINR(gstBuckets[18].gst)} muted />
            )}
            <div className="w-80 border-t border-slate-300 mt-1" />
            <div className="w-80 flex items-baseline justify-between mt-1">
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">Grand Total</span>
              <span className="text-2xl font-extrabold" style={{ color: '#0891B2' }}>
                {formatINR(totals.total_amount)}
              </span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-600 italic">
            <span className="font-semibold not-italic text-slate-700">Amount in words: </span>
            {amountInWords(totals.total_amount)}
          </div>

          {/* NOTES */}
          {quote.notes && (
            <div className="mt-5 border border-slate-200 rounded-md p-3 bg-slate-50">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Notes</div>
              <div className="text-xs text-slate-700 whitespace-pre-wrap">{quote.notes}</div>
            </div>
          )}

          {/* FOOTER */}
          <div className="mt-6 grid grid-cols-2 gap-6 text-[11px] text-slate-600">
            <div>
              <div className="font-semibold text-slate-800 mb-1">Terms &amp; Conditions</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>This quote is valid for {quote.validity_days || 30} days from date of issue.</li>
                <li>Prices are subject to change without prior notice.</li>
                <li>GST will be charged as applicable.</li>
                <li>Delivery within 5-7 working days from confirmed order.</li>
                <li>Payment terms: 50% advance, balance against delivery.</li>
              </ul>

              <div className="font-semibold text-slate-800 mt-3 mb-1">Bank Details</div>
              <div>Account Name: {BANK.name}</div>
              <div>Bank: {BANK.bank} · {BANK.branch}</div>
              <div>A/C No: {BANK.account} · IFSC: {BANK.ifsc}</div>
            </div>
            <div className="text-right flex flex-col items-end justify-between">
              <div>
                <div className="text-slate-700 font-semibold">For {COMPANY.legal}</div>
                <div className="mt-12 border-t border-slate-400 w-56 ml-auto" />
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mt-1">
                  Authorized Signatory
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mt-3">
                This is a computer-generated quotation and does not require a physical signature.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SummaryRow = ({ label, value, muted }) => (
  <div className={['w-80 flex items-baseline justify-between',
    muted ? 'text-slate-500 text-xs' : 'text-slate-700 text-sm'].join(' ')}>
    <span>{label}</span>
    <span className={muted ? '' : 'font-medium'}>{value}</span>
  </div>
);
