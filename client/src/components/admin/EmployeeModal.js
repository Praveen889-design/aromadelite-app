import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { useToast } from '../Toast';

const REGIONS = ['Hyderabad', 'Nizamabad', 'Warangal', 'Karimnagar', 'Vijayawada', 'Guntur', 'Medak'];

const Field = ({ label, children, error, required }) => (
  <label className="block">
    <div className="text-xs font-medium text-slate-700 mb-1">{label} {required && <span className="text-rose-600">*</span>}</div>
    {children}
    {error && <div className="text-[11px] text-rose-600 mt-1">{error}</div>}
  </label>
);

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600';

export default function EmployeeModal({ open, onClose, onCreated }) {
  const { toast } = useToast();
  const [v, setV] = useState({
    employee_id: '', name: '', email: '', phone: '',
    password: '', role: 'associate', region: 'Hyderabad',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    (async () => {
      try {
        const { data } = await api.get('/api/employees/next-code');
        setV((s) => ({ ...s, employee_id: data.next_code }));
      } catch {/* ignore — admin can type */}
    })();
  }, [open]);

  if (!open) return null;

  const upd = (patch) => setV((s) => ({ ...s, ...patch }));

  const submit = async () => {
    const e = {};
    if (!v.employee_id.trim())   e.employee_id = 'Required';
    if (!v.name.trim())          e.name = 'Required';
    if (!v.password || v.password.length < 6) e.password = 'At least 6 characters';
    if (v.role === 'associate' && !v.region) e.region = 'Required';
    if (!['admin', 'associate', 'central_office'].includes(v.role)) e.role = 'Invalid role';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      await api.post('/api/employees', { ...v, region: ['admin', 'central_office'].includes(v.role) ? null : v.region });
      toast(`${v.employee_id} added.`, { kind: 'success' });
      onCreated?.();
      onClose();
    } catch (err) {
      toast(err?.response?.data?.error || 'Failed to add employee', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 px-3 py-6"
         onMouseDown={(e) => e.target === e.currentTarget && onClose()}
         role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Add new employee</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl" aria-label="Close">×</button>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-3">
          <Field label="Employee ID" required error={errors.employee_id}>
            <input className={inputCls} value={v.employee_id}
                   onChange={(e) => upd({ employee_id: e.target.value.toUpperCase() })} placeholder="ARO-003" />
          </Field>
          <Field label="Role" required>
            <select className={inputCls} value={v.role} onChange={(e) => upd({ role: e.target.value })}>
              <option value="associate">Associate</option>
              <option value="central_office">Central Office</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Name" required error={errors.name}>
            <input className={inputCls} value={v.name} onChange={(e) => upd({ name: e.target.value })} />
          </Field>
          <Field label="Region" required={v.role === 'associate'} error={errors.region}>
            <select className={inputCls} value={v.region} disabled={['admin', 'central_office'].includes(v.role)}
                    onChange={(e) => upd({ region: e.target.value })}>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Phone">
            <input className={inputCls} inputMode="numeric" value={v.phone}
                   onChange={(e) => upd({ phone: e.target.value })} placeholder="+91-9XXXXXXXXX" />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" value={v.email}
                   onChange={(e) => upd({ email: e.target.value })} />
          </Field>
          <div className="col-span-2">
            <Field label="Password" required error={errors.password}>
              <input className={inputCls} type="password" value={v.password}
                     onChange={(e) => upd({ password: e.target.value })} placeholder="At least 6 characters" />
            </Field>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={busy}
                  className="px-4 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold disabled:opacity-60">
            {busy ? 'Adding…' : 'Add employee'}
          </button>
        </div>
      </div>
    </div>
  );
}
