import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../components/Toast';

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  const d = s.length === 10 ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TYPE_COLOR = {
  hotel:      { bg: '#eff6ff', text: '#1d4ed8' },
  hospital:   { bg: '#fdf4ff', text: '#7e22ce' },
  restaurant: { bg: '#fff7ed', text: '#c2410c' },
  office:     { bg: '#f0fdf4', text: '#15803d' },
  school:     { bg: '#fefce8', text: '#a16207' },
  retail:     { bg: '#fff1f2', text: '#be123c' },
  other:      { bg: '#f8fafc', text: '#475569' },
};
const typeColor = (t) => TYPE_COLOR[t] || TYPE_COLOR.other;

const QUOTE_STATUS_PILL = {
  draft:    'bg-slate-100 text-slate-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const BILL_PAY_PILL = {
  pending:   { bg: '#fef3c7', text: '#92400e' },
  partial:   { bg: '#ede9fe', text: '#5b21b6' },
  completed: { bg: '#d1fae5', text: '#065f46' },
};

/* ─── Sub-components ─────────────────────────────────────── */
const StatCard = ({ value, label, color = '#1d4ed8', bg = '#eff6ff' }) => (
  <div className="rounded-xl px-4 py-3 text-center" style={{ background: bg }}>
    <div className="text-lg font-bold" style={{ color }}>{value}</div>
    <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color }}>{label}</div>
  </div>
);

