import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  const d = s.length === 10 ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const discountColor = (pct) => {
  if (pct < 5)  return { bg: '#ecfeff', text: '#0e7490', bar: '#0891b2' };
  if (pct < 15) return { bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' };
  if (pct < 25) return { bg: '#ffedd5', text: '#9a3412', bar: '#f97316' };
  return               { bg: '#fee2e2', text: '#991b1b', bar: '#ef4444' };
};

/* ═══════════════════════════════════════════════════════════ */
export default function DiscountApprovalTab() {
  const { toast } = useToast();

  const [pending,   setPending]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [threshold, setThreshold] = useState(10);
  const [editThresh, setEditThresh] = useState(false);
  const [threshInput, setThreshInput] = useState('10');
  const [savingThresh, setSavingThresh] = useState(false);
  const [acting, setActing]   = useState(null); // quoteId being approved/rejected
  const [rejectNote, setRejectNote]   = useState('');
  const [rejectingId, setRejectingId] = useState(null); // quote id showing reject form

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        api.get('/api/quotes/pending-discount-approval'),
        api.get('/api/quotes/discount-settings'),
      ]);
      setPending(pRes.data.quotes || []);
      setThreshold(sRes.data.threshold_pct ?? 10);
      setThreshInput(String(sRes.data.threshold_pct ?? 10));
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to load', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadPending(); }, [loadPending]);

  const saveThreshold = async () => {
    const val = Number(threshInput);
    if (isNaN(val) || val < 0 || val > 100) {
      toast('Enter a value between 0 and 100', { kind: 'error' }); return;
    }
    setSavingThresh(true);
    try {
      await api.patch('/api/quotes/discount-settings', { threshold_pct: val });
      setThreshold(val);
      setEditThresh(false);
      toast(`Threshold updated to ${val}%`, { kind: 'success' });
    } catch {
      toast('Failed to save threshold', { kind: 'error' });
    } finally {
      setSavingThresh(false);
    }
  };

  const approve = async (quoteId) => {
    setActing(quoteId);
    try {
      await api.post(`/api/quotes/${quoteId}/discount-approval`, { action: 'approve' });
      toast('✅ Discount approved. Associate can now send the quote.', { kind: 'success' });
      setPending(prev => prev.filter(q => q.id !== quoteId));
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to approve', { kind: 'error' });
    } finally {
      setActing(null);
    }
  };

  const reject = async (quoteId) => {
    if (!rejectNote.trim()) { toast('Please enter a reason for rejection', { kind: 'error' }); return; }
    setActing(quoteId);
    try {
      await api.post(`/api/quotes/${quoteId}/discount-approval`, { action: 'reject', note: rejectNote });
      toast('❌ Discount rejected. Associate has been notified.', { kind: 'success' });
      setPending(prev => prev.filter(q => q.id !== quoteId));
      setRejectingId(null);
      setRejectNote('');
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to reject', { kind: 'error' });
    } finally {
      setActing(null);
    }
  };

  return (
    <div style={{ padding: '20px 0' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>💸</span>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Discount Approvals</h2>
            {pending.length > 0 && (
              <span style={{
                background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
                borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
              }}>
                {pending.length} pending
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Quotes where a discount exceeds the threshold require your approval before the associate can send them.
          </p>
        </div>

        {/* Threshold setting */}
        <div style={{
          background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12,
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Approval Threshold</div>
            {editThresh ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <input
                  type="number"
                  value={threshInput}
                  onChange={e => setThreshInput(e.target.value)}
                  min="0" max="100" step="1"
                  style={{
                    width: 60, border: '1.5px solid #0891b2', borderRadius: 8,
                    padding: '4px 8px', fontSize: 13, fontWeight: 700, color: '#0f172a',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>%</span>
                <button
                  onClick={saveThreshold}
                  disabled={savingThresh}
                  style={{
                    background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                  {savingThresh ? '…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditThresh(false); setThreshInput(String(threshold)); }}
                  style={{
                    background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8,
                    padding: '4px 8px', fontSize: 12, cursor: 'pointer',
                  }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{threshold}%</span>
                <button
                  onClick={() => setEditThresh(true)}
                  style={{
                    background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8,
                    padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>Loading…</div>
      ) : pending.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, color: '#15803d', fontSize: 15 }}>No pending approvals</div>
          <div style={{ color: '#16a34a', fontSize: 13, marginTop: 4 }}>
            All discounts are within the {threshold}% threshold or already reviewed.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pending.map((q) => {
            const dc          = discountColor(Number(q.max_discount_pct) || 0);
            const isRejecting = rejectingId === q.id;
            const isActing    = acting === q.id;

            // Per-item discount details from items JSON
            const items = Array.isArray(q.items) ? q.items : [];
            const discountedItems = items.filter(it => {
              const sys = Number(it.system_price) || 0;
              const qp  = Number(it.unit_price)   || 0;
              return sys > 0 && qp < sys;
            }).map(it => {
              const sys  = Number(it.system_price);
              const qp   = Number(it.unit_price);
              const pct  = +((( sys - qp) / sys) * 100).toFixed(1);
              return { name: it.product_name, sys, qp, pct };
            }).sort((a, b) => b.pct - a.pct);

            return (
              <div key={q.id} style={{
                background: '#fff', border: `1.5px solid ${dc.bar}44`,
                borderRadius: 14, overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 16px' }}>

                  {/* Top row: discount badge + client + quote# + amount */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    {/* Discount badge */}
                    <div style={{
                      background: dc.bg, color: dc.text, border: `1.5px solid ${dc.bar}55`,
                      borderRadius: 10, padding: '8px 14px', textAlign: 'center', flexShrink: 0,
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace' }}>
                        -{Number(q.max_discount_pct).toFixed(0)}%
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        max disc
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                          {q.client_business_name || q.client_name}
                        </span>
                        {q.client_business_name && (
                          <span style={{ fontSize: 11, color: '#64748b' }}>{q.client_name}</span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'monospace', color: '#94a3b8' }}>
                          {q.quote_number}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
                        <span>👤 {q.employee_name}</span>
                        {q.client_city && <span>📍 {q.client_city}</span>}
                        <span>📅 {fmtDate(q.created_at)}</span>
                        <span>🏷 {q.client_type}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{fmtINR(q.total_amount)}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>quote total</div>
                    </div>
                  </div>

                  {/* Discounted items list */}
                  {discountedItems.length > 0 && (
                    <div style={{
                      marginTop: 12, background: '#f8fafc', borderRadius: 10,
                      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                        Discounted Items
                      </div>
                      {discountedItems.map((it, i) => {
                        const c2 = discountColor(it.pct);
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                            <div style={{ flex: 1, color: '#0f172a', fontWeight: 600, truncate: true }}>{it.name}</div>
                            <div style={{ color: '#94a3b8', textDecoration: 'line-through', fontFamily: 'monospace' }}>
                              {fmtINR(it.sys)}
                            </div>
                            <div style={{ color: '#0f172a', fontWeight: 700, fontFamily: 'monospace' }}>
                              {fmtINR(it.qp)}
                            </div>
                            <span style={{
                              background: c2.bg, color: c2.text,
                              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                              fontFamily: 'monospace',
                            }}>
                              -{it.pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reject reason input */}
                  {isRejecting && (
                    <div style={{ marginTop: 10 }}>
                      <textarea
                        value={rejectNote}
                        onChange={e => setRejectNote(e.target.value)}
                        placeholder="Reason for rejection (required — associate will see this)…"
                        rows={2}
                        style={{
                          width: '100%', border: '1.5px solid #fca5a5', borderRadius: 10,
                          padding: '8px 12px', fontSize: 13, outline: 'none',
                          background: '#fef2f2', color: '#0f172a', resize: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      onClick={() => approve(q.id)}
                      disabled={isActing || isRejecting}
                      style={{
                        padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 10,
                        border: 'none', cursor: isActing ? 'not-allowed' : 'pointer',
                        background: isActing ? '#d1d5db' : '#059669', color: '#fff',
                        opacity: isRejecting ? 0.5 : 1,
                      }}>
                      {isActing && !isRejecting ? '…' : '✅ Approve'}
                    </button>

                    {isRejecting ? (
                      <>
                        <button
                          onClick={() => reject(q.id)}
                          disabled={isActing}
                          style={{
                            padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 10,
                            border: 'none', cursor: isActing ? 'not-allowed' : 'pointer',
                            background: '#dc2626', color: '#fff',
                          }}>
                          {isActing ? '…' : 'Confirm Reject'}
                        </button>
                        <button
                          onClick={() => { setRejectingId(null); setRejectNote(''); }}
                          style={{
                            padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 10,
                            border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer',
                          }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setRejectingId(q.id)}
                        disabled={isActing}
                        style={{
                          padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 10,
                          border: '1.5px solid #fca5a5', background: '#fff', color: '#dc2626',
                          cursor: 'pointer',
                        }}>
                        ❌ Reject
                      </button>
                    )}

                    <Link
                      to={`/quotes/${q.id}`}
                      style={{
                        padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 10,
                        border: '1px solid #e2e8f0', color: '#475569', background: '#fff',
                        textDecoration: 'none',
                      }}>
                      View Quote →
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
