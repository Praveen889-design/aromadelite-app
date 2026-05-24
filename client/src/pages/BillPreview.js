import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { amountInWords } from '../utils/amountInWords';

const isCapacitor = () => typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.());
const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const canShareFiles = () =>
  canNativeShare() &&
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] });

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const fmtNum = (n, dec = 2) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: dec }).format(n || 0);

const formatDate = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  const d = s.length === 10 ? new Date(s + 'T00:00:00') : new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const DownloadIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const ShareIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);
const WhatsAppIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.47 0 .14 5.33.14 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.57 0 11.9-5.33 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42zm-8.47 18h-.01a9.6 9.6 0 0 1-4.9-1.34l-.35-.21-3.75.98 1-3.66-.23-.38a9.55 9.55 0 0 1-1.48-5.1c0-5.28 4.3-9.58 9.6-9.58 2.56 0 4.97 1 6.78 2.81a9.5 9.5 0 0 1 2.8 6.78c0 5.28-4.3 9.58-9.46 9.58zm5.45-7.18c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.18.2-.35.22-.65.07a8.18 8.18 0 0 1-2.4-1.48 9.04 9.04 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.5-.5-.67-.5l-.57-.01a1.1 1.1 0 0 0-.8.38c-.27.3-1.04 1.02-1.04 2.48 0 1.47 1.06 2.88 1.2 3.08.16.2 2.1 3.2 5.1 4.5.71.3 1.26.48 1.7.62.7.22 1.35.19 1.86.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z"/>
  </svg>
);

/* ── Tax Summary grouped by HSN + GST rate ── */
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
    buckets[key].taxable    += base;
    buckets[key].cgst       += cgst;
    buckets[key].sgst       += sgst;
    buckets[key].total_tax  += cgst + sgst;
  }
  return Object.values(buckets).map((b) => ({
    ...b,
    taxable:    +b.taxable.toFixed(2),
    cgst:       +b.cgst.toFixed(2),
    sgst:       +b.sgst.toFixed(2),
    total_tax:  +b.total_tax.toFixed(2),
  }));
};

