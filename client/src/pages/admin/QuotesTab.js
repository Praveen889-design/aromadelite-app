import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { ClientTypeBadge } from '../../components/leads/badges';
import { downloadCSV } from '../../utils/csv';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const STATUS_BG = {
  draft:    'bg-slate-100 text-slate-700',
  sent:     'bg-cyan-100 text-cyan-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-700',
};

export default function QuotesTab({ initialFilters }) {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '', client_type: '', employee_code: initialFilters?.employee_code || '', from: '', to: '', q: '',
    modification_pending: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/quotes');
      setQuotes(data.quotes || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    return quotes.filter((q) => {
      if (filters.modification_pending && q.modification_status !== 'pending_approval') return false;
      if (filters.status && q.status !== filters.status) return false;
      if (filters.client_type && q.client_type !== filters.client_type) return false;
      if (filters.employee_code && q.employee_code !== filters.employee_code) return false;
      if (filters.from && q.created_at.slice(0,10) < filters.from) return false;
      if (filters.to && q.created_at.slice(0,10) > filters.to) return false;
      if (filters.q) {
        const needle = filters.q.toLowerCase();
        const hay = `${q.quote_number} ${q.client_name} ${q.client_business_name || ''} ${q.client_phone || ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [quotes, filters]);

  const updateStatus = async (q, status) => {
    try {
      const { data } = await api.patch(`/api/quotes/${q.id}/status`, { status });
      setQuotes((arr) => arr.map((x) => (x.id === q.id ? { ...x, ...data.quote } : x)));
      toast(`${q.quote_number} marked ${status}.`, { kind: 'success' });
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update', { kind: 'error' });
    }
  };

  const exportCSV = () => {
    downloadCSV(visible, [
      { header: 'Quote',             key: 'quote_number' },
      { header: 'Date',              get: (r) => r.created_at?.slice(0, 10) },
      { header: 'Associate',         get: (r) => `${r.employee_code} ${r.employee_name}` },
      { header: 'Region',            key: 'region' },
      { header: 'Client',            key: 'client_name' },
      { header: 'Business',          key: 'client_business_name' },
      { header: 'Type',              key: 'client_type' },
      { header: 'Requirement',       key: 'requirement_type' },
      { header: 'City',              key: 'client_city' },
      { header: 'Phone',             key: 'client_phone' },
      { header: 'Subtotal',          key: 'subtotal' },
      { header: 'GST',               key: 'gst_amount' },
      { header: 'Total',             key: 'total_amount' },
      { header: 'Status',            key: 'status' },
      { header: 'Next Follow-up',    key: 'next_follow_up_date' },
      { header: 'Expected Order',    key: 'expected_order_date' },
    ], `Aromadelite_Quotes_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const uniqueAssociates = useMemo(() => {
    const s = new Map();
    for (const q of quotes) s.set(q.employee_code, q.employee_name);
    return [...s.entries()];
  }, [quotes]);

  const pendingModCount = useMemo(
    () => quotes.filter((q) => q.modification_status === 'pending_approval').length,
    [quotes]
  );

  return (
    <div className="space-y-3">

      {/* 🔔 Pending modification approval banner */}
      {pendingModCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
          border: '2px solid #fb923c', borderRadius: 12,
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: '#ea580c', color: '#fff', fontWeight: 900, fontSize: 14,
              borderRadius: '50%', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {pendingModCount}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#9a3412' }}>
                🔔 Quote Modification{pendingModCount > 1 ? 's' : ''} Awaiting Approval
              </div>
              <div style={{ fontSize: 12, color: '#7c2d12' }}>
                Associate{pendingModCount > 1 ? 's have' : ' has'} submitted updated pricing for your review.
              </div>
            </div>
          </div>
          <button
            onClick={() => setFilters((f) => ({ ...f, modification_pending: true }))}
            style={{
              background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Review Now →
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filters.client_type} onChange={(e) => setFilters((f) => ({ ...f, client_type: e.target.value }))}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
          <option value="">All business types</option>
          {['Hospital','FMC','Apartment','Restaurant','School','Contractor','Other'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={filters.employee_code} onChange={(e) => setFilters((f) => ({ ...f, employee_code: e.target.value }))}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
          <option value="">All associates</option>
          {uniqueAssociates.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
               className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
               className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
        <input type="search" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
               placeholder="Search…"
               className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm text-slate-600">{visible.length} of {quotes.length} quotes</div>
          {filters.modification_pending && (
            <button
              onClick={() => setFilters((f) => ({ ...f, modification_pending: false }))}
              className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5 font-semibold"
            >
              🔔 Pending Approval × Clear
            </button>
          )}
        </div>
        <button onClick={exportCSV}
                className="text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2">
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? <div className="p-6 text-sm text-slate-500">Loading…</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Quote</th>
                <th className="text-left px-3 py-2">Client</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Associate</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Created</th>
                <th className="text-left px-3 py-2">Follow-up</th>
                <th className="text-left px-3 py-2">Exp. Order</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((q) => (
                <tr key={q.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    <Link to={`/quotes/${q.id}`} className="text-cyan-700 hover:underline">{q.quote_number}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{q.client_business_name || q.client_name}</div>
                    <div className="text-[11px] text-slate-500">{q.client_name} · {q.client_city || '—'}</div>
                  </td>
                  <td className="px-3 py-2"><ClientTypeBadge type={q.client_type} /></td>
                  <td className="px-3 py-2 text-xs">
                    <div>{q.employee_name}</div>
                    <div className="text-slate-500">{q.employee_code}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatINR(q.total_amount)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <select value={q.status} onChange={(e) => updateStatus(q, e.target.value)}
                              className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-cyan-600 ${STATUS_BG[q.status]}`}>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      {q.modification_status === 'pending_approval' && (
                        <span className="text-[10px] font-bold bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 whitespace-nowrap">
                          🔔 Mod. Pending
                        </span>
                      )}
                      {q.modification_status === 'approved' && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 whitespace-nowrap">
                          ✅ Mod. Approved
                        </span>
                      )}
                      {q.modification_status === 'rejected' && (
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-700 rounded-full px-2 py-0.5 whitespace-nowrap">
                          ❌ Mod. Rejected
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{q.created_at?.slice(0,10)}</td>
                  <td className="px-3 py-2 text-xs">
                    {q.next_follow_up_date ? (
                      <span className={[
                        'inline-block px-1.5 py-0.5 rounded font-medium',
                        q.next_follow_up_date < new Date().toISOString().slice(0,10)
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-cyan-50 text-cyan-700',
                      ].join(' ')}>
                        {q.next_follow_up_date}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {q.expected_order_date
                      ? <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">{q.expected_order_date}</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/quotes/${q.id}`} className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
