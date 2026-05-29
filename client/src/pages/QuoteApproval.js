import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function QuoteApproval() {
  const { token } = useParams();
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState('');
  const [step,    setStep]    = useState('view'); // 'view' | 'changes_form' | 'submitting' | 'done'
  const [decision, setDecision] = useState('');
  const [note,    setNote]    = useState('');
  const [myName,  setMyName]  = useState('');

  useEffect(() => {
    api.get(`/api/public/quote-approval/${token}`)
      .then(({ data: d }) => {
        setData(d);
        if (d.quote.client_approval_status) setStep('done');
      })
      .catch((e) => setError(e?.response?.data?.error || 'Quote link not found or has expired.'));
  }, [token]);

  const handleApprove = async () => {
    setStep('submitting');
    setDecision('approved');
    try {
      await api.post(`/api/public/quote-approval/${token}/respond`, {
        decision: 'approved',
        client_name: myName.trim() || undefined,
      });
      setData((prev) => ({
        ...prev,
        quote: { ...prev.quote, client_approval_status: 'approved' },
      }));
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to submit. Please try again.');
      setStep('view');
      return;
    }
    setStep('done');
  };

  const handleChangesSubmit = async () => {
    if (!note.trim()) return;
    setStep('submitting');
    setDecision('changes_requested');
    try {
      await api.post(`/api/public/quote-approval/${token}/respond`, {
        decision: 'changes_requested',
        note: note.trim(),
        client_name: myName.trim() || undefined,
      });
      setData((prev) => ({
        ...prev,
        quote: { ...prev.quote, client_approval_status: 'changes_requested', client_approval_note: note.trim() },
      }));
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to submit. Please try again.');
      setStep('changes_form');
      return;
    }
    setStep('done');
  };

  /* ── Loading ── */
  if (!data && !error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#0891B2' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🌿</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Loading your quote…</div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 400, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.1)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#991b1b', marginBottom: 8 }}>Link Not Found</div>
          <div style={{ fontSize: 14, color: '#64748b' }}>{error}</div>
        </div>
      </div>
    );
  }

  const { quote, client, items, totals, company } = data;
  const isExpired = quote.is_expired;
  const isWithoutGst = quote.gst_mode === 'without_gst';
  const grandTotal = +(totals.total_amount + (Math.round(totals.total_amount) - totals.total_amount)).toFixed(2);

  /* ── Done confirmation screen ── */
  if (step === 'done' || quote.client_approval_status) {
    const wasApproved = (quote.client_approval_status || decision) === 'approved';
    return (
      <div style={{ minHeight: '100vh', background: wasApproved ? '#f0fdf4' : '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '40px 32px', maxWidth: 440, width: '100%',
          textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,.1)',
          border: `2px solid ${wasApproved ? '#86efac' : '#fde047'}`,
        }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{wasApproved ? '✅' : '✏️'}</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: wasApproved ? '#065f46' : '#92400e', marginBottom: 8 }}>
            {wasApproved ? 'Quote Approved!' : 'Changes Requested'}
          </div>
          <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 16 }}>
            {wasApproved
              ? <>Thank you! You've approved <strong>{quote.quote_number}</strong>. The Aromadelite team will be in touch shortly to confirm your order.</>
              : <>Your feedback on <strong>{quote.quote_number}</strong> has been sent. The team will review your notes and get back to you with a revised quote.</>
            }
          </div>
          {quote.client_approval_note && !wasApproved && (
            <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#713f12', textAlign: 'left' }}>
              <strong>Your note:</strong> "{quote.client_approval_note}"
            </div>
          )}
          <div style={{ marginTop: 24, fontSize: 13, color: '#94a3b8' }}>
            🌿 <strong>Aromadelite</strong> · {company.phone}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f9ff', fontFamily: 'Arial, Helvetica, sans-serif' }}>

      {/* ── Top bar ── */}
      <div style={{ background: '#0891B2', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13z"/>
          <path d="M9.5 13a3 3 0 0 0 3.5 3"/>
        </svg>
        <div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>Aromadelite</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Sri Vemuri Sai Enterprises</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.8, textAlign: 'right' }}>
          <div>Quotation #{quote.quote_number}</div>
          <div>Valid till {fmtDate(quote.valid_until)}</div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* Expired banner */}
        {isExpired && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>This quotation has expired</div>
              <div style={{ fontSize: 12, color: '#b91c1c' }}>Valid until {fmtDate(quote.valid_until)}. Please contact us for a renewed quote.</div>
            </div>
          </div>
        )}

        {/* Client greeting */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 20px 16px', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
            {client.business_name
              ? <>Hi, <span style={{ color: '#0891B2' }}>{client.business_name}</span>! 👋</>
              : <>Hi, <span style={{ color: '#0891B2' }}>{client.name}</span>! 👋</>
            }
          </div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
            Please review your customised quotation from <strong>Aromadelite</strong> below.
            Once you're happy, tap <strong>Approve</strong> — or request changes if you'd like something adjusted.
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: '#475569' }}>📋 <strong>Quote:</strong> {quote.quote_number}</div>
            <div style={{ fontSize: 12, color: '#475569' }}>📅 <strong>Date:</strong> {fmtDate(quote.created_at)}</div>
            <div style={{ fontSize: 12, color: isExpired ? '#dc2626' : '#475569' }}>
              ⏳ <strong>Valid till:</strong> {fmtDate(quote.valid_until)}
            </div>
          </div>
        </div>

        {/* Items table */}
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
            📦 Items
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['#', 'Product', 'Qty', 'Unit', 'Rate', 'GST', 'Amount'].map((h) => (
                    <th key={h} style={{
                      padding: '9px 12px', fontSize: 11, fontWeight: 700,
                      color: '#64748b', textAlign: h === '#' || h === 'Qty' ? 'center' : h === 'Amount' || h === 'Rate' || h === 'GST' ? 'right' : 'left',
                      borderBottom: '1.5px solid #e2e8f0', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 12px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>{i + 1}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{it.product_name}</div>
                      {(it.variant || it.pack_size) && (
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {[it.variant, it.pack_size].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {it.description && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
                          {it.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, fontSize: 13 }}>{it.quantity}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#64748b' }}>{it.unit}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 13 }}>
                      {fmt(it.unit_price)}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                      {it.gst_percent}%
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                      {fmt(it.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ padding: '12px 18px', borderTop: '1.5px solid #e2e8f0', background: '#f8fafc' }}>
            {!isWithoutGst && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                  <span>Subtotal</span><span>{fmt(totals.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                  <span>GST</span><span>{fmt(totals.gst_amount)}</span>
                </div>
              </>
            )}
            {isWithoutGst && (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>* Prices are inclusive of GST</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900, color: '#0891B2' }}>
              <span>Total Amount</span>
              <span>{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,.05)', fontSize: 13, color: '#475569' }}>
            📝 <strong>Note from our team:</strong> {quote.notes}
          </div>
        )}

        {/* ── Action section ── */}
        {!isExpired && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>
              What would you like to do?
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Your response will be sent directly to the Aromadelite team.
            </div>

            {/* Optional name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                Your name (optional)
              </label>
              <input
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder={client.name}
                disabled={step === 'submitting'}
                style={{
                  width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 9,
                  padding: '9px 12px', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box', color: '#0f172a',
                  background: step === 'submitting' ? '#f8fafc' : '#fff',
                }}
              />
            </div>

            {step === 'changes_form' ? (
              /* Changes request form */
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                  What changes do you need? <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="e.g. Please reduce the quantity of Floor Cleaner to 10 units, and add 5 units of Hand Wash..."
                  style={{
                    width: '100%', border: `1.5px solid ${note.trim() ? '#fcd34d' : '#fca5a5'}`,
                    borderRadius: 9, padding: '10px 12px', fontSize: 14,
                    outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                    boxSizing: 'border-box', color: '#0f172a',
                  }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={handleChangesSubmit}
                    disabled={!note.trim()}
                    style={{
                      flex: 1, padding: '13px 20px', borderRadius: 10,
                      border: 'none', cursor: note.trim() ? 'pointer' : 'not-allowed',
                      background: note.trim() ? '#d97706' : '#e5e7eb',
                      color: note.trim() ? '#fff' : '#9ca3af',
                      fontWeight: 800, fontSize: 15,
                    }}
                  >
                    ✏️ Submit Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('view')}
                    style={{
                      padding: '13px 18px', borderRadius: 10, border: '1px solid #e2e8f0',
                      background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Approve */}
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={step === 'submitting'}
                  style={{
                    width: '100%', padding: '16px 20px', borderRadius: 12,
                    border: 'none', cursor: step === 'submitting' ? 'not-allowed' : 'pointer',
                    background: step === 'submitting' ? '#6ee7b7' : 'linear-gradient(135deg, #059669, #047857)',
                    color: '#fff', fontWeight: 900, fontSize: 17,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                  }}
                >
                  <span style={{ fontSize: 22 }}>✅</span>
                  {step === 'submitting' && decision === 'approved' ? 'Submitting…' : 'Approve This Quote'}
                </button>

                {/* Request changes */}
                <button
                  type="button"
                  onClick={() => setStep('changes_form')}
                  disabled={step === 'submitting'}
                  style={{
                    width: '100%', padding: '14px 20px', borderRadius: 12,
                    border: '2px solid #fcd34d', cursor: step === 'submitting' ? 'not-allowed' : 'pointer',
                    background: '#fff', color: '#92400e', fontWeight: 800, fontSize: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 20 }}>✏️</span>
                  I Need Changes
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: '#94a3b8' }}>
          <div>🌿 <strong>Aromadelite</strong> · Sri Vemuri Sai Enterprises</div>
          <div style={{ marginTop: 4 }}>{company.phone} · {company.email}</div>
          <div style={{ marginTop: 2 }}>{company.address}</div>
          <div style={{ marginTop: 4, fontSize: 11 }}>GSTIN: {company.gstin}</div>
        </div>
      </div>
    </div>
  );
}
