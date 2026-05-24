import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { amountInWords } from '../utils/amountInWords';

const isCapacitor = () =>
  typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.());
const canNativeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const canShareFiles = () =>
  canNativeShare() &&
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] });

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const formatDate = (iso) => {
  if (!iso) return '—';
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

/* ── Group items by category ── */
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

const DownloadIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
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

const WhatsAppIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.47 0 .14 5.33.14 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.57 0 11.9-5.33 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42zM12.05 21.5h-.01a9.6 9.6 0 0 1-4.9-1.34l-.35-.21-3.75.98 1-3.66-.23-.38a9.55 9.55 0 0 1-1.48-5.1c0-5.28 4.3-9.58 9.6-9.58 2.56 0 4.97 1 6.78 2.81a9.5 9.5 0 0 1 2.8 6.78c0 5.28-4.3 9.58-9.46 9.58zm5.45-7.18c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.18.2-.35.22-.65.07a8.18 8.18 0 0 1-2.4-1.48 9.04 9.04 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.5-.5-.67-.5l-.57-.01a1.1 1.1 0 0 0-.8.38c-.27.3-1.04 1.02-1.04 2.48 0 1.47 1.06 2.88 1.2 3.08.16.2 2.1 3.2 5.1 4.5.71.3 1.26.48 1.7.62.7.22 1.35.19 1.86.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z" />
  </svg>
);

