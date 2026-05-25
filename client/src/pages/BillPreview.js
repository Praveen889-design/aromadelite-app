import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { amountInWords } from '../utils/amountInWords';
import { isNative, downloadPdf, sharePdf } from '../utils/pdfNative';

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
  const navigate = useNavigate();
  const { toast } = useToast();
  const docRef    = useRef(null);
  const headerRef = useRef(null);

  const [data, setData]                       = useState(null);
  const [error, setError]                     = useState('');
  const [downloading, setDownloading]         = useState(false);
  const [sharingPdf, setSharingPdf]           = useState(false);
  const [updatingStatus, setUpdatingStatus]   = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  // Partial payments
  const [payments, setPayments]               = useState([]);
  const [showPayPanel, setShowPayPanel]       = useState(false);
  const [payForm, setPayForm]                 = useState({ amount: '', method: 'cash', date: new Date().toISOString().slice(0,10), notes: '' });
  const [savingPay, setSavingPay]             = useState(false);
  const [deletingPay, setDeletingPay]         = useState(null);
  const [repeating, setRepeating]             = useState(false);
  const [waEnabled,   setWaEnabled]           = useState(false);
  const [sendingWA,   setSendingWA]           = useState(false);
  const [waMessages,  setWaMessages]          = useState([]);

  const fetchBill = async () => {
    try {
      const res = await api.get(`/api/bills/${id}/pdf-data`);
      setData(res.data.pdf);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load bill');
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await api.get(`/api/bills/${id}/payments`);
      setPayments(res.data.payments || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchBill();
    fetchPayments();
    // Check WA config
    api.get('/api/whatsapp/config')
      .then(({ data }) => { setWaEnabled(!!data.config?.phone_number_id); })
      .catch(() => {});
    // Load WA message log for this bill
    api.get(`/api/whatsapp/messages?bill_id=${id}`)
      .then(({ data }) => { setWaMessages(data.messages || []); })
      .catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const recordPayment = async () => {
    if (!payForm.amount || isNaN(Number(payForm.amount)) || Number(payForm.amount) <= 0) {
      toast('Enter a valid amount', { kind: 'error' }); return;
    }
    setSavingPay(true);
    try {
      await api.post(`/api/bills/${id}/payments`, {
        amount: Number(payForm.amount),
        payment_method: payForm.method,
        payment_date: payForm.date,
        notes: payForm.notes || null,
      });
      toast('✅ Payment recorded!', { kind: 'success' });
      setPayForm({ amount: '', method: 'cash', date: new Date().toISOString().slice(0,10), notes: '' });
      setShowPayPanel(false);
      await Promise.all([fetchBill(), fetchPayments()]);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to record payment', { kind: 'error' });
    } finally {
      setSavingPay(false);
    }
  };

  const deletePayment = async (pid) => {
    setDeletingPay(pid);
    try {
      await api.delete(`/api/bills/${id}/payments/${pid}`);
      toast('Payment entry removed', { kind: 'success' });
      await Promise.all([fetchBill(), fetchPayments()]);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed', { kind: 'error' });
    } finally {
      setDeletingPay(null);
    }
  };

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
  const onMobile     = isNative() || (typeof window !== 'undefined' && window.innerWidth < 640);

  const statusPill = {
    draft: 'bg-slate-100 text-slate-700',
    issued: 'bg-blue-100 text-blue-800',
    paid: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-rose-100 text-rose-700',
  }[bill.status] || 'bg-slate-100 text-slate-700';

  /* ── Mark full payment completed / revert to pending ── */
  const onTogglePayment = async () => {
    const newStatus = bill.payment_status === 'completed' ? 'pending' : 'completed';
    setUpdatingPayment(true);
    try {
      await api.patch(`/api/bills/${id}/payment`, { payment_status: newStatus });
      toast(
        newStatus === 'completed'
          ? '✅ Full payment marked completed. Lead converted!'
          : 'Payment reverted to pending.',
        { kind: 'success' }
      );
      await Promise.all([fetchBill(), fetchPayments()]);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update payment', { kind: 'error' });
    } finally {
      setUpdatingPayment(false);
    }
  };

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

  /* ── PDF builder — canvas-sliced, header repeats on every page ── */
  const buildPdf = async () => {
    const scale = 2;
    const [fullCanvas, headerCanvas] = await Promise.all([
      html2canvas(docRef.current,    { scale, useCORS: true, backgroundColor: '#ffffff' }),
      html2canvas(headerRef.current, { scale, useCORS: true, backgroundColor: '#ffffff' }),
    ]);

    const pdf   = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const pxToPt  = pageW / fullCanvas.width;
    const pageHpx = pageH / pxToPt; // float — no rounding to avoid drift

    // Normalise header to the same pixel width as fullCanvas
    const hdrNormH = Math.round((headerCanvas.height / headerCanvas.width) * fullCanvas.width);
    const hdrHpt   = hdrNormH * pxToPt;

    // Single reusable temp canvas
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

    const p1H    = Math.min(pageHpx, fullCanvas.height);
    const p1Data = crop(fullCanvas, 0, p1H, fullCanvas.width);
    pdf.addImage(p1Data, 'JPEG', 0, 0, pageW, p1H * pxToPt, undefined, 'FAST');

    let srcY = pageHpx;
    while (srcY < fullCanvas.height) {
      pdf.addPage();
      pdf.addImage(hdrData, 'JPEG', 0, 0, pageW, hdrHpt, undefined, 'FAST');
      const sliceH = Math.min(pageHpx - hdrNormH, fullCanvas.height - srcY);
      if (sliceH > 0) {
        const sliceData = crop(fullCanvas, srcY, sliceH, fullCanvas.width);
        if (sliceData) {
          pdf.addImage(sliceData, 'JPEG', 0, hdrHpt, pageW, sliceH * pxToPt, undefined, 'FAST');
        }
      }
      srcY += (pageHpx - hdrNormH);
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
    }
    catch { toast('PDF export failed.', { kind: 'error' }); }
    finally { setDownloading(false); }
  };

  const onSharePdf = async () => {
    if (!docRef.current) return;
    setSharingPdf(true);
    try {
      const pdf = await buildPdf();
      await sharePdf(pdf, fileName, `Bill ${bill.number} – Aromadelite`);
      toast('PDF shared.', { kind: 'success' });
    }
    catch (e) { if (e?.message !== 'Share canceled') toast('PDF export failed.', { kind: 'error' }); }
    finally { setSharingPdf(false); }
  };

  /* ── WhatsApp: always try PDF first on both web and native ── */
  const onShareWhatsApp = async () => {
    if (!docRef.current) return;
    setSharingPdf(true);
    try {
      const pdf = await buildPdf();
      await sharePdf(pdf, fileName, `Bill ${bill.number} – Aromadelite`);
      toast('PDF shared.', { kind: 'success' });
    } catch (e) {
      const cancelled = e?.name === 'AbortError' || e?.message === 'Share canceled';
      if (!cancelled) {
        // Last resort: open WhatsApp with text (desktop browsers without share API)
        const greeting  = client.business_name ? `Dear *${client.business_name}*,` : `Dear *${client.name}*,`;
        const itemLines = items.map((it, i) =>
          `${i + 1}. *${it.product_name}* · Qty ${it.quantity} ${it.unit || ''} × ₹${fmtNum(it.unit_price)} = *₹${fmtNum(it.line_total)}*`
        );
        const gstNote = isWithoutGst ? '_(Prices inclusive of GST)_\n' : `GST: ₹${fmtNum(totals.gst_amount)}\n`;
        const msg = `🌿 *AROMADELITE — TAX INVOICE*\n_Sri Vemuri Sai Enterprises_\n\n${greeting}\n\n*Bill No:* ${bill.number}\n*Date:* ${formatDate(bill.created_at)}\n\n${itemLines.join('\n')}\n\n━━━━━━━━━━━━\n${gstNote}*TOTAL: ₹${fmtNum(grandTotal)}*\n━━━━━━━━━━━━\n\n📞 6304382947 · contact@aromadelite.in`;
        const phone = (client.phone || '').replace(/\D/g, '');
        window.open(phone
          ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setSharingPdf(false);
    }
  };

  const onRepeatOrder = async () => {
    const quoteId = data?.bill?.quote_id;
    if (!quoteId) { toast('No linked quote to repeat.', { kind: 'error' }); return; }
    setRepeating(true);
    try {
      const { data: res } = await api.post(`/api/quotes/${quoteId}/repeat`);
      toast('🔁 Repeat order created as new draft!', { kind: 'success' });
      navigate(`/quotes/${res.quote.id}`);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to repeat order', { kind: 'error' });
    } finally {
      setRepeating(false);
    }
  };

  const onSendWA = async () => {
    setSendingWA(true);
    try {
      const { data: resp } = await api.post(`/api/whatsapp/send/bill/${id}`);
      toast('✅ Bill sent to client via WhatsApp!', { kind: 'success' });
      setWaMessages((prev) => [resp.message, ...prev].slice(0, 10));
    } catch (e) {
      toast(e?.response?.data?.error || 'WhatsApp send failed', { kind: 'error' });
    } finally {
      setSendingWA(false);
    }
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

          {/* ── Payment status button ── */}
          {bill.payment_status === 'completed' ? (
            <button type="button" onClick={onTogglePayment} disabled={updatingPayment}
              className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
              style={{ minHeight: 44, background: '#d1fae5', color: '#065f46', border: '1.5px solid #6ee7b7' }}>
              <span>{updatingPayment ? 'Updating…' : '✅ Paid in Full'}</span>
            </button>
          ) : (
            <button type="button" onClick={() => setShowPayPanel((v) => !v)}
              className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm"
              style={{ minHeight: 44,
                background: bill.payment_status === 'partial' ? '#ede9fe' : '#fef3c7',
                color:      bill.payment_status === 'partial' ? '#5b21b6' : '#92400e',
                border:     bill.payment_status === 'partial' ? '1.5px solid #c4b5fd' : '1.5px solid #fcd34d',
              }}>
              <span>{bill.payment_status === 'partial' ? '💰 Partial — Record More' : '⏳ Record Payment'}</span>
            </button>
          )}

          {bill.status === 'draft' && (
            <button type="button" onClick={onMarkIssued} disabled={updatingStatus}
              className="inline-flex items-center gap-2 bg-[#1F6BC7] hover:bg-[#155DA6] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
              style={{ minHeight: 44 }}>
              <span>{updatingStatus ? 'Updating…' : '✓ Mark as Issued'}</span>
            </button>
          )}

          {/* 🔁 Repeat Order */}
          {data?.bill?.quote_id && (
            <button
              type="button"
              onClick={onRepeatOrder}
              disabled={repeating}
              className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-60"
              style={{ minHeight: 44, background: '#f0fdf4', color: '#15803d', border: '1.5px solid #86efac' }}
            >
              <span>{repeating ? 'Creating…' : '🔁 Repeat Order'}</span>
            </button>
          )}

          {/* WhatsApp Cloud API send — shown only when WA is configured */}
          {waEnabled && (
            <button
              type="button"
              onClick={onSendWA}
              disabled={sendingWA}
              title="Send bill directly via WhatsApp Business API"
              className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ minHeight: 44, background: '#075e54', color: '#fff', border: 'none' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.47 0 .14 5.33.14 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.57 0 11.9-5.33 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42z" />
              </svg>
              <span>{sendingWA ? 'Sending…' : '📲 Send via API'}</span>
            </button>
          )}

          <Link to="/clients" className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl px-4 py-2.5" style={{ minHeight: 44 }}>
            🏢 Clients
          </Link>

          <Link to="/quotes" className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl px-4 py-2.5" style={{ minHeight: 44 }}>
            ← My Quotes
          </Link>
        </div>
      </div>

      {/* ── Payment Panel ── */}
      {bill.payment_status !== 'completed' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Summary bar */}
          <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2"
               style={{ background: bill.payment_status === 'partial' ? 'linear-gradient(135deg,#faf5ff,#ede9fe)' : 'linear-gradient(135deg,#fffbeb,#fef3c7)',
                        borderBottom: '1px solid #e2e8f0' }}>
            <div className="flex gap-6 flex-wrap">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Bill Total</div>
                <div className="text-lg font-bold text-slate-900">{fmtINR(grandTotal)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Paid</div>
                <div className="text-lg font-bold text-emerald-700">{fmtINR(bill.amount_paid || 0)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Balance Due</div>
                <div className="text-lg font-bold text-rose-600">{fmtINR(Math.max(0, grandTotal - (bill.amount_paid || 0)))}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {bill.payment_status === 'partial' && (
                <button type="button" onClick={onTogglePayment} disabled={updatingPayment}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>
                  {updatingPayment ? '…' : '✅ Mark Fully Paid'}
                </button>
              )}
              <button type="button" onClick={() => setShowPayPanel((v) => !v)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {showPayPanel ? 'Cancel' : '+ Record Payment'}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {grandTotal > 0 && (
            <div style={{ height: 6, background: '#f1f5f9' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, ((bill.amount_paid || 0) / grandTotal) * 100)}%`,
                background: bill.payment_status === 'partial' ? '#8b5cf6' : '#10b981',
                transition: 'width .4s',
              }} />
            </div>
          )}

          {/* Record payment form */}
          {showPayPanel && (
            <div className="px-4 py-4 border-b border-slate-100 space-y-3">
              <div className="text-sm font-bold text-slate-800 mb-2">Record a Payment</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Amount (₹) *</label>
                  <input type="number" min="1" step="0.01"
                    placeholder={`Max ${fmtINR(Math.max(0, grandTotal - (bill.amount_paid||0)))}`}
                    value={payForm.amount}
                    onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Method</label>
                  <select value={payForm.method}
                    onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
                  <input type="date" value={payForm.date}
                    onChange={(e) => setPayForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Notes</label>
                  <input type="text" placeholder="e.g. Ref no, cheque no…"
                    value={payForm.notes}
                    onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={recordPayment} disabled={savingPay || !payForm.amount}
                  className="px-5 py-2 text-sm font-bold rounded-lg disabled:opacity-50"
                  style={{ background: '#6366f1', color: '#fff', border: 'none', cursor: savingPay ? 'not-allowed' : 'pointer' }}>
                  {savingPay ? 'Saving…' : 'Save Payment'}
                </button>
                <button type="button" onClick={() => setShowPayPanel(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Payment history */}
          {payments.length > 0 && (
            <div className="divide-y divide-slate-100">
              <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Payment History
              </div>
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {p.payment_method === 'cash' ? '💵' : p.payment_method === 'upi' ? '📱' : p.payment_method === 'cheque' ? '🧾' : '🏦'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-emerald-700">{fmtINR(p.amount)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium"
                              style={{ background: '#f1f5f9', color: '#475569' }}>
                          {p.payment_method.replace('_',' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(p.payment_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                        {p.recorded_by_name ? ` · by ${p.recorded_by_name}` : ''}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </div>
                    </div>
                  </div>
                  <button type="button"
                    disabled={deletingPay === p.id}
                    onClick={() => deletePayment(p.id)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-medium disabled:opacity-40 px-2 py-1 rounded">
                    {deletingPay === p.id ? '…' : '✕ Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── When fully paid: compact receipt strip ── */}
      {bill.payment_status === 'completed' && (
        <div className="rounded-xl border border-emerald-200 overflow-hidden" style={{ background: '#f0fdf4' }}>
          <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-bold text-emerald-800 text-sm">Fully Paid — {fmtINR(grandTotal)}</div>
                <div className="text-xs text-emerald-600">Lead converted · all payments received</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPayPanel((v) => !v)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700">
                {showPayPanel ? 'Hide history' : `History (${payments.length})`}
              </button>
              <button type="button" onClick={onTogglePayment} disabled={updatingPayment}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-50">
                {updatingPayment ? '…' : 'Revert to Pending'}
              </button>
            </div>
          </div>
          {showPayPanel && payments.length > 0 && (
            <div className="border-t border-emerald-100 divide-y divide-emerald-50">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {p.payment_method === 'cash' ? '💵' : p.payment_method === 'upi' ? '📱' : p.payment_method === 'cheque' ? '🧾' : '🏦'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-emerald-700">{fmtINR(p.amount)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium"
                              style={{ background: '#f1f5f9', color: '#475569' }}>
                          {p.payment_method.replace('_',' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(p.payment_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                        {p.recorded_by_name ? ` · by ${p.recorded_by_name}` : ''}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── WhatsApp API message log ── */}
      {waEnabled && waMessages.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-3">
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
            <div ref={headerRef} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: '1.5px solid #000' }}>
              {/* Logo */}
              <div style={{ width: 110, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0 }}>
                <img
                  src="/aromadelite-logo.png"
                  alt="Aromadelite"
                  style={{ width: 110, height: 'auto', maxHeight: 72, objectFit: 'contain' }}
                />
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
            <div style={{ padding: '6px 10px', fontSize: 10, color: '#555', lineHeight: 1.7 }}>
              1. This quotation is valid for 7 days from date of issue.
              &nbsp;&nbsp;2. Prices are subject to change without prior notice.
              &nbsp;&nbsp;3. Delivery within 3–5 working days from confirmed order.
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
