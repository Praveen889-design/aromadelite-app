import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { gradients, radii, shadow } from '../../theme/tokens';

const FinCard = ({ label, value, sub, gradient, icon }) => (
  <div style={{ position: 'relative', overflow: 'hidden', borderRadius: radii.lg, padding: 15, color: '#fff', background: gradient, boxShadow: shadow.md }}>
    <div style={{ position: 'absolute', right: -20, top: -22, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.16)' }} />
    <div style={{ position: 'relative' }}>
      <div style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 23, fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: .95, marginTop: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, opacity: .88, marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);
const fIcon = (d) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ageDays = (iso) => {
  if (!iso) return 0;
  const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

export default function PaymentPendingTab() {
  const { toast } = useToast();
  const [bills, setBills]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [marking, setMarking]   = useState(null); // bill id being updated

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/bills/payment-pending');
      setBills(data.bills || []);
    } catch {
      toast('Failed to load pending payments', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markCompleted = async (billId) => {
    setMarking(billId);
    try {
      await api.patch(`/api/bills/${billId}/payment`, { payment_status: 'completed' });
      toast('✅ Payment marked complete. Lead converted!', { kind: 'success' });
      setBills((prev) => prev.filter((b) => b.id !== billId));
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update', { kind: 'error' });
    } finally {
      setMarking(null);
    }
  };

  const totalPending  = bills.reduce((s, b) => s + Number(b.total_amount  || 0), 0);
  const totalReceived = bills.reduce((s, b) => s + Number(b.amount_paid  || 0), 0);
  const totalBalance  = totalPending - totalReceived;
  const partialCount  = bills.filter((b) => b.payment_status === 'partial').length;
  const overdueBills  = bills.filter((b) => b.payment_status !== 'partial' && ageDays(b.created_at) >= 14);
  const overdueAmount = overdueBills.reduce((s, b) => s + (Number(b.total_amount || 0) - Number(b.amount_paid || 0)), 0);

  return (
    <div style={{ padding: '20px 0' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>⏳</span>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Payment Pending</h2>
          {bills.length > 0 && (
            <span style={{
              background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
              borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
            }}>
              {bills.length} bill{bills.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Bills awaiting payment collection. Mark as completed to convert the lead.
        </p>
      </div>

      {/* Finance summary cards */}
      {bills.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <FinCard label="Balance Due" value={fmtINR(totalBalance)} sub={`${bills.length} bill${bills.length !== 1 ? 's' : ''}`}
              gradient={gradients.red} icon={fIcon(<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>)} />
            <FinCard label="Overdue 14d+" value={fmtINR(overdueAmount)} sub={`${overdueBills.length} bill${overdueBills.length !== 1 ? 's' : ''}`}
              gradient={gradients.orange} icon={fIcon(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>)} />
            <FinCard label="Received" value={fmtINR(totalReceived)} sub={totalPending > 0 ? `${Math.round((totalReceived / totalPending) * 100)}% collected` : '—'}
              gradient={gradients.green} icon={fIcon(<path d="M20 6 9 17l-5-5"/>)} />
            <FinCard label="Open Bills" value={bills.length} sub={partialCount > 0 ? `${partialCount} partial` : 'awaiting collection'}
              gradient={gradients.purple} icon={fIcon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>)} />
          </div>
          {/* Overall collection progress */}
          {totalPending > 0 && totalReceived > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E8EEF6', borderRadius: radii.md, padding: '12px 16px', marginTop: 12, boxShadow: shadow.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                <span>Collection Progress</span>
                <span style={{ color: '#059669' }}>{Math.round((totalReceived / totalPending) * 100)}%</span>
              </div>
              <div style={{ height: 9, background: '#eef2f7', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (totalReceived / totalPending) * 100)}%`, background: 'linear-gradient(90deg, #059669, #06B6D4)', borderRadius: 8, transition: 'width .4s' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>Loading…</div>
      ) : bills.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', background: '#f0fdf4',
          border: '1px solid #86efac', borderRadius: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 700, color: '#15803d', fontSize: 15 }}>All payments collected!</div>
          <div style={{ color: '#16a34a', fontSize: 13, marginTop: 4 }}>No pending bills at the moment.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bills.map((b) => {
            const age      = ageDays(b.created_at);
            const isPartial = b.payment_status === 'partial';
            const paid     = Number(b.amount_paid || 0);
            const total    = Number(b.total_amount || 0);
            const balance  = total - paid;
            const pct      = total > 0 ? Math.round((paid / total) * 100) : 0;

            const urgency = isPartial
              ? { bg: '#faf5ff', border: '#c4b5fd', badge: '#ede9fe', badgeText: '#5b21b6', label: 'Partial' }
              : age >= 14 ? { bg: '#fef2f2', border: '#fca5a5', badge: '#fee2e2', badgeText: '#991b1b', label: 'Overdue' }
              : age >= 7  ? { bg: '#fff7ed', border: '#fdba74', badge: '#ffedd5', badgeText: '#9a3412', label: 'Follow up' }
              : { bg: '#fffbeb', border: '#fcd34d', badge: '#fef3c7', badgeText: '#92400e', label: 'Pending' };

            return (
              <div key={b.id} style={{
                background: urgency.bg, border: `1.5px solid ${urgency.border}`,
                borderRadius: 12, overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{
                      background: urgency.badge, color: urgency.badgeText,
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{urgency.label}{!isPartial ? ` · ${age}d` : ''}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                      {b.client_business_name || b.client_name}
                    </span>
                    {b.client_business_name && (
                      <span style={{ fontSize: 11, color: '#64748b' }}>{b.client_name}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
                    <span>🧾 <strong>{b.bill_number}</strong></span>
                    <span>📅 {fmtDate(b.created_at)}</span>
                    {b.client_city && <span>📍 {b.client_city}</span>}
                    {b.employee_name && <span>👤 {b.employee_name}</span>}
                  </div>
                  {/* Partial payment progress */}
                  {isPartial && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: '#059669', fontWeight: 700 }}>Paid: {fmtINR(paid)}</span>
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>Balance: {fmtINR(balance)}</span>
                        <span style={{ color: '#7c3aed', fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: 'linear-gradient(90deg,#7c3aed,#8b5cf6)', borderRadius: 6,
                        }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                      {isPartial ? fmtINR(balance) : fmtINR(total)}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                      {isPartial ? 'Balance due' : 'Total amount'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={() => markCompleted(b.id)}
                      disabled={marking === b.id}
                      style={{
                        padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8,
                        border: 'none', cursor: marking === b.id ? 'not-allowed' : 'pointer',
                        background: marking === b.id ? '#d1d5db' : '#059669', color: '#fff',
                        whiteSpace: 'nowrap',
                      }}>
                      {marking === b.id ? 'Saving…' : '✅ Mark Fully Paid'}
                    </button>
                    <Link to={`/bills/${b.id}`}
                      style={{
                        padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                        border: '1px solid #cbd5e1', color: '#475569', background: '#fff',
                        textDecoration: 'none', textAlign: 'center', whiteSpace: 'nowrap',
                      }}>
                      {isPartial ? '+ Record Payment' : 'View Bill'}
                    </Link>
                  </div>
                </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
