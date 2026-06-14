import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import LeadDetailModal from '../components/leads/LeadDetailModal';
import {
  CLIENT_TYPE_LABEL, STATUS_LABEL,
  ClientTypeBadge, StatusBadge,
} from '../components/leads/badges';
import { SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { colors, gradients, radii, shadow } from '../theme/tokens';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(String(iso).length === 10 ? String(iso) + 'T00:00:00' : String(iso));
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isOverdue = (iso) => {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso) < today;
};

export default function Leads() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [filters, setFilters] = useState({
    status: '', client_type: '', from: '', to: '', q: '',
  });
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState({ new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0, total: 0, conversion_rate: 0 });
  const [loading, setLoading] = useState(true);
  const [groupByAssociate, setGroupByAssociate] = useState(false);
  const [openLeadId, setOpenLeadId] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status)      params.status = filters.status;
      if (filters.client_type) params.client_type = filters.client_type;
      if (filters.from)        params.from = filters.from;
      if (filters.to)          params.to = filters.to;

      const [lRes, sRes] = await Promise.all([
        api.get('/api/leads', { params }),
        api.get('/api/leads/summary'),
      ]);
      setLeads(lRes.data.leads || []);
      setSummary(sRes.data.summary || {});
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.client_type, filters.from, filters.to]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Client-side filter on free-text search
  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      (l.client_name || '').toLowerCase().includes(q) ||
      (l.client_business_name || '').toLowerCase().includes(q) ||
      (l.client_phone || '').toLowerCase().includes(q)
    );
  }, [leads, filters.q]);

  const grouped = useMemo(() => {
    if (!groupByAssociate) return null;
    const map = new Map();
    for (const l of visible) {
      const key = `${l.employee_code || ''} — ${l.employee_name || 'Unknown'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(l);
    }
    return [...map.entries()];
  }, [visible, groupByAssociate]);

  const setStatusFilter = (s) => setFilters((f) => ({ ...f, status: f.status === s ? '' : s }));

  const onUpdated = (updated) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
    api.get('/api/leads/summary').then((r) => setSummary(r.data.summary || {}));
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: radii.xl, padding: '18px 20px', background: gradients.orange, boxShadow: shadow.md }}>
        <div style={{ position: 'absolute', right: -30, top: -36, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,.16)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-.02em', margin: 0 }}>
              <span style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3.5"/><path d="M2.5 19c.6-3.2 3.4-5.5 6.5-5.5s5.9 2.3 6.5 5.5"/><path d="M16 4a3 3 0 0 1 0 6M22 18c-.4-2.4-2.2-4-4.5-4.4"/></svg>
              </span>
              Lead Tracker
              <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(255,255,255,.25)', color: '#fff', padding: '3px 10px', borderRadius: 999 }}>{summary.total ?? leads.length}</span>
            </h2>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.9)', marginTop: 5 }}>
              {summary.conversion_rate ?? 0}% conversion · {summary.converted ?? 0} won
            </div>
          </div>
          {isAdmin && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,.18)', padding: '7px 12px', borderRadius: 999, cursor: 'pointer' }}>
              <input type="checkbox" checked={groupByAssociate} onChange={(e) => setGroupByAssociate(e.target.checked)} style={{ accentColor: '#fff' }} />
              Group by associate
            </label>
          )}
        </div>
      </div>

      {/* PIPELINE SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
        <SummaryCard label="Total"     value={summary.total}     dot={colors.neutral} active={!filters.status}                 onClick={() => setFilters((f) => ({ ...f, status: '' }))} />
        <SummaryCard label="New"       value={summary.new}       dot={colors.cyan}    active={filters.status === 'new'}        onClick={() => setStatusFilter('new')} />
        <SummaryCard label="Contacted" value={summary.contacted} dot={colors.orange}  active={filters.status === 'contacted'}  onClick={() => setStatusFilter('contacted')} />
        <SummaryCard label="Qualified" value={summary.qualified} dot={colors.purple}  active={filters.status === 'qualified'}  onClick={() => setStatusFilter('qualified')} />
        <SummaryCard label="Converted" value={`${summary.converted ?? 0} · ${summary.conversion_rate ?? 0}%`} dot={colors.green} active={filters.status === 'converted'} onClick={() => setStatusFilter('converted')} />
        <SummaryCard label="Lost"      value={`${summary.lost ?? 0} · ${summary.total ? ((summary.lost/summary.total)*100).toFixed(0) : 0}%`} dot={colors.red} active={filters.status === 'lost'} onClick={() => setStatusFilter('lost')} />
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="md:col-span-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.client_type} onChange={(e) => setFilters((f) => ({ ...f, client_type: e.target.value }))}
                className="md:col-span-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All business types</option>
          {Object.entries(CLIENT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
               className="md:col-span-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
               placeholder="From" aria-label="From date" />
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
               className="md:col-span-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
               placeholder="To" aria-label="To date" />
        <input type="search" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
               placeholder="Search name or phone…"
               className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* TABLE (md+) / CARDS (mobile) */}
      {loading ? (
        <SkeletonTable rows={6} cols={isAdmin ? 10 : 9} />
      ) : visible.length === 0 ? (
        leads.length === 0 ? (
          <EmptyState
            icon="people"
            title="No leads yet"
            hint="Leads are auto-created when you generate a quote. Build one to get started."
          />
        ) : (
          <EmptyState
            icon="filter"
            title="No leads match these filters"
            hint="Try clearing a filter or widening the date range."
          />
        )
      ) : grouped ? (
        <div className="space-y-4">
          {grouped.map(([name, rows]) => (
            <section key={name} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">{name}</h3>
                <span className="text-xs text-slate-500">{rows.length} {rows.length === 1 ? 'lead' : 'leads'}</span>
              </div>
              <LeadsTable rows={rows} isAdmin={isAdmin} onOpen={setOpenLeadId} />
            </section>
          ))}
        </div>
      ) : (
        <LeadsTable rows={visible} isAdmin={isAdmin} onOpen={setOpenLeadId} />
      )}

      <LeadDetailModal
        leadId={openLeadId}
        open={!!openLeadId}
        onClose={() => setOpenLeadId(null)}
        onUpdated={onUpdated}
      />
    </div>
  );
}

const SummaryCard = ({ label, value, active, onClick, dot = colors.neutral }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      textAlign: 'left', borderRadius: radii.lg, padding: '12px 13px',
      background: active ? '#fff' : '#fff',
      border: `1.5px solid ${active ? dot : colors.border}`,
      boxShadow: active ? `0 6px 16px ${dot}33` : shadow.sm,
      cursor: 'pointer', transition: 'all .15s ease',
      borderTop: `3px solid ${dot}`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: colors.sub }}>{label}</span>
    </div>
    <div style={{ fontSize: 21, fontWeight: 900, color: colors.ink, marginTop: 5, letterSpacing: '-.02em' }}>{value ?? '—'}</div>
  </button>
);

function LeadsTable({ rows, isAdmin, onOpen }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Lead / Quote</th>
              <th className="text-left px-3 py-2">Client</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Requirement</th>
              <th className="text-right px-3 py-2">Est. Monthly</th>
              <th className="text-left px-3 py-2">Status</th>
              {isAdmin && <th className="text-left px-3 py-2">Associate</th>}
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-left px-3 py-2">Follow-up</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr
                key={l.id}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => onOpen(l.id)}
              >
                <td className="px-3 py-2 align-top">
                  <div className="font-medium text-slate-900">#{l.id}</div>
                  <div className="text-[11px] text-slate-500">{l.quote_number || '—'}</div>
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="font-medium text-slate-900">{l.client_business_name || l.client_name}</div>
                  <div className="text-[11px] text-slate-500">{l.client_name} · {l.client_city}</div>
                </td>
                <td className="px-3 py-2 align-top"><ClientTypeBadge type={l.client_type} /></td>
                <td className="px-3 py-2 align-top text-xs text-slate-700">{l.requirement_type || '—'}</td>
                <td className="px-3 py-2 align-top text-right font-medium">{formatINR(l.estimated_monthly_value)}</td>
                <td className="px-3 py-2 align-top"><StatusBadge status={l.status} /></td>
                {isAdmin && (
                  <td className="px-3 py-2 align-top text-xs">
                    <div className="text-slate-800">{l.employee_name}</div>
                    <div className="text-slate-500">{l.employee_code}{l.region ? ` · ${l.region}` : ''}</div>
                  </td>
                )}
                <td className="px-3 py-2 align-top text-xs text-slate-600">{formatDate(l.created_at)}</td>
                <td className="px-3 py-2 align-top text-xs">
                  {l.follow_up_date ? (
                    <span className={isOverdue(l.follow_up_date) && l.status !== 'converted' && l.status !== 'lost' ? 'text-rose-600 font-semibold' : 'text-slate-700'}>
                      {formatDate(l.follow_up_date)}
                    </span>
                  ) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2 align-top text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {l.quote_id && (
                    <Link
                      to={`/quotes/${l.quote_id}`}
                      className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 mr-1"
                    >View</Link>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpen(l.id)}
                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >Update</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {rows.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onOpen(l.id)}
            className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{l.client_business_name || l.client_name}</div>
                <div className="text-[11px] text-slate-500">#{l.id} · {l.quote_number || '—'} · {l.client_city}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-900">{formatINR(l.estimated_monthly_value)}</div>
                <div className="text-[11px] text-slate-500">est. monthly</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ClientTypeBadge type={l.client_type} />
              <StatusBadge status={l.status} />
              {l.requirement_type && (
                <span className="text-[10px] text-slate-500">· {l.requirement_type}</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Created {formatDate(l.created_at)}</span>
              {l.follow_up_date && (
                <span className={isOverdue(l.follow_up_date) && l.status !== 'converted' && l.status !== 'lost' ? 'text-rose-600 font-semibold' : ''}>
                  Follow-up {formatDate(l.follow_up_date)}
                </span>
              )}
            </div>
            {isAdmin && l.employee_name && (
              <div className="mt-1 text-[11px] text-slate-500">
                {l.employee_name} · {l.employee_code}
              </div>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