/* ── Inline cell style helpers ── */
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

  const isWithoutGst = data?.bill?.gst_mode === 'without_gst';

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
  if (!data)  return <div className="text-sm text-slate-500">Loading bill…</div>;

  const { bill, client, items, totals } = data;
  const totalQty     = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const subTotal     = totals.total_amount; // GST-inclusive total (or plain for without_gst)
  const roundOff     = +(Math.round(subTotal) - subTotal).toFixed(2);
  const grandTotal   = +(subTotal + roundOff).toFixed(2);
  const fileName     = `Aromadelite_Bill_${bill.number}.pdf`;
  const onMobile     = isCapacitor() || (typeof window !== 'undefined' && window.innerWidth < 640);

  const statusPill = {
    draft: 'bg-slate-100 text-slate-700',
    issued: 'bg-blue-100 text-blue-800',
    paid: 'bg-emerald-100 text-emerald-800',
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
      toast(e?.response?.data?.error || 'Failed to update', { kind: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  /* ── PDF builder ── */
  const buildPdf = async () => {
    const canvas = await html2canvas(docRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH  = (canvas.height * pageW) / canvas.width;
    const imgData = canvas.toDataURL('image/png');
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
    try { const pdf = await buildPdf(); pdf.save(fileName); toast('PDF downloaded.', { kind: 'success' }); }
    catch { toast('PDF export failed.', { kind: 'error' }); }
    finally { setDownloading(false); }
  };

  const onSharePdf = async () => {
    if (!docRef.current) return;
    setSharingPdf(true);
    try {
      const pdf = await buildPdf();
      if (canShareFiles()) {
        const blob = pdf.output('blob');
        const file = new File([blob], fileName, { type: 'application/pdf' });
        try { await navigator.share({ title: `Bill ${bill.number}`, files: [file] }); toast('PDF shared.', { kind: 'success' }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
      }
      pdf.save(fileName);
      toast('PDF downloaded.', { kind: 'success' });
    } catch { toast('PDF export failed.', { kind: 'error' }); }
    finally { setSharingPdf(false); }
  };

  /* ── WhatsApp message ── */
  const onShareWhatsApp = () => {
    const greeting = client.business_name ? `Dear *${client.business_name}*,` : `Dear *${client.name}*,`;
    const itemLines = items.map((it, i) =>
      `${i + 1}. *${it.product_name}* · Qty ${it.quantity} ${it.unit || ''} × ₹${fmtNum(it.unit_price)} = *₹${fmtNum(it.line_total)}*`
    );
    const gstNote = isWithoutGst ? '_(Prices inclusive of GST)_\n' : `GST: ₹${fmtNum(totals.gst_amount)}\n`;
    const msg = `🌿 *AROMADELITE — TAX INVOICE*\n_Sri Vemuri Sai Enterprises_\n\n${greeting}\n\n*Bill No:* ${bill.number}\n*Date:* ${formatDate(bill.created_at)}\n\n${itemLines.join('\n')}\n\n━━━━━━━━━━━━\n${gstNote}*TOTAL: ₹${fmtNum(grandTotal)}*\n━━━━━━━━━━━━\n\n📞 6304382947 · contact@aromadelite.in`;
    const phone = (client.phone || '').replace(/\D/g, '');
    window.open(phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="space-y-4">

      {/* ── Action bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${statusPill}`}>
            {bill.status}
          </span>
          <span className="text-xs font-mono text-slate-500">{bill.number}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${isWithoutGst ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
            {isWithoutGst ? 'GST Inclusive' : 'With GST'}
          </span>
          {bill.quote_id && (
            <Link to={`/quotes/${bill.quote_id}`} className="text-xs text-[#1F6BC7] hover:underline">← Quote</Link>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onShareWhatsApp}
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe59] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm"
            style={{ minHeight: 44 }}>
            <WhatsAppIcon /><span>{onMobile ? 'WhatsApp' : 'Share via WhatsApp'}</span>
          </button>

          <button type="button" onClick={onSharePdf} disabled={sharingPdf}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
            style={{ minHeight: 44 }}>
            {canShareFiles() ? <ShareIcon /> : <DownloadIcon />}
            <span>{sharingPdf ? 'Preparing…' : canShareFiles() ? 'Share PDF' : 'Download PDF'}</span>
          </button>

          {canShareFiles() && (
            <button type="button" onClick={onDownloadPdf} disabled={downloading}
              className="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
              style={{ minHeight: 44 }}>
              <DownloadIcon /><span>{downloading ? 'Saving…' : 'Save PDF'}</span>
            </button>
          )}

          {bill.status === 'draft' && (
            <button type="button" onClick={onMarkIssued} disabled={updatingStatus}
              className="inline-flex items-center gap-2 bg-[#1F6BC7] hover:bg-[#155DA6] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
              style={{ minHeight: 44 }}>
              <span>{updatingStatus ? 'Updating…' : '✓ Mark as Issued'}</span>
            </button>
          )}

          <Link to="/quotes" className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl px-4 py-2.5" style={{ minHeight: 44 }}>
            ← My Quotes
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TAX INVOICE DOCUMENT  (Mediciti Template)
      ══════════════════════════════════════════════════ */}
      <div style={{ background: '#f3f3f3', padding: '24px', borderRadius: 12 }}>
        <div
          ref={docRef}
          style={{
            width: 794,
            background: '#ffffff',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 11,
            color: '#1a1a2e',
            margin: '0 auto',
            padding: '24px 28px 28px',
          }}
        >
          {/* ── TITLE ── */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Georgia, serif', letterSpacing: 0.5 }}>
              Tax Invoice
            </span>
          </div>

          {/* ══ OUTER BOX ══ */}
          <div style={{ border: '1.5px solid #000', marginBottom: 0 }}>

            {/* ── Company Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: '1.5px solid #000' }}>
              {/* Logo box */}
              <div style={{ width: 110, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', flexShrink: 0, padding: 4 }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 280" width="100" height="64" aria-label="Aromadelite">
                  <path d="M0,140 Q500,-30 1000,140 Q500,310 0,140 Z" fill="#1F6BC7"/>
                  <g transform="translate(500 120)">
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
                    </g>
                    <g transform="translate(66 0)">
                      <rect x="-3.5" y="-8" width="7" height="12" rx="1.5" fill="#6A4527"/>
                      <path d="M0 -82 C 24 -82 32 -58 32 -36 C 32 -14 18 -6 0 -6 C -18 -6 -32 -14 -32 -36 C -32 -58 -24 -82 0 -82 Z" fill="#3D9354"/>
                      <path d="M-2 -74 C 12 -74 20 -56 20 -40 C 20 -28 10 -22 -2 -22 C -14 -22 -20 -32 -20 -46 C -20 -60 -16 -74 -2 -74 Z" fill="#2F7B43" opacity="0.55"/>
                    </g>
                    <text x="0" y="40" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="28" letterSpacing="6" fill="#ffffff">AROMADELITE</text>
                  </g>
                </svg>
              </div>
              {/* Company details */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1a2b5e', letterSpacing: 0.3, lineHeight: 1.15, fontFamily: 'Arial, sans-serif' }}>
                  SRI VEMURI SAI ENTERPRISES
                </div>
                <div style={{ fontSize: 11, color: '#333', marginTop: 4 }}>
                  SAI NAGAR H No 8-229/8, NVV NAGAR CHINTAL , QUTHBULLAPUR Hyderabad
                </div>
                <div style={{ display: 'flex', gap: 32, marginTop: 3, fontSize: 11 }}>
                  <span><strong>Phone:</strong>&nbsp; 6304382947</span>
                  <span><strong>Email:</strong>&nbsp; contact@aromadelite.in</span>
                </div>
                <div style={{ display: 'flex', gap: 32, marginTop: 2, fontSize: 11 }}>
                  <span><strong>GSTIN:</strong>&nbsp; 36AQJPV7026L2Z5</span>
                  <span><strong>State:</strong>&nbsp; 36-Telangana</span>
                </div>
              </div>
            </div>

            {/* ── Bill To / Invoice Details ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1.5px solid #000' }}>
              <div style={{ padding: '10px 14px', borderRight: '1.5px solid #000' }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Bill To:</div>
                {client.business_name && (
                  <div style={{ fontWeight: 800, fontSize: 12, color: '#8B0000' }}>{client.business_name}</div>
                )}
                <div style={{ fontWeight: 700, fontSize: 11 }}>{client.name}</div>
                {client.city && <div style={{ fontSize: 11 }}>{client.city}</div>}
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  {client.phone && <span>Contact No: {client.phone}&nbsp;&nbsp;</span>}
                  {client.gstin && <span>GSTIN: {client.gstin}</span>}
                </div>
                {client.state && <div style={{ fontSize: 11 }}>State: {client.state}</div>}
              </div>
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Invoice Details:</div>
                <div style={{ fontSize: 11 }}><strong>No:</strong>&nbsp; {bill.number}</div>
                <div style={{ fontSize: 11, marginTop: 3 }}><strong>Date:</strong>&nbsp; {formatDate(bill.created_at)}</div>
                <div style={{ fontSize: 11, marginTop: 3 }}>
                  <strong>Place Of Supply:</strong>&nbsp; {bill.place_of_supply || '36-Telangana'}
                </div>
                {!isWithoutGst && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                      background: '#EFF6FF', color: '#1e40af', border: '1px solid #BFDBFE',
                      padding: '2px 8px', borderRadius: 3 }}>
                      Tax Invoice (CGST + SGST)
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
                  <TH style={{ width: 72, textAlign: 'right' }}>Quantity</TH>
                  <TH style={{ width: 40 }}>Unit</TH>
                  <TH style={{ width: 90, textAlign: 'right' }}>
                    Price/ Unit(₹)
                  </TH>
                  <TH style={{ width: 90, textAlign: 'right', borderRight: 'none' }}>Amount(₹)</TH>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const lineTotal = it.line_total || 0;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                      <TD style={{ textAlign: 'center', color: '#666' }}>{i + 1}</TD>
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
                      <TD style={{ textAlign: 'right' }}>₹ {fmtNum(it.unit_price)}</TD>
                      <TD style={{ textAlign: 'right', borderRight: 'none', fontWeight: 600 }}>
                        ₹ {fmtNum(lineTotal)}
                      </TD>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr style={{ borderTop: '1.5px solid #000', fontWeight: 800, background: '#f5f5f5' }}>
                  <td colSpan={3} style={{ padding: '6px 8px', fontSize: 12, fontWeight: 800, borderRight: '1px solid #ccc' }}>
                    Total
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 12, fontWeight: 800, borderRight: '1px solid #ccc' }}>
                    {fmtNum(totalQty, 0)}
                  </td>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #ccc' }}></td>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #ccc' }}></td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 12, fontWeight: 800 }}>
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
              {/* Left: Tax Summary table */}
              <div style={{ borderRight: '1.5px solid #ccc' }}>
                <div style={{ background: '#f0f2f8', padding: '5px 10px', fontWeight: 800, fontSize: 11,
                  borderBottom: '1px solid #ccc' }}>
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
                    {/* Totals row */}
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

              {/* Right: Sub Total / Total + Amount in Words */}
              <div style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600 }}>Sub Total</td>
                      <td style={{ padding: '6px 4px', fontSize: 11 }}>:</td>
                      <td style={{ padding: '6px 10px 6px 2px', fontSize: 11, textAlign: 'right', fontWeight: 600 }}>
                        {fmtINR(subTotal)}
                      </td>
                    </tr>
                    {roundOff !== 0 && (
                      <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '6px 10px', fontSize: 11 }}>Round Off</td>
                        <td style={{ padding: '6px 4px', fontSize: 11 }}>:</td>
                        <td style={{ padding: '6px 10px 6px 2px', fontSize: 11, textAlign: 'right', color: roundOff > 0 ? '#059669' : '#dc2626' }}>
                          {roundOff > 0 ? '+' : ''}{fmtINR(roundOff)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 900, color: '#1a2b5e' }}>Total</td>
                      <td style={{ padding: '8px 4px', fontSize: 13, fontWeight: 900 }}>:</td>
                      <td style={{ padding: '8px 10px 8px 2px', fontSize: 13, fontWeight: 900, textAlign: 'right', color: '#1a2b5e' }}>
                        {fmtINR(grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ borderTop: '1.5px solid #ccc', padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 4 }}>Invoice Amount in Words:</div>
                  <div style={{ fontSize: 10, color: '#333', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {amountInWords(grandTotal)} Only
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ WITHOUT GST — simple totals ══ */}
          {isWithoutGst && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ border: '1px solid #ccc', minWidth: 260 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600 }}>Sub Total</td>
                      <td style={{ padding: '6px 4px', fontSize: 11 }}>:</td>
                      <td style={{ padding: '6px 14px', fontSize: 11, textAlign: 'right', fontWeight: 600 }}>
                        {fmtINR(subTotal)}
                      </td>
                    </tr>
                    {roundOff !== 0 && (
                      <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '6px 14px', fontSize: 11 }}>Round Off</td>
                        <td style={{ padding: '6px 4px', fontSize: 11 }}>:</td>
                        <td style={{ padding: '6px 14px', fontSize: 11, textAlign: 'right' }}>{roundOff > 0 ? '+' : ''}{fmtINR(roundOff)}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 900, color: '#1a2b5e' }}>Total</td>
                      <td style={{ padding: '8px 4px', fontSize: 13, fontWeight: 900 }}>:</td>
                      <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 900, textAlign: 'right', color: '#1a2b5e' }}>
                        {fmtINR(grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ borderTop: '1.5px solid #ccc', padding: '8px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 3 }}>Invoice Amount in Words:</div>
                  <div style={{ fontSize: 10, color: '#333', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {amountInWords(grandTotal)} Only
                  </div>
                  <div style={{ fontSize: 9, color: '#888', marginTop: 4, fontStyle: 'italic' }}>
                    (All prices inclusive of applicable GST)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          {bill.notes && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, fontSize: 10 }}>
              <strong>Notes:</strong> {bill.notes}
            </div>
          )}

          {/* ── Terms & Conditions ── */}
          <div style={{ marginTop: 10, border: '1px solid #ccc' }}>
            <div style={{ background: '#f0f2f8', padding: '5px 10px', fontWeight: 700, fontSize: 11,
              borderBottom: '1px solid #ccc' }}>
              Terms &amp; Conditions:
            </div>
            <div style={{ padding: '6px 10px', fontSize: 10, color: '#555' }}>
              Thanks for doing business with us!
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
