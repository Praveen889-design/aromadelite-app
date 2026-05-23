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
  // Date-only strings (YYYY-MM-DD) → parse as local midnight to avoid TZ-shift
  // Full ISO timestamps (from Postgres TIMESTAMPTZ) → parse directly
  const s = String(iso);
  const d = s.length === 10 ? new Date(s + 'T00:00:00') : new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const COMPANY = {
  name: 'Aromadelite',
  legal: 'Sri Vemuri Sai Enterprises',
  address: 'SAI NAGAR HNO 8-229/8, NVV NAGAR, CHINTAL, QUTHBULLAPUR, MALKAJGIRI – 500054',
  state: 'Telangana, State Code: 36',
  phone: '+91 63043 82947',
  email: 'contact@aromadelite.in',
  gstin: '36AQJPV7026L2Z5',
};

const BANK = {
  name: 'SRI VEMURI SAI ENTERPRISES',
  bank: 'INDIAN BANK',
  branch: 'CHINTHAL',
  account: '6878749399',
  ifsc: 'IDIB000C135',
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
  const [editDates, setEditDates] = useState(false);
  const [datesForm, setDatesForm] = useState({ next_follow_up_date: '', expected_order_date: '' });
  const [savingDates, setSavingDates] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
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
    sent:     'bg-blue-100 text-blue-800',
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
            className="inline-flex items-center gap-2 bg-[#1F6BC7] hover:bg-[#155DA6] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
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

      {/* PDF-capturable document */}
      <div className="bg-slate-100 p-4 lg:p-6 rounded-xl">
        <div
          ref={docRef}
          className="bg-white mx-auto shadow-sm text-slate-800"
          style={{ width: '794px', minHeight: '1123px', padding: '40px 44px', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          {/* HEADER */}
          <div className="flex items-start justify-between">
            <div style={{ maxWidth: 340 }}>
              {/* Primary lens mark logo */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 280" width="220" height="62" aria-label="Aromadelite" style={{ display: 'block', marginBottom: 8 }}>
                <path d="M0,140 Q500,-30 1000,140 Q500,310 0,140 Z" fill="#1F6BC7"/>
                <g transform="translate(500 120) scale(1)">
                  <ellipse cx="-6" cy="3" rx="118" ry="4" fill="#143A6E" opacity="0.35"/>
                  <g transform="translate(-88 0)">
                    <rect x="-3.5" y="-8" width="7" height="12" rx="1.5" fill="#6A4527"/>
                    <path d="M0 -82 C 24 -82 32 -58 32 -36 C 32 -14 18 -6 0 -6 C -18 -6 -32 -14 -32 -36 C -32 -58 -24 -82 0 -82 Z" fill="#3D9354"/>
                    <path d="M-2 -74 C 12 -74 20 -56 20 -40 C 20 -28 10 -22 -2 -22 C -14 -22 -20 -32 -20 -46 C -20 -60 -16 -74 -2 -74 Z" fill="#2F7B43" opacity="0.55"/>
                  </g>
                  <g transform="translate(20 0)">
                    <rect x="-42" y="-58" width="84" height="58" rx="2" fill="#F8F2E0"/>
                    <rect x="22" y="-58" width="20" height="58" fill="#E5DBC1" opacity="0.7"/>
                    <path d="M-52 -58 L 0 -98 L 52 -58 Z" fill="#D34B3F"/>
                    <path d="M0 -98 L 52 -58 L 14 -58 Z" fill="#B83A2F"/>
                    <rect x="20" y="-90" width="10" height="18" fill="#B83A2F"/>
                    <rect x="-9" y="-28" width="18" height="28" rx="1" fill="#2E2A24"/>
                    <circle cx="6" cy="-13" r="1.6" fill="#F8F2E0"/>
                    <rect x="-32" y="-48" width="22" height="18" rx="1" fill="#1F6BC7"/>
                    <line x1="-21" y1="-48" x2="-21" y2="-30" stroke="#F8F2E0" strokeWidth="1.8"/>
                    <line x1="-32" y1="-39" x2="-10" y2="-39" stroke="#F8F2E0" strokeWidth="1.8"/>
                  </g>
                </g>
                <g transform="translate(271.078 198)" fill="#FFFFFF">
                  <path d="M17.16 1.17L17.16 1.17Q12.64 1.17 9.50-0.57Q6.36-2.30 4.74-5.21Q3.12-8.11 3.12-11.62L3.12-11.62Q3.12-14.55 4.02-16.96Q4.91-19.38 6.92-21.24Q8.93-23.09 12.32-24.34L12.32-24.34Q14.66-25.19 17.90-25.86Q21.14-26.52 25.23-27.14L25.23-27.14Q27.65-27.50 30.34-27.89L30.34-27.89Q30.03-30.50 28.63-31.86L28.63-31.86Q26.83-33.62 22.62-33.62L22.62-33.62Q20.28-33.62 17.75-32.49Q15.21-31.36 14.20-28.47L14.20-28.47L4.60-31.51Q6.20-36.74 10.61-40.01Q15.02-43.29 22.62-43.29L22.62-43.29Q28.20-43.29 32.53-41.57Q36.85-39.86 39.08-35.65L39.08-35.65Q40.33-33.31 40.56-30.97Q40.79-28.63 40.79-25.74L40.79-25.74L40.79 0L31.51 0L31.51-5.19Q29.02-2.22 26.21-0.74L26.21-0.74Q22.62 1.17 17.16 1.17ZM19.42-7.18L19.42-7.18Q22.35-7.18 24.36-8.21Q26.36-9.24 27.55-10.57Q28.74-11.89 29.17-12.79L29.17-12.79Q29.99-14.51 30.15-16.81L30.15-16.81Q30.23-18.17 30.23-19.30L30.23-19.30Q27.61-18.84 25.74-18.52L25.74-18.52Q22.82-17.98 21.02-17.55Q19.23-17.12 17.86-16.61L17.86-16.61Q16.30-15.99 15.35-15.27Q14.39-14.55 13.94-13.69Q13.49-12.83 13.49-11.78L13.49-11.78Q13.49-10.34 14.22-9.30Q14.94-8.27 16.26-7.72Q17.59-7.18 19.42-7.18Z M60.62 0L49.93 0L49.93-42.12L59.29-42.12L59.29-35.33Q59.80-36.27 60.46-37.13L60.46-37.13Q61.83-38.92 63.82-40.09L63.82-40.09Q65.34-41.03 67.13-41.55Q68.93-42.08 70.84-42.22Q72.75-42.35 74.66-42.12L74.66-42.12L74.66-32.21Q72.91-32.76 70.58-32.58Q68.26-32.41 66.39-31.51L66.39-31.51Q64.52-30.65 63.23-29.23Q61.95-27.81 61.28-25.88Q60.62-23.95 60.62-21.53L60.62-21.53L60.62 0Z M100.02 1.17L100.02 1.17Q93.67 1.17 88.87-1.68Q84.07-4.52 81.40-9.54Q78.73-14.55 78.73-21.06L78.73-21.06Q78.73-27.65 81.46-32.66Q84.19-37.67 88.99-40.48Q93.78-43.29 100.02-43.29L100.02-43.29Q106.38-43.29 111.20-40.44Q116.01-37.60 118.70-32.58Q121.40-27.57 121.40-21.06L121.40-21.06Q121.40-14.51 118.69-9.50Q115.97-4.49 111.16-1.66Q106.34 1.17 100.02 1.17ZM100.02-8.74L100.02-8.74Q105.13-8.74 107.65-12.19Q110.16-15.64 110.16-21.06L110.16-21.06Q110.16-26.68 107.61-30.03Q105.06-33.38 100.02-33.38L100.02-33.38Q96.55-33.38 94.33-31.82Q92.11-30.26 91.03-27.50Q89.96-24.73 89.96-21.06L89.96-21.06Q89.96-15.40 92.52-12.07Q95.07-8.74 100.02-8.74Z M190.28 0L179.68 0L179.68-24.88Q179.68-29.05 177.71-31.38Q175.74-33.70 172.27-33.70L172.27-33.70Q170.04-33.70 168.41-32.66Q166.77-31.63 165.85-29.78Q164.93-27.92 164.93-25.51L164.93-25.51L164.93 0L154.33 0L154.33-24.88Q154.33-29.05 152.36-31.38Q150.39-33.70 146.92-33.70L146.92-33.70Q143.60-33.70 141.59-31.41Q139.58-29.13 139.58-25.51L139.58-25.51L139.58 0L128.90 0L128.90-42.12L138.26-42.12L138.26-37.52Q140.09-39.78 142.78-41.22L142.78-41.22Q146.25-43.13 150.58-43.13L150.58-43.13Q155.53-43.13 158.73-41.03L158.73-41.03Q161.35-39.27 162.83-36.58L162.83-36.58Q164.82-39.55 168.05-41.30L168.05-41.30Q171.49-43.13 175.70-43.13L175.70-43.13Q182.91-43.13 186.60-38.86Q190.28-34.59 190.28-27.69L190.28-27.69L190.28 0Z M211.12 1.17L211.12 1.17Q206.60 1.17 203.46-0.57Q200.32-2.30 198.70-5.21Q197.08-8.11 197.08-11.62L197.08-11.62Q197.08-14.55 197.98-16.96Q198.88-19.38 200.89-21.24Q202.90-23.09 206.29-24.34L206.29-24.34Q208.63-25.19 211.87-25.86Q215.10-26.52 219.20-27.14L219.20-27.14Q221.62-27.50 224.31-27.89L224.31-27.89Q223.99-30.50 222.59-31.86L222.59-31.86Q220.80-33.62 216.58-33.62L216.58-33.62Q214.24-33.62 211.71-32.49Q209.17-31.36 208.16-28.47L208.16-28.47L198.57-31.51Q200.16-36.74 204.57-40.01Q208.98-43.29 216.58-43.29L216.58-43.29Q222.16-43.29 226.49-41.57Q230.82-39.86 233.04-35.65L233.04-35.65Q234.29-33.31 234.52-30.97Q234.76-28.63 234.76-25.74L234.76-25.74L234.76 0L225.48 0L225.48-5.19Q222.98-2.22 220.17-0.74L220.17-0.74Q216.58 1.17 211.12 1.17ZM213.39-7.18L213.39-7.18Q216.31-7.18 218.32-8.21Q220.33-9.24 221.52-10.57Q222.71-11.89 223.14-12.79L223.14-12.79Q223.95-14.51 224.11-16.81L224.11-16.81Q224.19-18.17 224.19-19.30L224.19-19.30Q221.58-18.84 219.70-18.52L219.70-18.52Q216.78-17.98 214.99-17.55Q213.19-17.12 211.83-16.61L211.83-16.61Q210.27-15.99 209.31-15.27Q208.35-14.55 207.91-13.69Q207.46-12.83 207.46-11.78L207.46-11.78Q207.46-10.34 208.18-9.30Q208.90-8.27 210.23-7.72Q211.55-7.18 213.39-7.18Z M260.98 1.17L260.98 1.17Q255.17 1.17 250.80-1.75Q246.43-4.68 244.00-9.71Q241.56-14.74 241.56-21.06L241.56-21.06Q241.56-27.50 244.03-32.51Q246.51-37.52 251.00-40.40Q255.48-43.29 261.53-43.29L261.53-43.29Q267.10-43.29 271.04-40.76L271.04-40.76L271.04-56.16L281.73-56.16L281.73 0L272.37 0L272.37-2.42Q271.94-2.07 271.47-1.75L271.47-1.75Q267.26 1.17 260.98 1.17ZM262.70-8.27L262.70-8.27Q266.25-8.27 268.37-9.87Q270.50-11.47 271.43-14.35Q272.37-17.24 272.37-21.06Q272.37-24.88 271.43-27.77Q270.50-30.65 268.45-32.25Q266.40-33.85 263.09-33.85L263.09-33.85Q259.54-33.85 257.26-32.12Q254.97-30.38 253.88-27.48Q252.79-24.57 252.79-21.06L252.79-21.06Q252.79-17.51 253.84-14.61Q254.90-11.70 257.08-9.98Q259.26-8.27 262.70-8.27Z M311.23 1.17L311.23 1.17Q304.75 1.17 299.82-1.62Q294.88-4.41 292.10-9.30Q289.31-14.20 289.31-20.51L289.31-20.51Q289.31-27.42 292.04-32.53Q294.77-37.63 299.56-40.46Q304.36-43.29 310.60-43.29L310.60-43.29Q317.23-43.29 321.87-40.17Q326.51-37.05 328.74-31.39Q330.96-25.74 330.30-18.10L330.30-18.10L300.74-18.10Q301.24-14.31 303.11-11.97L303.11-11.97Q305.65-8.74 310.60-8.74L310.60-8.74Q313.72-8.74 315.94-10.10Q318.17-11.47 319.34-14.04L319.34-14.04L329.95-11.00Q327.57-5.23 322.44-2.03Q317.31 1.17 311.23 1.17ZM301.01-25.97L319.57-25.97Q319.10-29.41 317.78-31.28L317.78-31.28Q315.71-34.09 311.07-34.09L311.07-34.09Q305.65-34.09 303.11-30.81L303.11-30.81Q301.63-28.90 301.01-25.97L301.01-25.97Z M349.46 0L338.85 0L338.85-57.33L349.46-57.33L349.46 0Z M371.55-47.97L360.94-47.97L360.94-57.33L371.55-57.33L371.55-47.97ZM371.55 0L360.94 0L360.94-42.12L371.55-42.12L371.55 0Z M407.52-8.81L407.52 0Q403.15 0.82 398.96 0.72Q394.77 0.62 391.47-0.76Q388.18-2.15 386.46-5.23L386.46-5.23Q384.90-8.11 384.82-11.10Q384.74-14.08 384.74-17.86L384.74-17.86L384.74-33.93L377.57-33.93L377.57-42.12L384.74-42.12L384.74-53.82L395.35-53.82L395.35-42.12L407.52-42.12L407.52-33.93L395.35-33.93L395.35-18.49Q395.35-16.03 395.41-14.06Q395.47-12.09 396.21-10.92L396.21-10.92Q397.61-8.70 400.69-8.50Q403.78-8.31 407.52-8.81L407.52-8.81Z M435.46 1.17L435.46 1.17Q428.98 1.17 424.05-1.62Q419.12-4.41 416.33-9.30Q413.54-14.20 413.54-20.51L413.54-20.51Q413.54-27.42 416.27-32.53Q419-37.63 423.80-40.46Q428.59-43.29 434.83-43.29L434.83-43.29Q441.46-43.29 446.11-40.17Q450.75-37.05 452.97-31.39Q455.19-25.74 454.53-18.10L454.53-18.10L424.97-18.10Q425.47-14.31 427.35-11.97L427.35-11.97Q429.88-8.74 434.83-8.74L434.83-8.74Q437.95-8.74 440.18-10.10Q442.40-11.47 443.57-14.04L443.57-14.04L454.18-11.00Q451.80-5.23 446.67-2.03Q441.54 1.17 435.46 1.17ZM425.24-25.97L443.80-25.97Q443.34-29.41 442.01-31.28L442.01-31.28Q439.94-34.09 435.30-34.09L435.30-34.09Q429.88-34.09 427.35-30.81L427.35-30.81Q425.86-28.90 425.24-25.97L425.24-25.97Z"/>
                </g>
              </svg>
              {/* Company details below logo */}
              <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-0.5">{COMPANY.legal}</div>
              <div className="text-[11px] text-slate-600 leading-snug">{COMPANY.address}</div>
              <div className="text-[11px] text-slate-600">{COMPANY.state}</div>
              <div className="text-[11px] text-slate-600 mt-0.5">{COMPANY.phone} · {COMPANY.email}</div>
              <div className="text-[11px] text-slate-600">GSTIN/UIN: {COMPANY.gstin}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-wide text-slate-900">QUOTATION</div>
              <div className="text-sm font-semibold mt-1" style={{ color: '#1F6BC7' }}>{quote.number}</div>
              <div className="text-xs text-slate-600 mt-2">
                <div>Date: <span className="font-medium text-slate-800">{formatDate(quote.created_at)}</span></div>
                <div>Valid Until: <span className="font-medium text-slate-800">{formatDate(quote.valid_until)}</span></div>
              </div>
            </div>
          </div>

          {/* Accent line */}
          <div className="mt-4 mb-5 h-[3px] rounded-full" style={{ backgroundColor: '#1F6BC7' }} />

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
              <tr style={{ backgroundColor: '#1F6BC7', color: '#fff' }}>
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
              <span className="text-2xl font-extrabold" style={{ color: '#1F6BC7' }}>
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
          <div className="mt-6 text-[11px] text-slate-600">

            {/* Terms row */}
            <div className="mb-4">
              <div className="font-semibold text-slate-800 mb-1">Terms &amp; Conditions</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>This quote is valid for {quote.validity_days || 7} days from date of issue.</li>
                <li>Prices are subject to change without prior notice.</li>
                <li>GST will be charged as applicable.</li>
                <li>Delivery within 5-7 working days from confirmed order.</li>
                <li>Payment terms: 50% advance, balance against delivery.</li>
              </ul>
            </div>

            {/* Bank details + signatory in a bordered grid */}
            <div style={{ border: '1px solid #CBD5E1', borderRadius: 6, overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: '5px 10px', background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', borderRight: '1px solid #CBD5E1', fontWeight: 700, color: '#1e293b', fontSize: 10.5 }}>
                  Bank Details
                </div>
                <div style={{ padding: '5px 10px', background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', fontWeight: 700, color: '#1e293b', fontSize: 10.5 }}>
                  For {COMPANY.legal}
                </div>
              </div>
              {/* Content row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: '10px', borderRight: '1px solid #CBD5E1', lineHeight: 1.8 }}>
                  <div><span style={{ color: '#64748b' }}>Name:</span> <strong>{BANK.name}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Bank:</span> <strong>{BANK.bank}, {BANK.branch}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Account No.:</span> <strong>{BANK.account}</strong></div>
                  <div><span style={{ color: '#64748b' }}>IFSC Code:</span> <strong>{BANK.ifsc}</strong></div>
                </div>
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minHeight: 80 }}>
                  <div style={{ borderTop: '1px solid #94a3b8', width: 160, textAlign: 'center', paddingTop: 4, color: '#475569', fontSize: 10 }}>
                    Authorized Signatory
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 8, textAlign: 'center', fontSize: 9.5, color: '#94a3b8' }}>
              This is a computer-generated quotation and does not require a physical signature.
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
