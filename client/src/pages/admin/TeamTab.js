import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import EmployeeModal from '../../components/admin/EmployeeModal';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function TeamTab({ onSwitchTab }) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/employees');
      setEmployees(data.employees || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (emp) => {
    try {
      const { data } = await api.patch(`/api/employees/${emp.id}`, { is_active: !emp.is_active });
      setEmployees((es) => es.map((e) => (e.id === emp.id ? { ...e, ...data.employee } : e)));
      toast(`${emp.employee_id} is now ${data.employee.is_active ? 'active' : 'inactive'}.`, { kind: 'success' });
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update', { kind: 'error' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">{employees.length} {employees.length === 1 ? 'employee' : 'employees'}</div>
        <button onClick={() => setModalOpen(true)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg px-3 py-2">
          + Add new associate
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? <div className="p-6 text-sm text-slate-500">Loading…</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Employee ID</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Region</th>
                <th className="text-left px-3 py-2">Role</th>
                <th className="text-right px-3 py-2">Quotes</th>
                <th className="text-right px-3 py-2">Quote Value</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{e.employee_id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{e.name}</div>
                    <div className="text-[11px] text-slate-500">{e.email || '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{e.region || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                      e.role === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                    }`}>{e.role}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{e.quotes_count}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatINR(e.quote_value)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                      e.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>{e.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => { onSwitchTab?.('quotes', { employee_code: e.employee_id }); }}
                      className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 mr-1"
                      disabled={!e.quotes_count}
                      title="View quotes by this associate"
                    >View quotes</button>
                    <button
                      onClick={() => toggleActive(e)}
                      className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100"
                    >{e.is_active ? 'Deactivate' : 'Activate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <EmployeeModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </div>
  );
}
