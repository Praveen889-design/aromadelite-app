import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const daysOverdue = (iso) => {
  if (!iso) return 0;
  const due   = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((today - due) / 86400000);
};

const STATUS_COLOR = {
  new:        { bg: '#f0f9ff', text: '#0369a1' },
  contacted:  { bg: '#fffbeb', text: '#92400e' },
  qualified:  { bg: '#f0fdf4', text: '#15803d' },
  negotiating:{ bg: '#fef3c7', text: '#92400e' },
};

export default function FollowUpsTab() {
  const { toast } = useToast();
  const [leads, setLeads]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setAction]  = useState({});
  const [rescheduling, setResch]    = useState({});
  const [filter, setFilter]         = useState('all'); // 'all' | 'overdue' | 'today'

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/leads/followups/due');
      setLeads(data.leads || []);
    } catch {
      toast('Failed to load follow-ups', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markDone = async (leadId) => {
    setAction((p) => ({ ...p, [leadId]: true }));
    try {
      await api.patch(`/api/leads/${leadId}`, { follow_up_date: null, follow_up_note: null });
      toast('✅ Follow-up marked done', { kind: 'success' });
      setLeads((p) => p.filter((l) => l.id !== leadId));
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed', { kind: 'error' });
    } finally {
      setAction((p) => ({ ...p, [leadId]: false }));
    }
  };

  const saveReschedule = async (leadId) => {
    const newDate = rescheduling[leadId];
    if (!newDate) return;
    setAction((p) => ({ ...p, [leadId]: true }));
    try {
      await api.patch(`/api/leads/${leadId}`, { follow_up_date: newDate });
      toast('📅 Follow-up rescheduled', { kind: 'success' });
      setLeads((p) => p.filter((l) => l.id !== leadId));
      setResch((p) => { const n = { ...p }; delete n[leadId]; return n; });
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed', { kind: 'error' });
    } finally {
      setAction((p) => ({ ...p, [leadId]: false }));
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  const filtered = leads.filter((l) => {
    const overdue = daysOverdue(l.follow_up_date);
    if (filter === 'overdue') return overdue > 0;
    if (filter === 'today')   return overdue === 0;
    return true;
  });

  const overdueCount = leads.filter((l) => daysOverdue(l.follow_up_date) > 0).length;
  const todayCount   = leads.filter((l) => daysOverdue(l.follow_up_date) === 0).length;

  return (
    <div style={{ padding: '20px 0' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>🔔</span>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Follow-up Reminders</h2>
          {leads.length > 0 && (
            <span style={{
              background: '#e0e7ff', color: '#3730a3', border: '1px solid #a5b4fc',
              borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
            }}>
              {leads.length} due
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          All leads with follow-up dates due today or overdue. Mark done or reschedule.
        </p>
      </div>

      {/* Summary + filter chips */}
      {leads.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { key: 'all',     label: `All (${leads.length})`,      bg: filter === 'all'     ? '#6366f1' : '#f1f5f9', text: filter === 'all'     ? '#fff' : '#475569' },
            { key: 'overdue', label: `Overdue (${overdueCount})`,  bg: filter === 'overdue' ? '#ef4444' : '#fef2f2', text: filter === 'overdue' ? '#fff' : '#991b1b' },
            { key: 'today',   label: `Due today (${todayCount})`,  bg: filter === 'today'   ? '#059669' : '#f0fdf4', text: filter === 'today'   ? '#fff' : '#15803d' },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 12, background: f.bg, color: f.text, transition: 'all .15s',
            }}>{f.label}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', background: '#f0fdf4',
          border: '1px solid #86efac', borderRadius: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 700, color: '#15803d', fontSize: 15 }}>All caught up!</div>
          <div style={{ color: '#16a34a', fontSize: 13, marginTop: 4 }}>No follow-ups due in this filter.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((l) => {
            const overdue     = daysOverdue(l.follow_up_date);
            const isToday     = overdue === 0;
            const isRescheduling = rescheduling[l.id] !== undefined;
            const busy        = actionLoading[l.id];
            const sc          = STATUS_COLOR[l.status] || { bg: '#f8fafc', text: '#475569' };
            const urgencyBg   = overdue > 7 ? '#fef2f2' : overdue > 0 ? '#fff7ed' : '#eef2ff';
            const urgencyBorder = overdue > 7 ? '#fca5a5' : overdue > 0 ? '#fdba74' : '#a5b4fc';

            return (
              <div key={l.id} style={{
                background: urgencyBg, border: `1.5px solid ${urgencyBorder}`,
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      {/* Urgency badge */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        background: overdue > 7 ? '#fee2e2' : overdue > 0 ? '#ffedd5' : '#dcfce7',
                        color:      overdue > 7 ? '#991b1b' : overdue > 0 ? '#9a3412' : '#15803d',
                      }}>
                        {isToday ? 'Due today' : `${overdue}d overdue`}
                      </span>
                      {/* Status */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        background: sc.bg, color: sc.text,
                      }}>{l.status}</span>
                      {/* Client */}
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                        {l.client_business_name || l.client_name}
                      </span>
                      {l.client_business_name && (
                        <span style={{ fontSize: 11, color: '#64748b' }}>{l.client_name}</span>
                      )}
                    </div>

                    {/* Follow-up note */}
                    {l.follow_up_note && (
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: '#4338ca',
                        background: '#eef2ff', borderRadius: 6, padding: '4px 10px',
                        marginBottom: 6, display: 'inline-block',
                      }}>
                        📌 {l.follow_up_note}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
                      <span>📅 Scheduled: <strong>{fmtDate(l.follow_up_date)}</strong></span>
                      {l.client_city && <span>📍 {l.client_city}</span>}
                      {l.employee_name && <span>👤 {l.employee_name}</span>}
                      {l.quote_number && (
                        <Link to={`/quotes/${l.quote_id}`} style={{ color: '#6366f1', fontWeight: 600 }}>
                          🧾 {l.quote_number}
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                    {isRescheduling ? (
                      <>
                        <input
                          type="date"
                          min={today}
                          value={rescheduling[l.id] || ''}
                          onChange={(e) => setResch((p) => ({ ...p, [l.id]: e.target.value }))}
                          style={{
                            border: '1px solid #a5b4fc', borderRadius: 8,
                            padding: '7px 10px', fontSize: 12, outline: 'none',
                          }}
                        />
                        <button
                          disabled={!rescheduling[l.id] || busy}
                          onClick={() => saveReschedule(l.id)}
                          style={{
                            padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8,
                            border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                            background: busy ? '#d1d5db' : '#6366f1', color: '#fff',
                          }}>
                          {busy ? '…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setResch((p) => { const n = { ...p }; delete n[l.id]; return n; })}
                          style={{
                            padding: '8px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                            border: '1px solid #cbd5e1', color: '#475569', background: '#fff', cursor: 'pointer',
                          }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => markDone(l.id)}
                          style={{
                            padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8,
                            border: '1px solid #86efac', cursor: busy ? 'not-allowed' : 'pointer',
                            background: busy ? '#d1d5db' : '#dcfce7', color: '#15803d',
                          }}>
                          {busy ? '…' : '✓ Done'}
                        </button>
                        <button
                          onClick={() => setResch((p) => ({ ...p, [l.id]: '' }))}
                          style={{
                            padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8,
                            border: '1px solid #c7d2fe', cursor: 'pointer',
                            background: '#eef2ff', color: '#4338ca',
                          }}>
                          📅 Reschedule
                        </button>
                      </>
                    )}
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
