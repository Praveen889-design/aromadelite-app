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

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso : iso + 'Z');
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
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          Lead Tracker
          <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
            {summary.total ?? leads.length}
          </span>
        </h2>
        {isAdmin && (
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={groupByAssociate}
              onChange={(e) => setGroupByAssociate(e.target.checked)}
              className="accent-cyan-600"
            />
            Group by associate
          </label>
        )}
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <SummaryCard label="Total" value={summary.total} active={!filters.status}
                     onClick={() => setFilters((f) => ({ ...f, status: '' }))} kindCls="bg-slate-50 border-slate-200 text-slate-800" />
        <SummaryCard label="New" value={summary.new} active={filters.status === 'new'}
                     onClick={() => setStatusFilter('new')} kindCls="bg-cyan-50 border-cyan-200 text-cyan-800" />
        <SummaryCard label="Contacted" value={summary.contacted} active={filters.status === 'contacted'}
                     onClick={() => setStatusFilter('contacted')} kindCls="bg-amber-50 border-amber-200 text-amber-800" />
        <SummaryCard label="Qualified" value={summary.qualified} active={filters.status === 'qualified'}
                     onClick={() => setStatusFilter('qualified')} kindCls="bg-teal-50 border-teal-200 text-teal-800" />
        <SummaryCard label="Converted" value={`${summary.converted ?? 0} (${summary.conversion_rate ?? 0}%)`} active={filters.status === 'converted'}
                     onClick={() => setStatusFilter('converted')} kindCls="bg-emerald-50 border-emerald-200 text-emerald-800" />
        <SummaryCard
          label="Lost"
          value={`${summary.lost ?? 0} (${summary.total ? ((summary.lost/summary.total)*100).toFixed(0) : 0}%)`}
          active={filters.status === 'lost'}
          onClick={() => setStatusFilter('lost')}
          kindCls="bg-rose-50 border-rose-200 text-rose-700"
        />
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="md:col-span-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.client_type} onChange={(e) => setFilters((f) => ({ ...f, client_type: e.target.value }))}
                className="md:col-span-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600">
          <option value="">All business types</option>
          {Object.entries(CLIENT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
               className="md:col-span-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
               placeholder="From" aria-label="From date" />
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
               className="md:col-span-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
               placeholder="To" aria-label="To date" />
        <input type="search" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
               placeholder="Search name or phone…"
               className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600" />
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

const SummaryCard = ({ label, value, active, onClick, kindCls }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'text-left rounded-xl border px-3 py-3 transition-shadow',
      kindCls,
      active ? 'ring-2 ring-cyan-500 ring-offset-1' : 'hover:shadow-sm',
    ].join(' ')}
  >
    <div className="text-[10px] uppercase tracking-wide opacity-75">{label}</div>
    <div className="text-xl font-bold mt-1">{value ?? '—'}</div>
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
                    className="text-xs px-2 py-1 rounded bg-cyan-600 text-white hover:bg-cyan-700"
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
