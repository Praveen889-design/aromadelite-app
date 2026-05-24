import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

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

  const totalPending = bills.reduce((s, b) => s + Number(b.total_amount || 0), 0);

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

      {/* Summary banner */}
      {bills.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1.5px solid #fcd34d', borderRadius: 12, padding: '14px 18px',
          marginBottom: 20, display: 'flex', gap: 32, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Pending</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#78350f' }}>{fmtINR(totalPending)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bills Count</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#78350f' }}>{bills.length}</div>
          </div>
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
            const age = ageDays(b.created_at);
            const urgency = age >= 14 ? { bg: '#fef2f2', border: '#fca5a5', badge: '#fee2e2', badgeText: '#991b1b', label: 'Overdue' }
              : age >= 7  ? { bg: '#fff7ed', border: '#fdba74', badge: '#ffedd5', badgeText: '#9a3412', label: 'Follow up' }
              : { bg: '#fffbeb', border: '#fcd34d', badge: '#fef3c7', badgeText: '#92400e', label: 'Pending' };

            return (
              <div key={b.id} style={{
                background: urgency.bg, border: `1.5px solid ${urgency.border}`,
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
              }}>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{
                      background: urgency.badge, color: urgency.badgeText,
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{urgency.label} · {age}d</span>
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
                </div>

                {/* Amount + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{fmtINR(b.total_amount)}</div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>Total amount</div>
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
                      {marking === b.id ? 'Saving…' : '✅ Mark Received'}
                    </button>
                    <Link to={`/bills/${b.id}`}
                      style={{
                        padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                        border: '1px solid #cbd5e1', color: '#475569', background: '#fff',
                        textDecoration: 'none', textAlign: 'center', whiteSpace: 'nowrap',
                      }}>
                      View Bill
                    </Link>
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
