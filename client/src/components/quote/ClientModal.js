import React, { useEffect, useState } from 'react';

// Display labels → DB-valid enum values (DB CHECK constraints are stricter than spec labels)
export const CLIENT_TYPES = [
  ['Hospital',             'Hospital'],
  ['FMC',                  'FMC'],
  ['Apartment Association','Apartment'],
  ['Restaurant',           'Restaurant'],
  ['School & Hostel',      'School'],
  ['Cleaning Contractor',  'Contractor'],
  ['Industrial Buyer',     'Other'],
  ['Other',                'Other'],
];

export const REQUIREMENT_TYPES = [
  ['Bulk One-Time Order',      'Bulk'],
  ['Monthly Supply Contract',  'Monthly Contract'],
  ['Distributor Partnership',  'Distributor'],
  ['Product Sample Request',   'Bulk'],
];

const PHONE_RE = /^[6-9]\d{9}$/;

const Field = ({ label, required, children, error }) => (
  <label className="block">
    <div className="text-xs font-medium text-slate-700 mb-1">
      {label} {required && <span className="text-rose-600">*</span>}
    </div>
    {children}
    {error && <div className="text-[11px] text-rose-600 mt-1">{error}</div>}
  </label>
);

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ClientModal({ initial, open, submitting, onClose, onSubmit }) {
  const [v, setV] = useState({
    client_name: '', client_business_name: '', client_type: 'Hospital',
    client_phone: '', client_email: '', client_city: '',
    requirement_type: 'Bulk', validity_days: 7, notes: '',
    next_follow_up_date: '', expected_order_date: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setV((prev) => ({ ...prev, ...(initial || {}) }));
      setErrors({});
    }
  }, [open, initial]);

  if (!open) return null;

  const upd = (patch) => setV((s) => ({ ...s, ...patch }));

  const validate = () => {
    const e = {};
    if (!v.client_name.trim())          e.client_name = 'Required';
    if (!v.client_business_name.trim()) e.client_business_name = 'Required';
    if (!v.client_phone.trim())         e.client_phone = 'Required';
    else if (!PHONE_RE.test(v.client_phone.trim()))
      e.client_phone = 'Enter a valid 10-digit Indian mobile number';
    if (!v.client_city.trim())          e.client_city = 'Required';
    if (v.client_email && !/^\S+@\S+\.\S+$/.test(v.client_email))
      e.client_email = 'Enter a valid email';
    if (!v.next_follow_up_date)
      e.next_follow_up_date = 'Required — set a follow-up date before generating the quote';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (status) => {
    if (!validate()) return;
    onSubmit({ ...v, status });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 px-3 py-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-modal-title"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="client-modal-title" className="text-lg font-semibold text-slate-900">Client details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Close"
          >×</button>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <Field label="Client Name" required error={errors.client_name}>
            <input className={inputCls} value={v.client_name}
              onChange={(e) => upd({ client_name: e.target.value })} placeholder="Contact person" />
          </Field>
          <Field label="Business Name" required error={errors.client_business_name}>
            <input className={inputCls} value={v.client_business_name}
              onChange={(e) => upd({ client_business_name: e.target.value })} placeholder="Acme Healthcare Pvt Ltd" />
          </Field>

          <Field label="Business Type" required>
            <select className={inputCls} value={v.client_type}
              onChange={(e) => upd({ client_type: e.target.value })}>
              {CLIENT_TYPES.map(([label, value]) => (
                <option key={label} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Requirement Type" required>
            <select className={inputCls} value={v.requirement_type}
              onChange={(e) => upd({ requirement_type: e.target.value })}>
              {REQUIREMENT_TYPES.map(([label, value]) => (
                <option key={label} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          <Field label="Phone Number" required error={errors.client_phone}>
            <input className={inputCls} value={v.client_phone} inputMode="numeric" maxLength={10}
              onChange={(e) => upd({ client_phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="9XXXXXXXXX" />
          </Field>
          <Field label="Email" error={errors.client_email}>
            <input className={inputCls} type="email" value={v.client_email}
              onChange={(e) => upd({ client_email: e.target.value })} placeholder="buyer@company.in" />
          </Field>

          <Field label="City" required error={errors.client_city}>
            <select
              className={inputCls}
              value={['Hyderabad','Nizamabad','Warangal','Siddipet'].includes(v.client_city) ? v.client_city : v.client_city ? 'Others' : ''}
              onChange={(e) => {
                if (e.target.value === 'Others') upd({ client_city: '' });
                else upd({ client_city: e.target.value });
              }}
            >
              <option value="">Select city…</option>
              <option value="Hyderabad">Hyderabad</option>
              <option value="Nizamabad">Nizamabad</option>
              <option value="Warangal">Warangal</option>
              <option value="Siddipet">Siddipet</option>
              <option value="Others">Others</option>
            </select>
            {/* Free-text input shown when Others is selected */}
            {v.client_city !== '' && !['Hyderabad','Nizamabad','Warangal','Siddipet'].includes(v.client_city) && (
              <input
                className={`${inputCls} mt-1.5`}
                value={v.client_city}
                onChange={(e) => upd({ client_city: e.target.value })}
                placeholder="Enter city name…"
                autoFocus
              />
            )}
          </Field>
          <Field label="Validity (days)">
            <input className={inputCls} type="number" min={1} max={180} value={v.validity_days}
              onChange={(e) => upd({ validity_days: Math.max(1, Number(e.target.value) || 30) })} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                className={inputCls}
                rows={3}
                value={v.notes}
                onChange={(e) => upd({ notes: e.target.value })}
                placeholder="Special instructions, delivery preferences, etc."
              />
            </Field>
          </div>

          {/* ── Follow-up & Order dates ── */}
          <div className="sm:col-span-2 border-t border-slate-100 pt-3 mt-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              📅 Follow-up &amp; Order Tracking
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Next Follow-up Date" required error={errors.next_follow_up_date}>
                <input
                  type="date"
                  className={inputCls}
                  value={v.next_follow_up_date}
                  min={todayISO()}
                  onChange={(e) => upd({ next_follow_up_date: e.target.value })}
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  When should you follow up with this client?
                </div>
              </Field>
              <Field label="Expected Order Date (Optional)">
                <input
                  type="date"
                  className={inputCls}
                  value={v.expected_order_date}
                  min={v.next_follow_up_date || todayISO()}
                  onChange={(e) => upd({ expected_order_date: e.target.value })}
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  When does the client expect to place the order?
                </div>
              </Field>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >Cancel</button>
          <button
            type="button"
            onClick={() => submit('draft')}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg border border-cyan-600 text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
          >Save as Draft</button>
          <button
            type="button"
            onClick={() => submit('sent')}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            Generate &amp; Preview Quote
          </button>
        </div>
      </div>
    </div>
  );
}
