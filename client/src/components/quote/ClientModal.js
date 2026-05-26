import React, { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';

export const CLIENT_TYPES = [
  ['Hospital',              'Hospital'],
  ['FMC',                   'FMC'],
  ['Apartment Association', 'Apartment'],
  ['Restaurant',            'Restaurant'],
  ['School & Hostel',       'School'],
  ['Cleaning Contractor',   'Contractor'],
  ['Industrial Buyer',      'Other'],
  ['Other',                 'Other'],
];

export const REQUIREMENT_TYPES = [
  ['Bulk One-Time Order',     'Bulk'],
  ['Monthly Supply Contract', 'Monthly Contract'],
  ['Distributor Partnership', 'Distributor'],
  ['Product Sample Request',  'Bulk'],
];

const CITIES = ['Hyderabad', 'Nizamabad', 'Warangal', 'Karimnagar',
                'Vijayawada', 'Guntur', 'Medak', 'Siddipet'];

const PHONE_RE = /^[6-9]\d{9}$/;

const todayISO = () => new Date().toISOString().slice(0, 10);

const Field = ({ label, required, children, error }) => (
  <label className="block">
    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
      {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
    </div>
    {children}
    {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{error}</div>}
  </label>
);

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600';

const DEFAULT = {
  client_name: '', client_business_name: '', client_type: 'Hospital',
  client_phone: '', client_email: '', client_city: '',
  requirement_type: 'Bulk', validity_days: 7, notes: '',
  next_follow_up_date: '', expected_order_date: '',
};

export default function ClientModal({ initial, open, submitting, onClose, onSubmit }) {
  const [v, setV]               = useState({ ...DEFAULT });
  const [errors, setErrors]     = useState({});

  // Client-lookup state
  const [cityClients,     setCityClients]     = useState([]);
  const [loadingClients,  setLoadingClients]  = useState(false);
  const [clientSearch,    setClientSearch]    = useState('');
  const [showDropdown,    setShowDropdown]    = useState(false);
  const [phoneEditable,   setPhoneEditable]   = useState(true);
  const [fromDB,          setFromDB]          = useState(false); // true when auto-filled from DB

  const dropdownRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      const init = { ...DEFAULT, ...(initial || {}) };
      setV(init);
      setErrors({});
      setClientSearch(init.client_business_name || '');
      setFromDB(false);
      setPhoneEditable(true);
      setCityClients([]);
    }
  }, [open, initial]);

  // Fetch clients whenever city changes
  useEffect(() => {
    if (!v.client_city) { setCityClients([]); return; }
    setLoadingClients(true);
    api.get('/api/clients/by-city', { params: { city: v.client_city } })
      .then(({ data }) => setCityClients(data.clients || []))
      .catch(() => setCityClients([]))
      .finally(() => setLoadingClients(false));
  }, [v.client_city]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!open) return null;

  const upd = (patch) => setV((s) => ({ ...s, ...patch }));

  // Filtered clients for dropdown
  const q = clientSearch.toLowerCase();
  const filtered = cityClients.filter((c) =>
    (c.business_name || '').toLowerCase().includes(q) ||
    (c.contact_name  || '').toLowerCase().includes(q) ||
    (c.phone         || '').includes(q)
  );

  const selectClient = (c) => {
    upd({
      client_name:          c.contact_name   || v.client_name,
      client_business_name: c.business_name  || v.client_business_name,
      client_type:          c.client_type    || v.client_type,
      client_phone:         c.phone          || '',
      client_email:         c.email          || v.client_email,
    });
    setClientSearch(c.business_name || c.contact_name || '');
    setFromDB(true);
    setPhoneEditable(false); // lock phone; user can unlock with Edit
    setShowDropdown(false);
    setErrors({});
  };

  const clearClient = () => {
    upd({ client_name: '', client_business_name: '', client_phone: '', client_email: '', client_type: 'Hospital' });
    setClientSearch('');
    setFromDB(false);
    setPhoneEditable(true);
    setShowDropdown(true);
  };

  const validate = () => {
    const e = {};
    if (!v.client_name.trim())          e.client_name = 'Required';
    if (!v.client_business_name.trim()) e.client_business_name = 'Required';
    if (!v.client_phone.trim())         e.client_phone = 'Required';
    else if (!PHONE_RE.test(v.client_phone.trim()))
      e.client_phone = 'Enter a valid 10-digit mobile number';
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

  const isCustomCity = v.client_city && !CITIES.includes(v.client_city);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 px-3 py-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col"
           style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            🧾 Client Details
          </h2>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '18px 20px' }}>

          {/* ── STEP 1: City ─────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <Field label="City" required error={errors.client_city}>
              <select
                className={inputCls}
                value={CITIES.includes(v.client_city) ? v.client_city : v.client_city ? 'Others' : ''}
                onChange={(e) => {
                  if (e.target.value === 'Others') {
                    upd({ client_city: '' });
                    clearClient();
                  } else {
                    upd({ client_city: e.target.value });
                    clearClient();
                  }
                }}
              >
                <option value="">Select city…</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="Others">Others (type below)</option>
              </select>
              {isCustomCity && (
                <input className={`${inputCls} mt-1.5`} value={v.client_city}
                  onChange={(e) => upd({ client_city: e.target.value })}
                  placeholder="Enter city name…" autoFocus />
              )}
              {v.client_city === '' && !isCustomCity && (
                <input className={`${inputCls} mt-1.5`} value={v.client_city}
                  style={{ display: 'none' }} readOnly />
              )}
            </Field>
          </div>

          {/* ── STEP 2: Client lookup ─────────────────────────────── */}
          {v.client_city && (
            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0',
                          borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569',
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                🔍 Search Existing Client in {v.client_city}
                {loadingClients && <span style={{ fontWeight: 400, color: '#94a3b8' }}> — loading…</span>}
              </div>

              {fromDB ? (
                /* Auto-filled state — show summary card */
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              background: '#f0fdf4', border: '1.5px solid #86efac',
                              borderRadius: 9, padding: '10px 14px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>
                      ✅ {v.client_business_name || v.client_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                      {v.client_name} · {v.client_phone} · {v.client_type}
                    </div>
                  </div>
                  <button type="button" onClick={clearClient}
                    style={{ fontSize: 11, fontWeight: 700, color: '#dc2626',
                             background: '#fff', border: '1px solid #fca5a5',
                             borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                    × Change
                  </button>
                </div>
              ) : (
                /* Search dropdown */
                <div style={{ position: 'relative' }} ref={dropdownRef}>
                  <input
                    className={inputCls}
                    placeholder={cityClients.length
                      ? `Search from ${cityClients.length} existing client${cityClients.length > 1 ? 's' : ''}…`
                      : 'No existing clients in this city — fill below'}
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    autoComplete="off"
                  />
                  {showDropdown && cityClients.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', marginTop: 4,
                      maxHeight: 220, overflowY: 'auto',
                    }}>
                      {filtered.length === 0 ? (
                        <div style={{ padding: '12px 14px', fontSize: 12, color: '#94a3b8' }}>
                          No match — fill the form below to create new client
                        </div>
                      ) : filtered.map((c, i) => (
                        <div key={i}
                          onMouseDown={(e) => { e.preventDefault(); selectClient(c); }}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                            {c.business_name || c.contact_name}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {c.contact_name && c.business_name ? `${c.contact_name} · ` : ''}
                            {c.phone && `📞 ${c.phone}`}
                            {c.client_type && ` · ${c.client_type}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Client details fields ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            <Field label="Contact Person Name" required error={errors.client_name}>
              <input className={inputCls} value={v.client_name}
                onChange={(e) => upd({ client_name: e.target.value })}
                placeholder="e.g. Ramesh Kumar" />
            </Field>

            <Field label="Business Name" required error={errors.client_business_name}>
              <input className={inputCls} value={v.client_business_name}
                onChange={(e) => upd({ client_business_name: e.target.value })}
                placeholder="e.g. Sunrise Hospital" />
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

            {/* Phone — lockable when auto-filled */}
            <Field label="Phone Number" required error={errors.client_phone}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className={inputCls}
                  value={v.client_phone}
                  inputMode="numeric"
                  maxLength={10}
                  readOnly={!phoneEditable}
                  onChange={(e) => phoneEditable && upd({ client_phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="9XXXXXXXXX"
                  style={{
                    flex: 1,
                    background: phoneEditable ? '#fff' : '#f8fafc',
                    color: phoneEditable ? '#0f172a' : '#475569',
                  }}
                />
                {fromDB && (
                  <button
                    type="button"
                    onClick={() => setPhoneEditable((p) => !p)}
                    title={phoneEditable ? 'Lock phone' : 'Edit phone number'}
                    style={{
                      flexShrink: 0, padding: '0 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      border: `1.5px solid ${phoneEditable ? '#fca5a5' : '#93c5fd'}`,
                      background: phoneEditable ? '#fef2f2' : '#eff6ff',
                      color: phoneEditable ? '#dc2626' : '#1d4ed8',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {phoneEditable ? '🔒 Lock' : '✏️ Edit'}
                  </button>
                )}
              </div>
            </Field>

            <Field label="Email" error={errors.client_email}>
              <input className={inputCls} type="email" value={v.client_email}
                onChange={(e) => upd({ client_email: e.target.value })}
                placeholder="buyer@company.in" />
            </Field>

            <Field label="Validity (days)">
              <input className={inputCls} type="number" min={1} max={180} value={v.validity_days}
                onChange={(e) => upd({ validity_days: Math.max(1, Number(e.target.value) || 7) })} />
            </Field>

            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Notes">
                <textarea className={inputCls} rows={2} value={v.notes}
                  onChange={(e) => upd({ notes: e.target.value })}
                  placeholder="Special instructions, delivery preferences, etc." />
              </Field>
            </div>

            {/* Follow-up dates */}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b',
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                📅 Follow-up &amp; Order Tracking
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Next Follow-up Date" required error={errors.next_follow_up_date}>
                  <input type="date" className={inputCls} value={v.next_follow_up_date}
                    min={todayISO()} onChange={(e) => upd({ next_follow_up_date: e.target.value })} />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                    When should you follow up?
                  </div>
                </Field>
                <Field label="Expected Order Date (Optional)">
                  <input type="date" className={inputCls} value={v.expected_order_date}
                    min={v.next_follow_up_date || todayISO()}
                    onChange={(e) => upd({ expected_order_date: e.target.value })} />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                    When does client expect to order?
                  </div>
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0',
                      display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} disabled={submitting}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13,
                     border: '1px solid #cbd5e1', background: '#fff', color: '#374151',
                     cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>
            Cancel
          </button>
          <button type="button" onClick={() => submit('draft')} disabled={submitting}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13,
                     border: '1.5px solid #0891b2', background: '#fff', color: '#0891b2',
                     fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>
            Save as Draft
          </button>
          <button type="button" onClick={() => submit('sent')} disabled={submitting}
            style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13,
                     background: 'linear-gradient(135deg, #0891b2, #0e7490)', color: '#fff',
                     fontWeight: 700, border: 'none', cursor: 'pointer',
                     opacity: submitting ? 0.5 : 1,
                     display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
