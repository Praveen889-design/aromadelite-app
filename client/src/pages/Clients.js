import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { SkeletonCards } from '../components/Skeleton';

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const TYPE_COLOR = {
  hotel:        { bg: '#eff6ff', text: '#1d4ed8' },
  hospital:     { bg: '#fdf4ff', text: '#7e22ce' },
  restaurant:   { bg: '#fff7ed', text: '#c2410c' },
  office:       { bg: '#f0fdf4', text: '#15803d' },
  school:       { bg: '#fefce8', text: '#a16207' },
  retail:       { bg: '#fff1f2', text: '#be123c' },
  other:        { bg: '#f8fafc', text: '#475569' },
};

const typeColor = (t) => TYPE_COLOR[t] || TYPE_COLOR.other;

const PayBehavior = ({ paid, partial, pending }) => {
  const total = paid + partial + pending;
  if (!total) return <span style={{ color: '#94a3b8', fontSize: 11 }}>No bills</span>;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {paid    > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#d1fae5', color: '#065f46' }}>✓ {paid} paid</span>}
      {partial > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#ede9fe', color: '#5b21b6' }}>◑ {partial} partial</span>}
      {pending > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>⏳ {pending} pending</span>}
    </div>
  );
};

export default function Clients() {
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [debouncedQ, setDQ]     = useState('');
  const [sortBy, setSortBy]     = useState('last_quote_at'); // last_quote_at | total_billed | quote_count
  const [error, setError]       = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (debouncedQ) params.q = debouncedQ;
      const { data } = await api.get('/api/clients', { params });
      setClients(data.clients || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [debouncedQ]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const sorted = [...clients].sort((a, b) => {
    if (sortBy === 'total_billed')  return Number(b.total_billed)  - Number(a.total_billed);
    if (sortBy === 'quote_count')   return Number(b.quote_count)   - Number(a.quote_count);
    return new Date(b.last_quote_at) - new Date(a.last_quote_at);
  });

  const totalRevenue = clients.reduce((s, c) => s + Number(c.total_billed || 0), 0);
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => {
    const last = new Date(c.last_quote_at);
    const days = (Date.now() - last.getTime()) / 86400000;
    return days <= 90;
  }).length;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Client Directory</h2>
            <p className="text-sm text-slate-500 mt-0.5">All clients with their complete order and payment history</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-center px-4 py-2 rounded-lg" style={{ background: '#eff6ff' }}>
              <div className="text-lg font-bold text-blue-700">{totalClients}</div>
              <div className="text-[10px] font-semibold uppercase text-blue-500">Total</div>
            </div>
            <div className="text-center px-4 py-2 rounded-lg" style={{ background: '#f0fdf4' }}>
              <div className="text-lg font-bold text-emerald-700">{activeClients}</div>
              <div className="text-[10px] font-semibold uppercase text-emerald-500">Active (90d)</div>
            </div>
            <div className="text-center px-4 py-2 rounded-lg" style={{ background: '#faf5ff' }}>
              <div className="text-lg font-bold text-purple-700">{fmtINR(totalRevenue)}</div>
              <div className="text-[10px] font-semibold uppercase text-purple-500">Total Billed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search + sort bar */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, business, phone…"
          className="flex-1 min-w-[200px] border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white text-slate-700 font-medium"
        >
          <option value="last_quote_at">Sort: Recent</option>
          <option value="total_billed">Sort: Revenue</option>
          <option value="quote_count">Sort: Orders</option>
        </select>
      </div>

      {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-4 text-sm">{error}</div>}

      {loading ? (
        <SkeletonCards count={6} height={110} />
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-4xl mb-3">🏢</div>
          <div className="font-bold text-slate-700">No clients found</div>
          <div className="text-sm text-slate-500 mt-1">
            {search ? 'Try a different search term.' : 'Clients appear once you create quotes.'}
          </div>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {sorted.map((c, i) => {
            const tc = typeColor(c.client_type);
            const hasNotes = !!c.client_notes;
            const paid    = Number(c.paid_bills    || 0);
            const partial = Number(c.partial_bills || 0);
            const pending = Number(c.pending_bills || 0);
            const balance = Number(c.total_billed || 0) - Number(c.total_paid || 0);
            const lastDays = Math.floor((Date.now() - new Date(c.last_quote_at).getTime()) / 86400000);

            return (
              <Link
                key={i}
                to={c.client_id ? `/clients/${c.client_id}` : '#'}
                onClick={async (e) => {
                  if (!c.client_id) {
                    e.preventDefault();
                    // Auto-create client record then navigate
                    try {
                      const { data } = await api.post('/api/clients/upsert', {
                        client_name: c.contact_name,
                        client_business_name: c.business_name,
                        client_phone: c.phone,
                        client_email: c.email,
                        client_city: c.city,
                        client_type: c.client_type,
                      });
                      window.location.href = `/clients/${data.client.id}`;
                    } catch { /* silent */ }
                  }
                }}
                style={{ textDecoration: 'none' }}
              >
                <div className="bg-white rounded-xl border border-slate-200 hover:border-cyan-300 hover:shadow-md transition-all p-4 h-full cursor-pointer">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">
                        {c.business_name || c.contact_name}
                      </div>
                      {c.business_name && (
                        <div className="text-xs text-slate-500 truncate">{c.contact_name}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {c.client_type && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                                style={{ background: tc.bg, color: tc.text }}>
                            {c.client_type}
                          </span>
                        )}
                        {c.city && (
                          <span className="text-[10px] text-slate-500">📍 {c.city}</span>
                        )}
                        {c.phone && (
                          <span className="text-[10px] text-slate-500">📞 {c.phone}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-bold text-slate-900">{fmtINR(c.total_billed)}</div>
                      <div className="text-[10px] text-slate-400">billed</div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-4 text-xs text-slate-600 mb-2">
                    <span>🧾 <strong>{c.quote_count}</strong> quotes</span>
                    <span>🏷 <strong>{c.bill_count}</strong> bills</span>
                    <span className={`font-medium ${lastDays <= 30 ? 'text-emerald-600' : lastDays <= 90 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {lastDays === 0 ? 'Today' : lastDays === 1 ? 'Yesterday' : `${lastDays}d ago`}
                    </span>
                  </div>

                  {/* Payment behavior */}
                  <div className="flex items-center justify-between gap-2">
                    <PayBehavior paid={paid} partial={partial} pending={pending} />
                    {balance > 0 && (
                      <span className="text-[10px] font-bold text-rose-600 flex-shrink-0">
                        ₹{new Intl.NumberFormat('en-IN').format(Math.round(balance))} due
                      </span>
                    )}
                  </div>

                  {/* Notes indicator */}
                  {hasNotes && (
                    <div className="mt-2 text-[10px] text-indigo-600 font-medium">
                      📝 Has notes
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
