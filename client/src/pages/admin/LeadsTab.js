import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { ClientTypeBadge, StatusBadge } from '../../components/leads/badges';
import { downloadCSV } from '../../utils/csv';
import LeadDetailModal from '../../components/leads/LeadDetailModal';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function LeadsTab() {
  const { toast } = useToast();
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ status: '', client_type: '', employee_id: '' });
  const [loading, setLoading] = useState(true);
  const [openLeadId, setOpenLeadId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, eRes] = await Promise.all([
        api.get('/api/leads'),
        api.get('/api/employees'),
      ]);
      setLeads(lRes.data.leads || []);
      setEmployees((eRes.data.employees || []).filter((e) => e.role === 'associate'));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => leads.filter((l) => {
    if (filters.status && l.status !== filters.status) return false;
    if (filters.client_type && l.client_type !== filters.client_type) return false;
    if (filters.employee_id && String(l.employee_id) !== String(filters.employee_id)) return false;
    return true;
  }), [leads, filters]);

  const reassign = async (lead, employeeIdStr) => {
    const employee_id = Number(employeeIdStr);
    if (!Number.isFinite(employee_id) || employee_id === lead.employee_id) return;
    try {
      const { data } = await api.patch(`/api/leads/${lead.id}`, { employee_id });
      const newOwner = employees.find((e) => e.id === employee_id);
      setLeads((arr) => arr.map((x) => (x.id === lead.id
        ? { ...x, ...data.lead, employee_name: newOwner?.name, employee_code: newOwner?.employee_id, region: newOwner?.region }
        : x)));
      toast(`Reassigned to ${newOwner?.name}.`, { kind: 'success' });
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to reassign', { kind: 'error' });
    }
  };

  const exportCSV = () => {
    downloadCSV(visible, [
      { header: 'Lead ID',     key: 'id' },
      { header: 'Quote',       key: 'quote_number' },
      { header: 'Client',      key: 'client_name' },
      { header: 'Business',    key: 'client_business_name' },
      { header: 'Type',        key: 'client_type' },
      { header: 'Requirement', key: 'requirement_type' },
      { header: 'City',        key: 'client_city' },
      { header: 'Phone',       key: 'client_phone' },
      { header: 'Est. Monthly',key: 'estimated_monthly_value' },
      { header: 'Status',      key: 'status' },
      { header: 'Associate',   get: (r) => `${r.employee_code} ${r.employee_name}` },
      { header: 'Region',      key: 'region' },
      { header: 'Follow-up',   key: 'follow_up_date' },
      { header: 'Created',     get: (r) => r.created_at?.slice(0,10) },
    ], `Aromadelite_Leads_${new Date().toISOString().slice(0,10)}.csv`);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
          <option value="">All statuses</option>
          {['new','contacted','qualified','converted','lost'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.client_type} onChange={(e) => setFilters((f) => ({ ...f, client_type: e.target.value }))}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
          <option value="">All business types</option>
          {['Hospital','FMC','Apartment','Restaurant','School','Contractor','Other'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={filters.employee_id} onChange={(e) => setFilters((f) => ({ ...f, employee_id: e.target.value }))}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
          <option value="">All associates</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id} — {e.name}</option>)}
        </select>
        <button onClick={exportCSV}
                className="text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2">
          Export CSV
        </button>
      </div>

      <div className="text-sm text-slate-600">{visible.length} of {leads.length} leads</div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? <div className="p-6 text-sm text-slate-500">Loading…</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Lead</th>
                <th className="text-left px-3 py-2">Client</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Est. Monthly</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Owner</th>
                <th className="text-left px-3 py-2">Reassign</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">#{l.id}</div>
                    <div className="text-[11px] text-slate-500">{l.quote_number || '—'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{l.client_business_name || l.client_name}</div>
                    <div className="text-[11px] text-slate-500">{l.client_name} · {l.client_city || '—'}</div>
                  </td>
                  <td className="px-3 py-2"><ClientTypeBadge type={l.client_type} /></td>
                  <td className="px-3 py-2 text-right font-medium">{formatINR(l.estimated_monthly_value)}</td>
                  <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                  <td className="px-3 py-2 text-xs">
                    <div>{l.employee_name}</div>
                    <div className="text-slate-500">{l.employee_code}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={l.employee_id}
                      onChange={(e) => reassign(l, e.target.value)}
                      className="text-xs border border-slate-300 rounded px-1 py-1"
                    >
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setOpenLeadId(l.id)}
                            className="text-xs px-2 py-1 rounded bg-cyan-600 text-white hover:bg-cyan-700">Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <LeadDetailModal leadId={openLeadId} open={!!openLeadId} onClose={() => setOpenLeadId(null)} onUpdated={load} />
    </div>
  );
}
