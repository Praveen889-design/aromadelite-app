import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
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
  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, fontSize: 11,
    background: '#f0f2f8', color: '#1a1a2e', borderBottom: '1.5px solid #000',
    borderRight: '1px solid #ccc', ...style }}>
    {children}
  </th>
);
const TD = ({ children, style }) => (
  <td style={{ padding: '5px 8px', fontSize: 11, color: '#1a1a2e',
    borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e8e8e8', ...style }}>
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
  const docRef = useRef(null);

  const fetchQuote = async () => {
    try {
      const res = await api.get(`/api/quotes/${id}/pdf-data`);
      setData(res.data.pdf);
      setDatesForm({
        next_follow_up_date:  res.data.pdf.quote.next_follow_up_date  || '',
        expected_order_date:  res.data.pdf.quote.expected_order_date  || '',
      });
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load quote');
    }
  };

  useEffect(() => { fetchQuote(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (error) return <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-4 text-sm">{error}</div>;
  if (!data) return <div className="text-sm text-slate-500">Loading quote…</div>;

  const { quote, client, items, totals } = data;
  const subTotal   = totals.total_amount;
  const roundOff   = +(Math.round(subTotal) - subTotal).toFixed(2);
  const grandTotal = +(subTotal + roundOff).toFixed(2);

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
    draft:                 'bg-slate-100 text-slate-700',
    sent:                  'bg-blue-100 text-blue-800',
    accepted:              'bg-emerald-100 text-emerald-800',
    modifications_required:'bg-amber-100 text-amber-800',
    hold:                  'bg-purple-100 text-purple-800',
    rejected:              'bg-rose-100 text-rose-700',
  }[quote.status] || 'bg-slate-100 text-slate-700';

  const statusLabel = {
    draft:                 'Draft',
    sent:                  'Sent',
    accepted:              'Accepted',
    modifications_required:'Modifications Required',
    hold:                  'Hold',
    rejected:              'Rejected',
  }[quote.status] || quote.status;

  /* Status options shown after quote is sent */
  const CLIENT_STATUSES = [
    { value: 'accepted',               label: '✅ Accepted',               color: '#059669' },
    { value: 'modifications_required', label: '✏️ Modifications Required',  color: '#d97706' },
    { value: 'hold',                   label: '⏸️ Hold',                    color: '#7c3aed' },
    { value: 'rejected',               label: '❌ Rejected',                color: '#dc2626' },
  ];

  /* ── derive onMobile for label tweaks ── */
  const onMobile = isCapacitor() || (typeof window !== 'undefined' && window.innerWidth < 640);

  return (
    <div className="space-y-4">
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

          {/* Mark as sent (only for draft) */}
          {quote.status === 'draft' && (
            <button
              type="button"
              onClick={onMarkSent}
              disabled={marking}
              className="inline-flex items-center gap-2 bg-[#1F6BC7] hover:bg-[#155DA6] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ minHeight: 44 }}
            >
              <CheckIcon />
              <span>{marking ? 'Updating…' : 'Mark Sent'}</span>
            </button>
          )}

          {/* Client response status dropdown — shown once quote is sent */}
          {['sent', 'modifications_required', 'hold'].includes(quote.status) && (
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

          {/* Generate Bill — shown when accepted OR modification approved */}
          {(quote.status === 'accepted' || quote.modification_status === 'approved') && (
            <button
              type="button"
              onClick={() => navigate(`/bills/new/${id}`)}
              className="inline-flex items-center gap-2 text-white text-sm font-bold rounded-xl px-5 py-2.5 shadow-sm"
              style={{ minHeight: 44, background: 'linear-gradient(135deg, #059669, #047857)', fontFamily: 'Manrope, sans-serif' }}
            >
              <span>📄 Generate Bill</span>
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

          <Link
            to="/quotes/new"
            className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl px-4 py-2.5"
            style={{ minHeight: 44 }}
          >← Builder</Link>
        </div>

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

      {/* 🔔 Admin review panel — pending approval */}
      {quote.modification_status === 'pending_approval' && isAdmin && (
        <div style={{
          background: '#fff7ed', border: '2px solid #fb923c', borderRadius: 12,
          padding: '14px 16px',
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#9a3412', marginBottom: 6 }}>
            🔔 Modification Pending Your Approval
          </div>
          <div style={{ fontSize: 12, color: '#7c2d12', marginBottom: 10 }}>
            The associate has submitted updated items and pricing. Review the modified quote below, then approve or reject.
          </div>
          {quote.modification_note && (
            <div style={{
              background: '#fff', border: '1px solid #fed7aa', borderRadius: 8,
              padding: '8px 12px', fontSize: 12, color: '#7c2d12', marginBottom: 12,
              fontStyle: 'italic',
            }}>
              Associate note: "{quote.modification_note}"
            </div>
          )}
          {/* Show comparison totals */}
          {data.modified_totals && (
            <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                <div style={{ color: '#64748b', fontWeight: 600 }}>Original Total</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#64748b' }}>
                  ₹{new Intl.NumberFormat('en-IN').format(data.totals.total_amount)}
                </div>
              </div>
              <div style={{ color: '#94a3b8', alignSelf: 'center', fontSize: 20 }}>→</div>
              <div style={{ background: '#fff', border: '1.5px solid #fb923c', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                <div style={{ color: '#9a3412', fontWeight: 600 }}>Modified Total</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#9a3412' }}>
                  ₹{new Intl.NumberFormat('en-IN').format(data.modified_totals.total_amount)}
                </div>
              </div>
            </div>
          )}

          {/* Reject input */}
          {showRejectInput && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#7c2d12', display: 'block', marginBottom: 4 }}>
                Reason for rejection (required)
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                placeholder="e.g. Price too low, margin not acceptable…"
                style={{
                  width: '100%', border: '1.5px solid #fca5a5', borderRadius: 8,
                  padding: '7px 10px', fontSize: 13, resize: 'vertical',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  color: '#7f1d1d',
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => onReviewModification('approved')}
              disabled={reviewingMod}
              style={{
                padding: '9px 20px', borderRadius: 9, border: 'none', cursor: reviewingMod ? 'not-allowed' : 'pointer',
                background: reviewingMod ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff', fontSize: 13, fontWeight: 800,
              }}
            >
              ✅ Approve
            </button>
            <button
              type="button"
              onClick={() => {
                if (!showRejectInput) { setShowRejectInput(true); return; }
                onReviewModification('rejected');
              }}
              disabled={reviewingMod}
              style={{
                padding: '9px 20px', borderRadius: 9, border: '1.5px solid #fca5a5',
                cursor: reviewingMod ? 'not-allowed' : 'pointer',
                background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 800,
              }}
            >
              ❌ {showRejectInput ? 'Confirm Reject' : 'Reject'}
            </button>
            {showRejectInput && (
              <button
                type="button"
                onClick={() => { setShowRejectInput(false); setRejectNote(''); }}
                style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* ✅ Admin: approved view */}
      {quote.modification_status === 'approved' && isAdmin && (
        <div style={{
          background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12,
          padding: '10px 16px', fontSize: 13, color: '#065f46',
        }}>
          ✅ <strong>You approved</strong> this modification.{quote.admin_note ? ` Note: "${quote.admin_note}"` : ''}
        </div>
      )}

      {/* ❌ Admin: rejected view */}
      {quote.modification_status === 'rejected' && isAdmin && (
        <div style={{
          background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12,
          padding: '10px 16px', fontSize: 13, color: '#991b1b',
        }}>
          ❌ <strong>You rejected</strong> this modification.{quote.admin_note ? ` Reason: "${quote.admin_note}"` : ''} Associate will re-edit.
        </div>
      )}

      {/* ══ Price Diff Table — shown to admin when pending ══ */}
      {quote.modification_status === 'pending_approval' && isAdmin && data.modified_items && data.modified_items.length > 0 && (() => {
        const fmtN = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

        // Build lookup: original items by product_id+variant+pack_size key
        const origMap = {};
        (data.items || []).forEach((it) => {
          const k = `${it.product_id}|${it.variant || ''}|${it.pack_size || ''}`;
          origMap[k] = it;
        });
        const origKeys = new Set(Object.keys(origMap));

        // Build lookup: modified items
        const modMap = {};
        data.modified_items.forEach((it) => {
          const k = `${it.product_id}|${it.variant || ''}|${it.pack_size || ''}`;
          modMap[k] = it;
        });
        const modKeys = new Set(Object.keys(modMap));

        // Rows: all modified items (CHANGED / NEW) + removed items
        const rows = [];

        data.modified_items.forEach((mod, i) => {
          const k = `${mod.product_id}|${mod.variant || ''}|${mod.pack_size || ''}`;
          const orig = origMap[k];
          const origPrice = orig ? Number(orig.unit_price) : null;
          const modPrice  = Number(mod.unit_price);
          const origQty   = orig ? Number(orig.quantity) : null;
          const modQty    = Number(mod.quantity);
          const origTotal = orig ? +(origQty * origPrice * (1 + (Number(orig.gst_percent) || 0) / 100)).toFixed(2) : null;
          const modTotal  = mod.line_total || +(modQty * modPrice * (1 + (Number(mod.gst_percent) || 0) / 100)).toFixed(2);

          let priceDiff = null, priceDiffPct = null, rowTag = 'unchanged';
          if (orig === undefined) {
            rowTag = 'new';
          } else {
            priceDiff    = +(modPrice - origPrice).toFixed(2);
            priceDiffPct = origPrice > 0 ? +((priceDiff / origPrice) * 100).toFixed(1) : 0;
            const qtyChanged = modQty !== origQty;
            if (priceDiff !== 0 || qtyChanged) rowTag = priceDiff < 0 ? 'discount' : priceDiff > 0 ? 'increase' : 'qty_change';
          }

          rows.push({ mod, orig, origPrice, modPrice, origQty, modQty, origTotal, modTotal, priceDiff, priceDiffPct, rowTag, serial: i + 1 });
        });

        // Removed items (in original but not in modified)
        [...origKeys].filter((k) => !modKeys.has(k)).forEach((k) => {
          const orig = origMap[k];
          const origTotal = +(Number(orig.quantity) * Number(orig.unit_price) * (1 + (Number(orig.gst_percent) || 0) / 100)).toFixed(2);
          rows.push({ mod: null, orig, origPrice: Number(orig.unit_price), modPrice: null, origQty: Number(orig.quantity), modQty: null, origTotal, modTotal: null, priceDiff: null, priceDiffPct: null, rowTag: 'removed', serial: null });
        });

        const totalSavings = rows.reduce((s, r) => {
          if (r.origTotal != null && r.modTotal != null) return s + (r.origTotal - r.modTotal);
          if (r.origTotal != null && r.modTotal == null) return s + r.origTotal; // removed
          return s;
        }, 0);

        const ROW_COLORS = {
          discount:   { bg: '#f0fdf4', border: '#bbf7d0', tag: '#065f46', tagBg: '#dcfce7', label: '▼ Discount'  },
          increase:   { bg: '#fff7ed', border: '#fed7aa', tag: '#9a3412', tagBg: '#ffedd5', label: '▲ Increase'  },
          new:        { bg: '#eff6ff', border: '#bfdbfe', tag: '#1e40af', tagBg: '#dbeafe', label: '✦ New'        },
          removed:    { bg: '#fef2f2', border: '#fecaca', tag: '#991b1b', tagBg: '#fee2e2', label: '✕ Removed'   },
          qty_change: { bg: '#fafaf9', border: '#e7e5e4', tag: '#44403c', tagBg: '#f5f5f4', label: '⇄ Qty Changed'},
          unchanged:  { bg: '#ffffff', border: '#f1f5f9', tag: '#64748b', tagBg: '#f8fafc', label: ''            },
        };

        return (
          <div style={{ background: '#fff', border: '2px solid #fb923c', borderRadius: 14, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
              padding: '10px 16px',
              borderBottom: '1.5px solid #fed7aa',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#9a3412' }}>
                📊 Price Comparison — Original vs Modified
              </div>
              {/* Summary chips */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {rows.filter(r => r.rowTag === 'discount').length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#065f46', padding: '3px 9px', borderRadius: 99 }}>
                    {rows.filter(r => r.rowTag === 'discount').length} price ↓
                  </span>
                )}
                {rows.filter(r => r.rowTag === 'increase').length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#ffedd5', color: '#9a3412', padding: '3px 9px', borderRadius: 99 }}>
                    {rows.filter(r => r.rowTag === 'increase').length} price ↑
                  </span>
                )}
                {rows.filter(r => r.rowTag === 'new').length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1e40af', padding: '3px 9px', borderRadius: 99 }}>
                    {rows.filter(r => r.rowTag === 'new').length} added
                  </span>
                )}
                {rows.filter(r => r.rowTag === 'removed').length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b', padding: '3px 9px', borderRadius: 99 }}>
                    {rows.filter(r => r.rowTag === 'removed').length} removed
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 700, background: totalSavings > 0 ? '#dcfce7' : '#ffedd5', color: totalSavings > 0 ? '#065f46' : '#9a3412', padding: '3px 9px', borderRadius: 99 }}>
                  {totalSavings > 0 ? '↓' : '↑'} ₹{fmtN(Math.abs(totalSavings))} {totalSavings > 0 ? 'less' : 'more'}
                </span>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fff7ed' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa', width: 30 }}>#</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left',   fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa' }}>Product</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right',  fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa', whiteSpace: 'nowrap' }}>Orig. Qty</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right',  fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa', whiteSpace: 'nowrap' }}>Mod. Qty</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right',  fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa', whiteSpace: 'nowrap' }}>Orig. Price</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right',  fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa', whiteSpace: 'nowrap' }}>Client Price</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right',  fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa', whiteSpace: 'nowrap' }}>Diff</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right',  fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa', whiteSpace: 'nowrap' }}>Orig. Total</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right',  fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa', whiteSpace: 'nowrap' }}>Mod. Total</th>
                    <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: '#78350f', borderBottom: '1px solid #fed7aa' }}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const C = ROW_COLORS[r.rowTag];
                    const itemName = r.mod ? r.mod.product_name : r.orig.product_name;
                    const variant  = r.mod ? (r.mod.variant || r.mod.pack_size) : (r.orig.variant || r.orig.pack_size);
                    const totalDiff = r.origTotal != null && r.modTotal != null ? +(r.modTotal - r.origTotal).toFixed(2) : null;
                    return (
                      <tr key={i} style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#94a3b8' }}>
                          {r.serial != null ? r.serial : '—'}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <div style={{ fontWeight: 700, color: r.rowTag === 'removed' ? '#991b1b' : '#0f172a', textDecoration: r.rowTag === 'removed' ? 'line-through' : 'none' }}>
                            {itemName}
                          </div>
                          {variant && <div style={{ fontSize: 10, color: '#64748b' }}>{variant}</div>}
                        </td>
                        {/* Orig Qty */}
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b' }}>
                          {r.origQty != null ? r.origQty : '—'}
                        </td>
                        {/* Mod Qty */}
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          {r.modQty != null ? (
                            <span style={{ fontWeight: 700, color: r.modQty !== r.origQty ? '#1d4ed8' : '#374151' }}>
                              {r.modQty}
                              {r.origQty != null && r.modQty !== r.origQty && (
                                <span style={{ fontSize: 10, color: r.modQty > r.origQty ? '#16a34a' : '#dc2626', marginLeft: 3 }}>
                                  ({r.modQty > r.origQty ? '+' : ''}{r.modQty - r.origQty})
                                </span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        {/* Orig Price */}
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b' }}>
                          {r.origPrice != null ? `₹ ${fmtN(r.origPrice)}` : '—'}
                        </td>
                        {/* Modified Price */}
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          {r.modPrice != null ? (
                            <span style={{ fontWeight: 800, color: r.rowTag === 'discount' ? '#16a34a' : r.rowTag === 'increase' ? '#dc2626' : '#0f172a' }}>
                              ₹ {fmtN(r.modPrice)}
                            </span>
                          ) : '—'}
                        </td>
                        {/* Price Diff */}
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          {r.priceDiff != null && r.priceDiff !== 0 ? (
                            <div>
                              <div style={{ fontWeight: 800, color: r.priceDiff < 0 ? '#16a34a' : '#dc2626', fontSize: 12 }}>
                                {r.priceDiff > 0 ? '+' : ''}₹ {fmtN(r.priceDiff)}
                              </div>
                              <div style={{ fontSize: 10, color: r.priceDiff < 0 ? '#16a34a' : '#dc2626' }}>
                                ({r.priceDiffPct > 0 ? '+' : ''}{r.priceDiffPct}%)
                              </div>
                            </div>
                          ) : r.rowTag === 'new' || r.rowTag === 'removed' ? '—' : (
                            <span style={{ color: '#94a3b8', fontSize: 11 }}>no change</span>
                          )}
                        </td>
                        {/* Orig Total */}
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b' }}>
                          {r.origTotal != null ? `₹ ${fmtN(r.origTotal)}` : '—'}
                        </td>
                        {/* Mod Total */}
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          {r.modTotal != null ? (
                            <span style={{ fontWeight: 700, color: totalDiff != null && totalDiff < 0 ? '#16a34a' : totalDiff != null && totalDiff > 0 ? '#dc2626' : '#0f172a' }}>
                              ₹ {fmtN(r.modTotal)}
                            </span>
                          ) : <span style={{ color: '#dc2626', fontWeight: 700 }}>—</span>}
                        </td>
                        {/* Change tag */}
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {C.label && (
                            <span style={{ fontSize: 10, fontWeight: 800, background: C.tagBg, color: C.tag, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                              {C.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr style={{ background: '#fff7ed', borderTop: '2px solid #fb923c' }}>
                    <td colSpan={7} style={{ padding: '8px 10px', fontSize: 12, fontWeight: 800, color: '#9a3412' }}>Grand Total</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#64748b' }}>
                      ₹ {fmtN(data.totals.total_amount)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 900, color: '#9a3412' }}>
                      ₹ {fmtN(data.modified_totals ? data.modified_totals.total_amount : 0)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {data.modified_totals && (
                        <span style={{
                          fontSize: 11, fontWeight: 900,
                          background: data.modified_totals.total_amount < data.totals.total_amount ? '#dcfce7' : '#ffedd5',
                          color: data.modified_totals.total_amount < data.totals.total_amount ? '#065f46' : '#9a3412',
                          padding: '3px 10px', borderRadius: 99,
                        }}>
                          {data.modified_totals.total_amount < data.totals.total_amount ? '▼ ' : '▲ '}
                          ₹ {fmtN(Math.abs(data.modified_totals.total_amount - data.totals.total_amount))}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* PDF-capturable document */}
      <div style={{ background: '#f3f3f3', padding: '24px', borderRadius: 12 }}>
        <div
          ref={docRef}
          style={{
            width: 794, background: '#ffffff',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 11, color: '#1a1a2e', margin: '0 auto', padding: '24px 28px 28px',
          }}
        >
          {/* ── TITLE ── */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Georgia, serif', letterSpacing: 0.5 }}>
              Quotation
            </span>
          </div>

          {/* ══ OUTER BOX ══ */}
          <div style={{ border: '1.5px solid #000' }}>

            {/* ── Company Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: '1.5px solid #000' }}>
              <div style={{ width: 110, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src="/aromadelite-logo.png" alt="Aromadelite" style={{ width: 110, height: 'auto', maxHeight: 72, objectFit: 'contain' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1a2b5e', letterSpacing: 0.3, lineHeight: 1.15, fontFamily: 'Arial, sans-serif' }}>
                  SRI VEMURI SAI ENTERPRISES
                </div>
                <div style={{ fontSize: 11, color: '#333', marginTop: 4 }}>
                  SAI NAGAR HNO 8-229/8, NVV NAGAR, CHINTAL, QUTHBULLAPUR, MALKAJGIRI – 500054
                </div>
                <div style={{ display: 'flex', gap: 32, marginTop: 3, fontSize: 11 }}>
                  <span><strong>Phone:</strong>&nbsp; +91 63043 82947</span>
                  <span><strong>Email:</strong>&nbsp; contact@aromadelite.in</span>
                </div>
                <div style={{ display: 'flex', gap: 32, marginTop: 2, fontSize: 11 }}>
                  <span><strong>GSTIN:</strong>&nbsp; 36AQJPV7026L2Z5</span>
                  <span><strong>State:</strong>&nbsp; 36-Telangana</span>
                </div>
              </div>
            </div>

            {/* ── Bill To / Quote Details ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1.5px solid #000' }}>
              <div style={{ padding: '10px 14px', borderRight: '1.5px solid #000' }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Bill To:</div>
                {client.business_name && (
                  <div style={{ fontWeight: 800, fontSize: 12, color: '#8B0000' }}>{client.business_name}</div>
                )}
                <div style={{ fontWeight: 700, fontSize: 11 }}>{client.name}</div>
                {client.type && <div style={{ fontSize: 11, color: '#555' }}>{client.type}</div>}
                {client.city && <div style={{ fontSize: 11 }}>{client.city}</div>}
                {client.phone && <div style={{ fontSize: 11, marginTop: 2 }}>Contact No: {client.phone}</div>}
                {client.requirement_type && (
                  <div style={{ marginTop: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                      background: '#ECFEFF', color: '#0e7490', border: '1px solid #67E8F9',
                      padding: '2px 8px', borderRadius: 3 }}>
                      {client.requirement_type}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Quote Details:</div>
                <div style={{ fontSize: 11 }}><strong>No:</strong>&nbsp; {quote.number}</div>
                <div style={{ fontSize: 11, marginTop: 3 }}><strong>Date:</strong>&nbsp; {formatDate(quote.created_at)}</div>
                <div style={{ fontSize: 11, marginTop: 3 }}><strong>Valid Until:</strong>&nbsp; {formatDate(quote.valid_until)}</div>
                {quote.next_follow_up_date && (
                  <div style={{ fontSize: 11, marginTop: 3 }}><strong>Follow-up:</strong>&nbsp; {formatDate(quote.next_follow_up_date)}</div>
                )}
                {isWithoutGst ? (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                      background: '#FFFBEB', color: '#92400e', border: '1px solid #FCD34D',
                      padding: '2px 8px', borderRadius: 3 }}>
                      GST Inclusive Pricing
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                      background: '#EFF6FF', color: '#1e40af', border: '1px solid #BFDBFE',
                      padding: '2px 8px', borderRadius: 3 }}>
                      Prices Excl. GST (CGST + SGST Applicable)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Items Table ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH style={{ width: 28, textAlign: 'center' }}>#</TH>
                  <TH>Item name</TH>
                  <TH style={{ width: 72 }}>HSN/ SAC</TH>
                  <TH style={{ width: 60, textAlign: 'right' }}>Quantity</TH>
                  <TH style={{ width: 40 }}>Unit</TH>
                  <TH style={{ width: 90, textAlign: 'right' }}>Price/ Unit(₹)</TH>
                  <TH style={{ width: 90, textAlign: 'right', borderRight: 'none' }}>Amount(₹)</TH>
                </tr>
              </thead>
              <tbody>
                {groupByCategory(items).map((group) => (
                  <React.Fragment key={group.name}>
                    {/* ── Category header row ── */}
                    <tr>
                      <td colSpan={7} style={{
                        padding: '5px 10px',
                        background: '#EFF6FF',
                        borderTop: '1.5px solid #BFDBFE',
                        borderBottom: '1px solid #BFDBFE',
                        fontWeight: 800,
                        fontSize: 11,
                        color: '#1e40af',
                        letterSpacing: 0.3,
                      }}>
                        {group.rows[0]?.category_icon && (
                          <span style={{ marginRight: 5 }}>{group.rows[0].category_icon}</span>
                        )}
                        {group.name}
                      </td>
                    </tr>
                    {/* ── Items in this category ── */}
                    {group.rows.map((it, i) => {
                      const lineTotal   = it.line_total || 0;
                      const gst         = Number(it.gst_percent) || 0;
                      const dispUnit    = isWithoutGst
                        ? +(it.unit_price * (1 + gst / 100)).toFixed(2)
                        : it.unit_price;
                      const dispSysUnit = isWithoutGst
                        ? +(it.system_price * (1 + gst / 100)).toFixed(2)
                        : it.system_price;
                      return (
                        <tr key={it._idx} style={{ background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <TD style={{ textAlign: 'center', color: '#888' }}>{it._idx}</TD>
                          <TD>
                            <span style={{ fontWeight: 700 }}>{it.product_name}</span>
                            {(it.variant || it.pack_size) && (
                              <span style={{ color: '#666', fontWeight: 400 }}>
                                {' '}({[it.variant, it.pack_size].filter(Boolean).join(', ')})
                              </span>
                            )}
                          </TD>
                          <TD>{it.hsn_code || ''}</TD>
                          <TD style={{ textAlign: 'right' }}>{fmtNum(it.quantity, 0)}</TD>
                          <TD>{it.unit || 'Nos'}</TD>
                          <TD style={{ textAlign: 'right' }}>
                            {it.system_price && it.system_price > it.unit_price ? (
                              <div>
                                <div style={{ textDecoration: 'line-through', color: '#9CA3AF', fontSize: 9 }}>
                                  ₹ {fmtNum(dispSysUnit)}
                                </div>
                                <div style={{ color: '#059669', fontWeight: 600 }}>₹ {fmtNum(dispUnit)}</div>
                              </div>
                            ) : `₹ ${fmtNum(dispUnit)}`}
                          </TD>
                          <TD style={{ textAlign: 'right', borderRight: 'none', fontWeight: 600 }}>
                            ₹ {fmtNum(lineTotal)}
                          </TD>
                        </tr>
                      );
                    })}
                    {/* ── Category subtotal row ── */}
                    <tr style={{ background: '#f8faff' }}>
                      <td colSpan={6} style={{ padding: '4px 8px', fontSize: 10, textAlign: 'right',
                        color: '#64748b', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e8e8e8',
                        fontStyle: 'italic' }}>
                        {group.rows[0]?.category_icon} {group.name} subtotal
                      </td>
                      <td style={{ padding: '4px 8px', fontSize: 10, textAlign: 'right',
                        color: '#1e40af', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                        ₹ {fmtNum(group.subtotal)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
                {/* ── Grand Total row ── */}
                <tr style={{ borderTop: '2px solid #000', fontWeight: 800, background: '#f0f4ff' }}>
                  <td colSpan={3} style={{ padding: '7px 8px', fontSize: 12, fontWeight: 900, borderRight: '1px solid #ccc', color: '#1a2b5e' }}>Total</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 12, fontWeight: 900, borderRight: '1px solid #ccc', color: '#1a2b5e' }}>
                    {fmtNum(items.reduce((s, it) => s + (Number(it.quantity) || 0), 0), 0)}
                  </td>
                  <td style={{ padding: '7px 8px', borderRight: '1px solid #ccc' }}></td>
                  <td style={{ padding: '7px 8px', borderRight: '1px solid #ccc' }}></td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 12, fontWeight: 900, color: '#1a2b5e' }}>
                    ₹ {fmtNum(subTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* ══ END OUTER BOX ══ */}

          {/* ══ TAX SUMMARY (With GST only) ══ */}
          {!isWithoutGst && taxSummary.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 0, marginTop: 12, border: '1px solid #ccc' }}>
              <div style={{ borderRight: '1.5px solid #ccc' }}>
                <div style={{ background: '#f0f2f8', padding: '5px 10px', fontWeight: 800, fontSize: 11, borderBottom: '1px solid #ccc' }}>
                  Tax Summary:
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f7f8fc' }}>
                      {['HSN/ SAC', 'Taxable Amount (₹)', 'CGST Rate (%)', 'CGST Amt (₹)', 'SGST Rate (%)', 'SGST Amt (₹)', 'Total Tax (₹)'].map((h) => (
                        <th key={h} style={{ padding: '5px 7px', fontSize: 10, fontWeight: 700, textAlign: 'right',
                          borderBottom: '1px solid #ccc', borderRight: '1px solid #e0e0e0', color: '#333' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {taxSummary.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '4px 7px', fontSize: 10, textAlign: 'right', borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #f0f0f0' }}>{row.hsn || '—'}</td>
                        <td style={{ padding: '4px 7px', fontSize: 10, textAlign: 'right', borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #f0f0f0' }}>{fmtNum(row.taxable)}</td>
                        <td style={{ padding: '4px 7px', fontSize: 10, textAlign: 'right', borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #f0f0f0' }}>{row.rate / 2}</td>
                        <td style={{ padding: '4px 7px', fontSize: 10, textAlign: 'right', borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #f0f0f0' }}>{fmtNum(row.cgst)}</td>
                        <td style={{ padding: '4px 7px', fontSize: 10, textAlign: 'right', borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #f0f0f0' }}>{row.rate / 2}</td>
                        <td style={{ padding: '4px 7px', fontSize: 10, textAlign: 'right', borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #f0f0f0' }}>{fmtNum(row.sgst)}</td>
                        <td style={{ padding: '4px 7px', fontSize: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{fmtNum(row.total_tax)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f0f2f8', fontWeight: 800, borderTop: '1.5px solid #999' }}>
                      <td style={{ padding: '5px 7px', fontSize: 10, fontWeight: 800, borderRight: '1px solid #ccc' }}>TOTAL</td>
                      <td style={{ padding: '5px 7px', fontSize: 10, fontWeight: 800, textAlign: 'right', borderRight: '1px solid #ccc' }}>{fmtNum(taxTotals.taxable)}</td>
                      <td style={{ padding: '5px 7px', fontSize: 10, textAlign: 'right', borderRight: '1px solid #ccc' }}></td>
                      <td style={{ padding: '5px 7px', fontSize: 10, fontWeight: 800, textAlign: 'right', borderRight: '1px solid #ccc' }}>{fmtNum(taxTotals.cgst)}</td>
                      <td style={{ padding: '5px 7px', fontSize: 10, textAlign: 'right', borderRight: '1px solid #ccc' }}></td>
                      <td style={{ padding: '5px 7px', fontSize: 10, fontWeight: 800, textAlign: 'right', borderRight: '1px solid #ccc' }}>{fmtNum(taxTotals.sgst)}</td>
                      <td style={{ padding: '5px 7px', fontSize: 10, fontWeight: 800, textAlign: 'right' }}>{fmtNum(taxTotals.total_tax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Right: totals + amount in words */}
              <div style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600 }}>Sub Total</td>
                      <td style={{ padding: '6px 4px', fontSize: 11 }}>:</td>
                      <td style={{ padding: '6px 10px 6px 2px', fontSize: 11, textAlign: 'right', fontWeight: 600 }}>{formatINR(subTotal)}</td>
                    </tr>
                    {roundOff !== 0 && (
                      <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '6px 10px', fontSize: 11 }}>Round Off</td>
                        <td style={{ padding: '6px 4px', fontSize: 11 }}>:</td>
                        <td style={{ padding: '6px 10px 6px 2px', fontSize: 11, textAlign: 'right', color: roundOff > 0 ? '#059669' : '#dc2626' }}>
                          {roundOff > 0 ? '+' : ''}{formatINR(roundOff)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 900, color: '#1a2b5e' }}>Total</td>
                      <td style={{ padding: '8px 4px', fontSize: 13, fontWeight: 900 }}>:</td>
                      <td style={{ padding: '8px 10px 8px 2px', fontSize: 13, fontWeight: 900, textAlign: 'right', color: '#1a2b5e' }}>{formatINR(grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ borderTop: '1.5px solid #ccc', padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 4 }}>Amount in Words:</div>
                  <div style={{ fontSize: 10, color: '#333', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {amountInWords(grandTotal)} Only
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ WITHOUT GST — total only (GST absorbed by seller, not shown to client) ══ */}
          {isWithoutGst && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ border: '1px solid #ccc', minWidth: 280 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {roundOff !== 0 && (
                      <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '6px 14px', fontSize: 11 }}>Round Off</td>
                        <td style={{ padding: '6px 4px', fontSize: 11 }}>:</td>
                        <td style={{ padding: '6px 14px', fontSize: 11, textAlign: 'right', color: roundOff > 0 ? '#059669' : '#dc2626' }}>
                          {roundOff > 0 ? '+' : ''}{formatINR(roundOff)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ background: '#f5f5f5' }}>
                      <td style={{ padding: '9px 14px', fontSize: 14, fontWeight: 900, color: '#1a2b5e' }}>Total</td>
                      <td style={{ padding: '9px 4px', fontSize: 14, fontWeight: 900 }}>:</td>
                      <td style={{ padding: '9px 14px', fontSize: 14, fontWeight: 900, textAlign: 'right', color: '#1a2b5e' }}>{formatINR(grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ borderTop: '1.5px solid #ccc', padding: '8px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 3 }}>Amount in Words:</div>
                  <div style={{ fontSize: 10, color: '#333', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {amountInWords(grandTotal)} Only
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          {quote.notes && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, fontSize: 10 }}>
              <strong>Notes:</strong> {quote.notes}
            </div>
          )}

          {/* ── Terms & Conditions ── */}
          <div style={{ marginTop: 10, border: '1px solid #ccc' }}>
            <div style={{ background: '#f0f2f8', padding: '5px 10px', fontWeight: 700, fontSize: 11, borderBottom: '1px solid #ccc' }}>
              Terms &amp; Conditions:
            </div>
            <div style={{ padding: '6px 10px', fontSize: 10, color: '#555', lineHeight: 1.7 }}>
              1. This quotation is valid for {quote.validity_days || 7} days from date of issue.
              &nbsp;&nbsp;2. Prices are subject to change without prior notice.
              &nbsp;&nbsp;3. {isWithoutGst ? 'Prices are inclusive of applicable GST.' : 'GST (CGST + SGST) will be charged as applicable.'}
              &nbsp;&nbsp;4. Delivery within 5–7 working days from confirmed order.
              &nbsp;&nbsp;5. Payment terms: 50% advance, balance against delivery.
            </div>
          </div>

          {/* ── Bank Details + Signature ── */}
          <div style={{ marginTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #ccc', borderTop: 'none' }}>
            <div style={{ padding: '10px 12px', borderRight: '1.5px solid #ccc' }}>
              <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 5 }}>Bank Details:</div>
              <div style={{ fontSize: 11 }}><strong>Name :</strong> INDIAN BANK, CHINTHAL</div>
              <div style={{ fontSize: 11, marginTop: 3 }}><strong>Account No. :</strong> 6878749399</div>
              <div style={{ fontSize: 11, marginTop: 3 }}><strong>IFSC code :</strong> IDIB000C135</div>
              <div style={{ fontSize: 11, marginTop: 3 }}><strong>Account holder's name :</strong> SRI VEMURI SAI ENTERPRISES</div>
            </div>
            <div style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 700, alignSelf: 'flex-end', width: '100%', textAlign: 'right' }}>
                For SRI VEMURI SAI ENTERPRISES:
              </div>
              <img
                src="/signature.png"
                alt="Authorized Signature"
                style={{ maxWidth: 160, maxHeight: 80, display: 'block', margin: '8px auto 4px', mixBlendMode: 'multiply' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div style={{ fontSize: 11, fontWeight: 700, borderTop: '1px solid #aaa', paddingTop: 4, width: '70%' }}>
                Authorized Signatory
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