/* ═══════════════════════════════════════════════════════════ */
export default function ClientProfile() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const { toast }   = useToast();

  const [client, setClient]   = useState(null);
  const [history, setHistory] = useState({ quotes: [], bills: [], top_products: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('quotes'); // quotes | bills | products
  const [notes, setNotes]     = useState('');
  const [editNotes, setEditNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [repeating, setRepeating] = useState(null); // quote id being repeated
  const [error, setError]     = useState('');

  const onRepeatOrder = async (quoteId) => {
    setRepeating(quoteId);
    try {
      const { data } = await api.post(`/api/quotes/${quoteId}/repeat`);
      toast('🔁 Repeat order created!', { kind: 'success' });
      navigate(`/quotes/${data.quote.id}`);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to repeat order', { kind: 'error' });
    } finally {
      setRepeating(null);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, hRes] = await Promise.all([
        api.get(`/api/clients/${id}`),
        api.get(`/api/clients/${id}/history`),
      ]);
      setClient(cRes.data.client);
      setNotes(cRes.data.client.notes || '');
      setHistory(hRes.data);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.patch(`/api/clients/${id}`, { notes });
      setClient((c) => ({ ...c, notes }));
      setEditNotes(false);
      toast('Notes saved.', { kind: 'success' });
    } catch {
      toast('Failed to save notes.', { kind: 'error' });
    } finally {
      setSavingNotes(false);
    }
  };

  /* ── Derived stats ── */
  // For completed bills, treat full total_amount as paid (amount_paid may be 0 if toggled without recording)
  const totalBilled = history.bills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const totalPaid   = history.bills.reduce((s, b) =>
    s + (b.payment_status === 'completed' ? Number(b.total_amount || 0) : Number(b.amount_paid || 0)), 0);
  const balance     = totalBilled - totalPaid;
  const paidBills   = history.bills.filter((b) => b.payment_status === 'completed').length;
  const partialBills= history.bills.filter((b) => b.payment_status === 'partial').length;
  const pendingBills= history.bills.filter((b) => b.payment_status === 'pending').length;

  const tc = client ? typeColor(client.client_type) : TYPE_COLOR.other;

  /* ── Loading / error ── */
  if (loading) return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-48 mb-3" />
        <div className="h-4 bg-slate-100 rounded w-32" />
      </div>
      {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 h-20 animate-pulse" />)}
    </div>
  );

  if (error) return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
      <div className="text-2xl mb-2">⚠️</div>
      <div className="font-bold text-rose-700">{error}</div>
      <button onClick={() => navigate('/clients')} className="mt-4 text-sm text-slate-600 underline">
        ← Back to Clients
      </button>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Back + header ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <Link to="/clients" className="text-xs text-slate-500 hover:text-cyan-600 mb-3 inline-flex items-center gap-1">
          ← Client Directory
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-bold"
                 style={{ background: tc.bg, color: tc.text }}>
              {(client.business_name || client.contact_name || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 truncate">
                {client.business_name || client.contact_name}
              </h2>
              {client.business_name && (
                <div className="text-sm text-slate-500 truncate">{client.contact_name}</div>
              )}
              <div className="flex flex-wrap gap-2 mt-1.5">
                {client.client_type && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: tc.bg, color: tc.text }}>
                    {client.client_type}
                  </span>
                )}
                {client.city && <span className="text-xs text-slate-500">📍 {client.city}</span>}
                {client.phone && <span className="text-xs text-slate-500">📞 {client.phone}</span>}
                {client.email && <span className="text-xs text-slate-500">✉️ {client.email}</span>}
                {client.gstin && <span className="text-xs text-slate-500 font-mono">GST: {client.gstin}</span>}
              </div>
            </div>
          </div>

          {/* Key metric: balance */}
          {balance > 0 && (
            <div className="rounded-xl px-4 py-3 text-center flex-shrink-0" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
              <div className="text-lg font-bold text-rose-700">{fmtINR(balance)}</div>
              <div className="text-[10px] font-semibold uppercase text-rose-500">Balance Due</div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <StatCard value={history.quotes.length}    label="Total Quotes"  color="#1d4ed8"  bg="#eff6ff" />
          <StatCard value={history.bills.length}     label="Total Bills"   color="#7e22ce"  bg="#fdf4ff" />
          <StatCard value={fmtINR(totalBilled)}      label="Total Billed"  color="#15803d"  bg="#f0fdf4" />
          <StatCard value={fmtINR(totalPaid)}        label="Total Paid"    color="#0369a1"  bg="#f0f9ff" />
        </div>

        {/* Payment breakdown */}
        {history.bills.length > 0 && (
          <div className="flex gap-3 mt-3 flex-wrap">
            {paidBills   > 0 && <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: '#d1fae5', color: '#065f46' }}>✓ {paidBills} paid</span>}
            {partialBills> 0 && <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: '#ede9fe', color: '#5b21b6' }}>◑ {partialBills} partial</span>}
            {pendingBills> 0 && <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>⏳ {pendingBills} pending</span>}
            {totalBilled > 0 && (
              <div className="flex-1 min-w-[120px] flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div style={{ width: `${Math.min(100, (totalPaid / totalBilled) * 100)}%`, background: 'linear-gradient(90deg,#059669,#10b981)', height: '100%', borderRadius: 8 }} />
                </div>
                <span className="text-xs text-slate-500 font-medium">{Math.round((totalPaid / totalBilled) * 100)}% collected</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Notes card ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            📝 Client Notes
          </div>
          {!editNotes && (
            <button
              onClick={() => setEditNotes(true)}
              className="text-xs text-cyan-600 hover:text-cyan-800 font-medium"
            >
              {notes ? 'Edit' : '+ Add Note'}
            </button>
          )}
        </div>
        {editNotes ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes about this client (payment preferences, special terms, etc.)…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              style={{ background: '#f0f9ff' }}
            />
            <div className="flex gap-2">
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: '#0891b2' }}
              >
                {savingNotes ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setNotes(client.notes || ''); setEditNotes(false); }}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : notes ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{notes}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">No notes yet. Click "+ Add Note" to record client preferences, terms, or follow-up info.</p>
        )}
      </div>

      {/* ── Top products ── */}
      {history.top_products.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="font-semibold text-slate-700 text-sm mb-3">🏆 Top Products Ordered</div>
          <div className="space-y-2">
            {history.top_products.map((p, i) => {
              const maxRev = history.top_products[0].total_revenue;
              return (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{p.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div style={{
                          width: `${(p.total_revenue / maxRev) * 100}%`,
                          background: 'linear-gradient(90deg,#0891b2,#06b6d4)',
                          height: '100%', borderRadius: 4,
                        }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-slate-700">{fmtINR(p.total_revenue)}</div>
                    <div className="text-[10px] text-slate-400">{p.total_qty} units · {p.order_count} orders</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200">
          {[
            { id: 'quotes',   label: `🧾 Quotes (${history.quotes.length})` },
            { id: 'bills',    label: `🏷 Bills (${history.bills.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 px-4 py-3 text-sm font-semibold transition-colors"
              style={{
                color: tab === t.id ? '#0891b2' : '#64748b',
                borderBottom: tab === t.id ? '2px solid #0891b2' : '2px solid transparent',
                background: tab === t.id ? '#f0f9ff' : 'transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Quotes tab */}
        {tab === 'quotes' && (
          <div className="divide-y divide-slate-100">
            {history.quotes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No quotes yet.</div>
            ) : history.quotes.map((q) => (
              <div key={q.id} className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50 transition-colors">
                <Link
                  to={`/quotes/${q.id}`}
                  style={{ textDecoration: 'none' }}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 font-mono">{q.quote_number}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${QUOTE_STATUS_PILL[q.status] || 'bg-slate-100 text-slate-600'}`}>
                        {q.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex gap-3 flex-wrap">
                      <span>📅 {fmtDate(q.created_at)}</span>
                      {q.employee_name && <span>👤 {q.employee_name}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-1">
                    <div className="text-sm font-bold text-slate-800">{fmtINR(q.total_amount)}</div>
                    <div className="text-[10px] text-slate-400">total</div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => onRepeatOrder(q.id)}
                  disabled={repeating === q.id}
                  className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', whiteSpace: 'nowrap' }}
                >
                  {repeating === q.id ? '…' : '🔁 Repeat'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bills tab */}
        {tab === 'bills' && (
          <div className="divide-y divide-slate-100">
            {history.bills.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No bills yet.</div>
            ) : history.bills.map((b) => {
              const payStyle = BILL_PAY_PILL[b.payment_status] || BILL_PAY_PILL.pending;
              const total = Number(b.total_amount || 0);
              // completed bills are fully paid even if amount_paid wasn't updated via recording
              const paid  = b.payment_status === 'completed' ? total : Number(b.amount_paid || 0);
              const bal   = total - paid;

              return (
                <Link
                  key={b.id}
                  to={`/bills/${b.id}`}
                  style={{ textDecoration: 'none' }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 font-mono">{b.bill_number}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                            style={{ background: payStyle.bg, color: payStyle.text }}>
                        {b.payment_status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex gap-3 flex-wrap">
                      <span>📅 {fmtDate(b.created_at)}</span>
                      {b.employee_name && <span>👤 {b.employee_name}</span>}
                    </div>
                    {b.payment_status === 'partial' && total > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div style={{ width: `${(paid / total) * 100}%`, background: '#8b5cf6', height: '100%', borderRadius: 4 }} />
                        </div>
                        <span className="text-[10px] text-rose-600 font-semibold">₹{new Intl.NumberFormat('en-IN').format(Math.round(bal))} due</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-slate-800">{fmtINR(total)}</div>
                    {paid > 0 && b.payment_status !== 'completed' && (
                      <div className="text-[10px] text-emerald-600">{fmtINR(paid)} paid</div>
                    )}
                    {b.payment_status === 'completed' && (
                      <div className="text-[10px] text-emerald-600">fully paid</div>
                    )}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="text-center text-xs text-slate-400 pb-4">
        Client since {fmtDate(client.created_at)}
      </div>
    </div>
  );
}