export default function BillPreview() {
  const { id } = useParams();
  const { toast } = useToast();
  const docRef = useRef(null);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchBill = async () => {
    try {
      const res = await api.get(`/api/bills/${id}/pdf-data`);
      setData(res.data.pdf);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load bill');
    }
  };

  useEffect(() => { fetchBill(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const gstBuckets = useMemo(() => {
    const buckets = {};
    if (!data || data.bill.gst_mode === 'without_gst') return buckets;
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
  if (!data)  return <div className="text-sm text-slate-500">Loading bill…</div>;

  const { bill, client, employee, items, totals } = data;
  const groups = groupByCategory(items);
  const isWithoutGst = bill.gst_mode === 'without_gst';
  const fileName = `Aromadelite_Bill_${bill.number}.pdf`;
  const onMobile = isCapacitor() || (typeof window !== 'undefined' && window.innerWidth < 640);

  const statusPill = {
    draft:     'bg-slate-100 text-slate-700',
    issued:    'bg-blue-100 text-blue-800',
    paid:      'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-rose-100 text-rose-700',
  }[bill.status] || 'bg-slate-100 text-slate-700';

  /* ── Mark issued ── */
  const onMarkIssued = async () => {
    setUpdatingStatus(true);
    try {
      await api.patch(`/api/bills/${id}/status`, { status: 'issued' });
      toast('Bill marked as issued.', { kind: 'success' });
      await fetchBill();
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update status', { kind: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  /* ── PDF ── */
  const buildPdf = async () => {
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
    return pdf;
  };

  const onDownloadPdf = async () => {
    if (!docRef.current) return;
    setDownloading(true);
    try {
      const pdf = await buildPdf();
      pdf.save(fileName);
      toast('PDF downloaded.', { kind: 'success' });
    } catch {
      toast('PDF export failed.', { kind: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const onSharePdf = async () => {
    if (!docRef.current) return;
    setSharingPdf(true);
    try {
      const pdf = await buildPdf();
      if (canShareFiles()) {
        const blob = pdf.output('blob');
        const file = new File([blob], fileName, { type: 'application/pdf' });
        try {
          await navigator.share({ title: `Bill ${bill.number} – Aromadelite`, files: [file] });
          toast('PDF shared.', { kind: 'success' });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return;
        }
      }
      pdf.save(fileName);
      toast('PDF downloaded.', { kind: 'success' });
    } catch {
      toast('PDF export failed.', { kind: 'error' });
    } finally {
      setSharingPdf(false);
    }
  };

  /* ── WhatsApp message ── */
  const onShareWhatsApp = () => {
    const fmtAmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
    const greeting = client.business_name
      ? `Dear *${client.business_name}* (Attn: ${client.name}),`
      : `Dear *${client.name}*,`;

    const itemLines = [];
    let serial = 1;
    for (const g of groups) {
      if (g.rows.length) itemLines.push(`\n📦 *${g.name}*`);
      for (const it of g.rows) {
        itemLines.push(
          `${serial}. *${it.product_name || it.name}*` +
          (it.variant ? ` – ${it.variant}` : '') +
          (it.pack_size ? ` [${it.pack_size}]` : '') +
          `\n   Qty: ${it.quantity} × ₹${fmtAmt(it.unit_price)} = *₹${fmtAmt(it.line_total)}*`
        );
        serial++;
      }
    }

    const gstLine = isWithoutGst
      ? '_(All prices inclusive of GST)_\n'
      : `GST:       ₹${fmtAmt(totals.gst_amount)}\n`;

    const msg = `🌿 *AROMADELITE — BILL*
_Sri Vemuri Sai Enterprises_

${greeting}

Please find your bill below:

━━━━━━━━━━━━━━━━━━━
🧾 *Bill No:* ${bill.number}
📅 *Date:* ${formatDate(bill.created_at)}
━━━━━━━━━━━━━━━━━━━
${itemLines.join('\n')}

━━━━━━━━━━━━━━━━━━━
Subtotal:  ₹${fmtAmt(totals.subtotal)}
${gstLine}*TOTAL:    ₹${fmtAmt(totals.total_amount)}*
━━━━━━━━━━━━━━━━━━━

📞 *6304382947*
✉️ contact@aromadelite.in
🌿 *Aromadelite Team*`;

    const phone = (client.phone || '').replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* ─────────── RENDER ─────────── */
  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${statusPill}`}>
            {bill.status}
          </span>
          <span className="text-xs font-mono text-slate-500">{bill.number}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            isWithoutGst ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {isWithoutGst ? 'GST Absorbed' : 'With GST'}
          </span>
          {bill.quote_id && (
            <Link
              to={`/quotes/${bill.quote_id}`}
              className="text-xs text-[#1F6BC7] hover:underline"
            >
              ← View Quote
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* WhatsApp */}
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe59] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm"
            style={{ minHeight: 44 }}
          >
            <WhatsAppIcon />
            <span>{onMobile ? 'WhatsApp' : 'Share via WhatsApp'}</span>
          </button>

          {/* Share PDF */}
          <button
            type="button"
            onClick={onSharePdf}
            disabled={sharingPdf}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
            style={{ minHeight: 44 }}
          >
            {canShareFiles() ? <ShareIcon /> : <DownloadIcon />}
            <span>{sharingPdf ? 'Preparing…' : canShareFiles() ? 'Share PDF' : 'Download PDF'}</span>
          </button>

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

          {/* Mark Issued */}
          {bill.status === 'draft' && (
            <button
              type="button"
              onClick={onMarkIssued}
              disabled={updatingStatus}
              className="inline-flex items-center gap-2 bg-[#1F6BC7] hover:bg-[#155DA6] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
              style={{ minHeight: 44 }}
            >
              <span>{updatingStatus ? 'Updating…' : '✓ Mark as Issued'}</span>
            </button>
          )}

          <Link
            to="/quotes"
            className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl px-4 py-2.5"
            style={{ minHeight: 44 }}
          >← My Quotes</Link>
        </div>
      </div>

      {/* PDF-capturable Bill Document */}
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
                    <ellipse cx="0" cy="-30" rx="28" ry="44" fill="#D4A017"/>
                    <ellipse cx="0" cy="-28" rx="16" ry="28" fill="#E8B830"/>
                    <ellipse cx="-2" cy="-14" rx="6" ry="10" fill="#F5D26A" opacity="0.7"/>
                    <ellipse cx="-8" cy="-46" rx="4" ry="7" fill="#F5D26A" opacity="0.5"/>
                    <path d="M-8 -70 Q 0 -80 8 -70 Q 12 -62 8 -60 Q 0 -56 -8 -60 Q -12 -62 -8 -70 Z" fill="#D4A017"/>
                  </g>
                  <g transform="translate(66 0)">
                    <rect x="-3.5" y="-8" width="7" height="12" rx="1.5" fill="#6A4527"/>
                    <path d="M0 -82 C 24 -82 32 -58 32 -36 C 32 -14 18 -6 0 -6 C -18 -6 -32 -14 -32 -36 C -32 -58 -24 -82 0 -82 Z" fill="#3D9354"/>
                    <path d="M-2 -74 C 12 -74 20 -56 20 -40 C 20 -28 10 -22 -2 -22 C -14 -22 -20 -32 -20 -46 C -20 -60 -16 -74 -2 -74 Z" fill="#2F7B43" opacity="0.55"/>
                  </g>
                  <text x="0" y="40" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="34" letterSpacing="8" fill="#ffffff">AROMADELITE</text>
                </g>
              </svg>
              <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, color: '#0F1620', fontSize: 12 }}>{COMPANY.legal}</div>
                <div>{COMPANY.address}</div>
                <div>{COMPANY.state}</div>
                <div>GSTIN: {COMPANY.gstin}</div>
                <div>{COMPANY.phone} · {COMPANY.email}</div>
              </div>
            </div>

            {/* Bill label */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1F6BC7', letterSpacing: '-0.5px', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase' }}>
                BILL
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>No. {bill.number}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Date: {formatDate(bill.created_at)}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  background: isWithoutGst ? '#FEF3C7' : '#EFF6FF',
                  color: isWithoutGst ? '#92400E' : '#1e40af',
                  border: `1px solid ${isWithoutGst ? '#FCD34D' : '#BFDBFE'}`,
                }}>
                  {isWithoutGst ? 'GST INCLUSIVE' : 'WITH GST'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '2px solid #1F6BC7', margin: '16px 0' }} />

          {/* Bill to & Associate */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Bill To
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1620' }}>
                {client.business_name || client.name}
              </div>
              {client.business_name && (
                <div style={{ fontSize: 12, color: '#475569' }}>Attn: {client.name}</div>
              )}
              {client.type && <div style={{ fontSize: 11, color: '#64748b' }}>{client.type}</div>}
              {client.city && <div style={{ fontSize: 11, color: '#64748b' }}>{client.city}</div>}
              {client.phone && <div style={{ fontSize: 11, color: '#64748b' }}>📞 {client.phone}</div>}
              {client.email && <div style={{ fontSize: 11, color: '#64748b' }}>✉ {client.email}</div>}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Sales Associate
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1620' }}>{employee.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>ID: {employee.employee_id}</div>
              {employee.region && <div style={{ fontSize: 11, color: '#64748b' }}>Region: {employee.region}</div>}
              {employee.phone && <div style={{ fontSize: 11, color: '#64748b' }}>📞 {employee.phone}</div>}
              {employee.email && <div style={{ fontSize: 11, color: '#64748b' }}>✉ {employee.email}</div>}
            </div>
          </div>

          {/* Items table */}
          {groups.map((group) => (
            <div key={group.name} style={{ marginBottom: 16 }}>
              <div style={{ background: '#1F6BC7', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: '6px 6px 0 0', letterSpacing: 0.5 }}>
                {group.name}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#374151', width: 28 }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Product</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#374151', width: 55 }}>Qty</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#374151', width: 80 }}>
                      {isWithoutGst ? 'Price (Incl.)' : 'Unit Price'}
                    </th>
                    {!isWithoutGst && (
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#374151', width: 55 }}>GST</th>
                    )}
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#374151', width: 80 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((it, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid #F1F5F9', background: ri % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '6px 8px', color: '#94a3b8', textAlign: 'center' }}>{it._idx}</td>
                      <td style={{ padding: '6px 8px', color: '#1e293b' }}>
                        <div style={{ fontWeight: 600 }}>{it.product_name || it.name}</div>
                        {(it.variant || it.pack_size) && (
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>
                            {[it.variant, it.pack_size].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#374151' }}>{it.quantity}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#374151' }}>
                        {formatINR(it.unit_price)}
                      </td>
                      {!isWithoutGst && (
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>
                          {it.gst_percent || 0}%
                        </td>
                      )}
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                        {formatINR(it.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#F8FAFC' }}>
                    <td colSpan={isWithoutGst ? 4 : 5} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: 11, color: '#374151' }}>
                      Category Subtotal
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#1F6BC7' }}>
                      {formatINR(group.subtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <table style={{ width: 300, fontSize: 12, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', color: '#64748b' }}>Subtotal</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>{formatINR(totals.subtotal)}</td>
                </tr>
                {!isWithoutGst && Object.entries(gstBuckets).filter(([, v]) => v.gst > 0).map(([rate, v]) => (
                  <tr key={rate}>
                    <td style={{ padding: '4px 8px', color: '#64748b' }}>GST @ {rate}%</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: '#64748b' }}>{formatINR(v.gst)}</td>
                  </tr>
                ))}
                {isWithoutGst && (
                  <tr>
                    <td style={{ padding: '4px 8px', color: '#94a3b8', fontStyle: 'italic', fontSize: 10 }} colSpan={2}>
                      All prices inclusive of applicable GST
                    </td>
                  </tr>
                )}
                <tr style={{ borderTop: '2px solid #1F6BC7' }}>
                  <td style={{ padding: '8px 8px 4px', fontWeight: 800, fontSize: 14, color: '#0F1620', fontFamily: 'Manrope, sans-serif' }}>TOTAL</td>
                  <td style={{ padding: '8px 8px 4px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#1F6BC7', fontFamily: 'Manrope, sans-serif' }}>{formatINR(totals.total_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount in words */}
          {totals.total_amount > 0 && (
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px', marginBottom: 20 }}>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>Amount in Words: </span>
              <span style={{ fontSize: 11, color: '#374151', fontStyle: 'italic' }}>
                {amountInWords(totals.total_amount)} Only
              </span>
            </div>
          )}

          {/* Notes */}
          {bill.notes && (
            <div style={{ marginBottom: 20, padding: '10px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>NOTES</div>
              <div style={{ fontSize: 11, color: '#78350F' }}>{bill.notes}</div>
            </div>
          )}

          {/* Bank Details */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Bank Details</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', fontSize: 11 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 12px', fontWeight: 700, color: '#374151', background: '#F8FAFC', width: '35%', borderBottom: '1px solid #E2E8F0' }}>Account Name</td>
                  <td style={{ padding: '6px 12px', color: '#1e293b', borderBottom: '1px solid #E2E8F0' }}>{BANK.name}</td>
                  <td style={{ padding: '6px 12px', fontWeight: 700, color: '#374151', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>Bank</td>
                  <td style={{ padding: '6px 12px', color: '#1e293b', borderBottom: '1px solid #E2E8F0' }}>{BANK.bank}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 12px', fontWeight: 700, color: '#374151', background: '#F8FAFC' }}>Account No.</td>
                  <td style={{ padding: '6px 12px', color: '#1e293b', fontWeight: 600, letterSpacing: 1 }}>{BANK.account}</td>
                  <td style={{ padding: '6px 12px', fontWeight: 700, color: '#374151', background: '#F8FAFC' }}>IFSC / Branch</td>
                  <td style={{ padding: '6px 12px', color: '#1e293b' }}>{BANK.ifsc} / {BANK.branch}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signature */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ textAlign: 'center', minWidth: 180 }}>
              <img
                src="/signature.png"
                alt="Authorized Signature"
                style={{ maxWidth: 180, maxHeight: 90, display: 'block', margin: '0 auto 4px', mixBlendMode: 'multiply' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: 4, fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                Authorized Signatory
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{COMPANY.legal}</div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 24, borderTop: '1px solid #E2E8F0', paddingTop: 10, textAlign: 'center', fontSize: 9, color: '#94a3b8' }}>
            This is a computer generated bill · {COMPANY.name} · {COMPANY.address} · {COMPANY.phone}
          </div>
        </div>
      </div>
    </div>
  );
}
