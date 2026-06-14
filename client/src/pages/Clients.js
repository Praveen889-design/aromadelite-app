import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { SkeletonCards } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { CLIENT_TYPES } from '../components/quote/ClientModal';
import ShareCatalogModal from '../components/ShareCatalogModal';
import { useQuoteBuilder } from '../context/QuoteBuilderContext';
import { colors, radii, shadow } from '../theme/tokens';

const CITIES = ['Hyderabad', 'Nizamabad', 'Warangal', 'Karimnagar',
                'Vijayawada', 'Guntur', 'Medak', 'Siddipet'];

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500';

/* ── Onboard New Client Modal ─────────────────────────────── */
function OnboardModal({ open, onClose, onSaved }) {
  const { toast } = useToast();
  const EMPTY = { contact_name: '', business_name: '', phone: '', email: '', city: '', client_type: 'Hospital', notes: '' };
  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const isCustomCity = form.city && !CITIES.includes(form.city);

  useEffect(() => { if (open) { setForm(EMPTY); setErrors({}); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const upd = (patch) => setForm((s) => ({ ...s, ...patch }));

  const validate = () => {
    const e = {};
    if (!form.contact_name.trim() && !form.business_name.trim()) e.contact_name = 'At least one of contact name or business name is required';
    if (!form.phone.trim()) e.phone = 'Required';
    else if (!/^[6-9]\d{9}$/.test(form.phone.trim())) e.phone = 'Enter a valid 10-digit mobile number';
    if (!form.city.trim()) e.city = 'Required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/api/clients', form);
      toast('✅ Client onboarded successfully!', { kind: 'success' });
      onSaved();
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to save client';
      if (err?.response?.status === 409) {
        toast('ℹ️ This client already exists in the directory.', { kind: 'success' });
        onSaved(); onClose();
      } else {
        toast(`❌ ${msg}`, { kind: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: 'rgba(15,23,42,0.5)', padding: '16px' }}
         onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>➕ Onboard New Client</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Add a client to the directory</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20,
                                              color: '#94a3b8', cursor: 'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1,
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Contact Person Name {!form.business_name && <span style={{ color: '#dc2626' }}>*</span>}
            </div>
            <input className={inputCls} value={form.contact_name}
              onChange={(e) => upd({ contact_name: e.target.value })}
              placeholder="e.g. Ramesh Kumar" />
            {errors.contact_name && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{errors.contact_name}</div>}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Business Name</div>
            <input className={inputCls} value={form.business_name}
              onChange={(e) => upd({ business_name: e.target.value })}
              placeholder="e.g. Sunrise Hospital" />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Business Type
            </div>
            <select className={inputCls} value={form.client_type}
              onChange={(e) => upd({ client_type: e.target.value })}>
              {CLIENT_TYPES.map(([label, value]) => (
                <option key={label} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Phone <span style={{ color: '#dc2626' }}>*</span>
            </div>
            <input className={inputCls} value={form.phone} inputMode="numeric" maxLength={10}
              onChange={(e) => upd({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="9XXXXXXXXX" />
            {errors.phone && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{errors.phone}</div>}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Email</div>
            <input className={inputCls} type="email" value={form.email}
              onChange={(e) => upd({ email: e.target.value })} placeholder="buyer@company.in" />
            {errors.email && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{errors.email}</div>}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              City <span style={{ color: '#dc2626' }}>*</span>
            </div>
            <select className={inputCls}
              value={CITIES.includes(form.city) ? form.city : form.city ? 'Others' : ''}
              onChange={(e) => upd({ city: e.target.value === 'Others' ? '' : e.target.value })}>
              <option value="">Select city…</option>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="Others">Others</option>
            </select>
            {isCustomCity && (
              <input className={`${inputCls} mt-1.5`} value={form.city}
                onChange={(e) => upd({ city: e.target.value })} placeholder="Enter city…" autoFocus />
            )}
            {!form.city && !isCustomCity && errors.city && (
              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{errors.city}</div>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notes</div>
            <textarea className={inputCls} rows={2} value={form.notes}
              onChange={(e) => upd({ notes: e.target.value })}
              placeholder="Any notes about this client…" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0',
                      display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, border: '1px solid #cbd5e1',
                     background: '#fff', color: '#374151', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                     background: 'linear-gradient(135deg, #0891b2, #0e7490)', color: '#fff',
                     border: 'none', cursor: saving ? 'wait' : 'pointer',
                     display: 'inline-flex', alignItems: 'center', gap: 6,
                     opacity: saving ? 0.7 : 1 }}>
            {saving && <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>}
            {saving ? 'Saving…' : '✅ Save Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

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

const typeColor = (t) => TYPE_COLOR[(t || '').toLowerCase()] || TYPE_COLOR.other;

const AVATAR_GRAD = {
  hotel:      'linear-gradient(135deg,#2563EB,#06B6D4)',
  hospital:   'linear-gradient(135deg,#8B5CF6,#EC4899)',
  restaurant: 'linear-gradient(135deg,#F59E0B,#FACC15)',
  office:     'linear-gradient(135deg,#16A34A,#06B6D4)',
  school:     'linear-gradient(135deg,#EAB308,#F59E0B)',
  retail:     'linear-gradient(135deg,#EC4899,#EF4444)',
  other:      'linear-gradient(135deg,#64748B,#94A3B8)',
};
const avatarGrad = (t) => AVATAR_GRAD[(t || '').toLowerCase()] || AVATAR_GRAD.other;
const clientInitials = (name = '') =>
  name.split(/\s+/).map((s) => s.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?';

// Call / WhatsApp quick actions — open native dialer / WhatsApp (no logic change)
const callClient = (e, phone) => {
  e.preventDefault(); e.stopPropagation();
  if (phone) window.location.href = `tel:${phone}`;
};
const waClient = (e, phone, name) => {
  e.preventDefault(); e.stopPropagation();
  const digits = (phone || '').replace(/\D/g, '');
  const to = digits ? (digits.length === 10 ? '91' + digits : digits) : '';
  const text = encodeURIComponent(`Hi ${name || ''}, this is Aromadelite. `);
  window.open(to ? `https://wa.me/${to}?text=${text}` : `https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
};

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

/* ── Portal Link Button ───────────────────────────────────────── */
function PortalLinkBtn({ client, onClientCreated }) {
  const { toast } = useToast();
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [url,      setUrl]      = useState(
    client.portal_token
      ? `${window.location.origin}/portal/${client.portal_token}`
      : ''
  );
  const timerRef = useRef(null);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // If already have URL, just copy again
    if (url) {
      navigator.clipboard?.writeText(url).catch(() => {});
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2500);
      return;
    }

    setLoading(true);
    try {
      // Single endpoint: find-or-create client + generate portal token
      const { data: resp } = await api.post('/api/clients/portal-link-by-client', {
        contact_name:  client.contact_name || client.business_name || 'Unknown',
        business_name: client.business_name || null,
        phone:         client.phone         || null,
        email:         client.email         || null,
        city:          client.city          || null,
        client_type:   client.client_type   || null,
      });
      const link = resp.url;
      setUrl(link);
      navigator.clipboard?.writeText(link).catch(() => {});
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2500);
      toast('🛒 Order link copied! Share it with the client.', { kind: 'success' });
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to generate link';
      toast(`❌ ${msg}`, { kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!url) return;
    const clientDisplay = client.business_name || client.contact_name;
    const msg = `Hi ${clientDisplay},\n\nYou can now place your Aromadelite orders directly using this link:\n\n${url}\n\nBrowse our products, see your prices, and place orders anytime!\n🌿 Aromadelite Team`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'Aromadelite Order Portal', text: msg, url }).catch(() => {});
    } else {
      const phone = (client.phone || '').replace(/\D/g, '');
      const wa = phone
        ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(wa, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      {/* Main button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title={url ? 'Copy portal link' : 'Generate order portal link for this client'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          border: '1.5px solid #d8b4fe', cursor: loading ? 'wait' : 'pointer',
          background: copied ? '#f0fdf4' : '#fdf4ff',
          color:      copied ? '#15803d' : '#7c3aed',
          whiteSpace: 'nowrap', transition: 'all 0.15s',
          opacity: loading ? 0.7 : 1,
        }}
      >
        <span>{loading ? '⏳' : copied ? '✅' : url ? '📋' : '🛒'}</span>
        <span>{loading ? 'Generating…' : copied ? 'Copied!' : url ? 'Copy Order Link' : 'Get Order Link'}</span>
      </button>

      {/* WhatsApp share — only shown once link exists */}
      {url && (
        <button
          type="button"
          onClick={handleShare}
          title="Send portal link via WhatsApp"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            border: '1.5px solid #86efac', cursor: 'pointer',
            background: '#f0fdf4', color: '#15803d', whiteSpace: 'nowrap',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.47 0 .14 5.33.14 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.57 0 11.9-5.33 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42zM12.05 21.5h-.01a9.6 9.6 0 0 1-4.9-1.34l-.35-.21-3.75.98 1-3.66-.23-.38a9.55 9.55 0 0 1-1.48-5.1c0-5.28 4.3-9.58 9.6-9.58 2.56 0 4.97 1 6.78 2.81a9.5 9.5 0 0 1 2.8 6.78c0 5.28-4.3 9.58-9.46 9.58z"/>
          </svg>
          <span>Share</span>
        </button>
      )}
    </div>
  );
}

/* ── Onboarded Clients view ──────────────────────────────────── */
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function OnboardedClientsView({ search }) {
  const navigate = useNavigate();
  const { setClient, clearCart } = useQuoteBuilder();
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/api/clients/onboarded')
      .then(({ data }) => { if (!cancelled) setClients(data.clients || []); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || 'Failed to load onboarded clients'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const q = (search || '').trim().toLowerCase();
  const filtered = q
    ? clients.filter((c) =>
        (c.business_name || '').toLowerCase().includes(q) ||
        (c.contact_name  || '').toLowerCase().includes(q) ||
        (c.phone         || '').includes(q))
    : clients;

  // Pre-fill the quote builder with this client and jump to the builder.
  // The builder then fetches their billed-price history automatically.
  const startNewOrder = (c) => {
    clearCart();
    setClient({
      client_name:          c.contact_name  || '',
      client_business_name: c.business_name || '',
      client_type:          c.client_type   || '',
      client_phone:         c.phone         || '',
      client_email:         c.email         || '',
      client_city:          c.city          || '',
      requirement_type:     '',
      notes:                '',
      validity_days:        7,
    });
    toast(`🔒 Repeat order for ${c.business_name || c.contact_name} — previous prices will apply.`, { kind: 'success' });
    navigate('/quotes/new');
  };

  if (loading) return <SkeletonCards count={4} height={80} />;
  if (error)   return <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-4 text-sm">{error}</div>;

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="text-4xl mb-3">✅</div>
        <div className="font-bold text-slate-700">No onboarded clients yet</div>
        <div className="text-sm text-slate-500 mt-1">
          {q ? 'No onboarded clients match your search.' : 'Clients appear here once their first bill is generated.'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Client', 'City', 'Onboarded Since', 'Orders', 'Total Billed', 'Outstanding', 'Last Order', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const tc = typeColor(c.client_type);
              return (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">{c.business_name || c.contact_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.business_name && c.contact_name && (
                        <span className="text-xs text-slate-500">{c.contact_name}</span>
                      )}
                      {c.client_type && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                              style={{ background: tc.bg, color: tc.text }}>{c.client_type}</span>
                      )}
                    </div>
                    {c.phone && <div className="text-[11px] text-slate-400 mt-0.5">📞 {c.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{c.city || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{fmtDate(c.onboarded_at)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{c.order_count}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{fmtINR(c.total_billed)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.outstanding > 0
                      ? <span className="font-bold text-rose-600">{fmtINR(c.outstanding)}</span>
                      : <span className="text-[11px] font-bold text-emerald-600">✓ Cleared</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(c.last_order_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startNewOrder(c)}
                        title="Start a repeat order — their previous billed prices apply automatically"
                        className="whitespace-nowrap text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                        style={{ background: 'linear-gradient(135deg, #059669, #047857)', border: 'none', cursor: 'pointer' }}
                      >
                        🔒 New Order
                      </button>
                      {c.client_id && (
                        <Link
                          to={`/clients/${c.client_id}`}
                          className="whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                          style={{ textDecoration: 'none' }}
                        >
                          View
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Shared Catalogues view (visible to associates too) ──────── */
function SharedCataloguesView({ search, refreshKey }) {
  const { toast } = useToast();
  const [shares,  setShares]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [copied,  setCopied]  = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/api/catalog/shares')
      .then(({ data }) => { if (!cancelled) setShares(data.shares || []); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || 'Failed to load shared catalogues'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const q = (search || '').trim().toLowerCase();
  const filtered = q
    ? shares.filter((s) =>
        (s.business_name || '').toLowerCase().includes(q) ||
        (s.poc_name      || '').toLowerCase().includes(q) ||
        (s.contact       || '').includes(q) ||
        (s.location      || '').toLowerCase().includes(q))
    : shares;

  const copyLink = (token) => {
    const url = `${window.location.origin}/catalog/${token}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2500);
      toast('🔗 Catalogue link copied!', { kind: 'success' });
    }).catch(() => {});
  };

  if (loading) return <SkeletonCards count={4} height={70} />;
  if (error)   return <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-4 text-sm">{error}</div>;

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="text-4xl mb-3">📋</div>
        <div className="font-bold text-slate-700">No catalogues shared yet</div>
        <div className="text-sm text-slate-500 mt-1">
          {q ? 'No shared catalogues match your search.'
             : 'Click "📋 Share Catalogue" above to generate a personalised catalogue link for a client.'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Business Name', 'POC Name', 'Contact', 'Location', 'Shared By', 'Date Shared', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-bold text-slate-900">{s.business_name || '—'}</td>
                <td className="px-4 py-3 text-slate-700">{s.poc_name || '—'}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{s.contact || '—'}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{s.location || '—'}</td>
                <td className="px-4 py-3">
                  <div className="text-xs font-semibold text-slate-700">{s.associate_name || '—'}</div>
                  {s.associate_phone && <div className="text-[11px] text-slate-400">{s.associate_phone}</div>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(s.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(`/catalog/${s.token}`, '_blank')}
                      className="whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      style={{ cursor: 'pointer' }}
                    >
                      👁️ View
                    </button>
                    <button
                      type="button"
                      onClick={() => copyLink(s.token)}
                      className={`whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                        copied === s.token
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      {copied === s.token ? '✓ Copied!' : '🔗 Copy Link'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
export default function Clients() {
  const [clients, setClients]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [debouncedQ, setDQ]       = useState('');
  const [sortBy, setSortBy]       = useState('last_quote_at');
  const [error, setError]         = useState('');
  const [showOnboard,      setShowOnboard]      = useState(false);
  const [showShareCatalog, setShowShareCatalog] = useState(false);
  const [catalogLinkCopied, setCatalogLinkCopied] = useState(false);
  const [view, setView] = useState('all'); // 'all' | 'onboarded' | 'catalogues'
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);

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

  const totalRevenue  = clients.reduce((s, c) => s + Number(c.total_billed || 0), 0);
  const totalClients  = clients.length;
  const activeClients = clients.filter((c) => {
    const days = (Date.now() - new Date(c.last_quote_at).getTime()) / 86400000;
    return days <= 90;
  }).length;

  return (
    <div className="space-y-5">

      <OnboardModal
        open={showOnboard}
        onClose={() => setShowOnboard(false)}
        onSaved={fetchClients}
      />

      {showShareCatalog && (
        <ShareCatalogModal
          onClose={() => setShowShareCatalog(false)}
          onCreated={(url) => {
            setShowShareCatalog(false);
            setCatalogLinkCopied(true);
            setTimeout(() => setCatalogLinkCopied(false), 4000);
            // Show the new share immediately in the Catalogues view
            setCatalogRefreshKey((k) => k + 1);
            setView('catalogues');
          }}
        />
      )}

      {/* Header — gradient hero */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: radii.xl, padding: '20px 22px', background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', boxShadow: shadow.md }}>
        <div style={{ position: 'absolute', right: -36, top: -46, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-.02em', margin: 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9M15 21V9"/></svg>
                </span>
                Client Directory
              </h2>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.9)', marginTop: 5 }}>All clients with their complete order &amp; payment history</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {catalogLinkCopied && (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(34,197,94,.85)', padding: '6px 14px', borderRadius: 20 }}>✓ Link copied!</span>
              )}
              <button onClick={() => setShowShareCatalog(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 11, fontSize: 13, fontWeight: 800,
                  background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', cursor: 'pointer', backdropFilter: 'blur(6px)' }}>
                📋 Share Catalogue
              </button>
              <button onClick={() => setShowOnboard(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 11, fontSize: 13, fontWeight: 800,
                  background: '#fff', color: '#7c3aed', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.15)' }}>
                ➕ Onboard Client
              </button>
            </div>
          </div>
          {/* Stat chips */}
          <div className="flex gap-2.5 flex-wrap">
            {[
              { label: 'Total Clients', value: totalClients },
              { label: 'Active (90d)', value: activeClients },
              { label: 'Total Billed', value: fmtINR(totalRevenue) },
            ].map((s) => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,.16)', borderRadius: 12, padding: '9px 16px', backdropFilter: 'blur(6px)' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,.85)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* View toggle + search + sort bar */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex rounded-xl border border-slate-300 overflow-hidden bg-white text-sm font-semibold">
          <button
            type="button"
            onClick={() => setView('all')}
            className={view === 'all'
              ? 'px-4 py-2.5 bg-cyan-600 text-white'
              : 'px-4 py-2.5 text-slate-600 hover:bg-slate-50'}
          >
            All Clients
          </button>
          <button
            type="button"
            onClick={() => setView('onboarded')}
            className={view === 'onboarded'
              ? 'px-4 py-2.5 bg-emerald-600 text-white'
              : 'px-4 py-2.5 text-slate-600 hover:bg-slate-50 border-l border-slate-300'}
          >
            ✅ Onboarded
          </button>
          <button
            type="button"
            onClick={() => setView('catalogues')}
            className={view === 'catalogues'
              ? 'px-4 py-2.5 bg-blue-700 text-white'
              : 'px-4 py-2.5 text-slate-600 hover:bg-slate-50 border-l border-slate-300'}
          >
            📋 Catalogues
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, business, phone…"
          className="flex-1 min-w-[200px] border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
        />
        {view === 'all' && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white text-slate-700 font-medium"
          >
            <option value="last_quote_at">Sort: Recent</option>
            <option value="total_billed">Sort: Revenue</option>
            <option value="quote_count">Sort: Orders</option>
          </select>
        )}
      </div>

      {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-4 text-sm">{error}</div>}

      {view === 'catalogues' ? (
        <SharedCataloguesView search={search} refreshKey={catalogRefreshKey} />
      ) : view === 'onboarded' ? (
        <OnboardedClientsView search={search} />
      ) : loading ? (
        <SkeletonCards count={6} height={130} />
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
            const tc      = typeColor(c.client_type);
            const hasNotes = !!c.client_notes;
            const paid    = Number(c.paid_bills    || 0);
            const partial = Number(c.partial_bills || 0);
            const pending = Number(c.pending_bills || 0);
            const balance = Number(c.total_billed  || 0) - Number(c.total_paid || 0);
            const lastDays = Math.floor((Date.now() - new Date(c.last_quote_at).getTime()) / 86400000);

            return (
              <div key={i} style={{ position: 'relative' }}>
                <Link
                  to={c.client_id ? `/clients/${c.client_id}` : '#'}
                  onClick={async (e) => {
                    if (!c.client_id) {
                      e.preventDefault();
                      try {
                        const { data } = await api.post('/api/clients/upsert', {
                          client_name:          c.contact_name,
                          client_business_name: c.business_name,
                          client_phone:         c.phone,
                          client_email:         c.email,
                          client_city:          c.city,
                          client_type:          c.client_type,
                        });
                        window.location.href = `/clients/${data.client.id}`;
                      } catch { /* silent */ }
                    }
                  }}
                  style={{ textDecoration: 'none', display: 'block', height: '100%' }}
                >
                  <div className="prod-card" style={{
                    background: '#fff', border: `1px solid ${colors.border}`, borderRadius: radii.lg,
                    padding: 14, height: '100%', boxShadow: shadow.sm, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                  }}>

                    {/* Top row — avatar + identity + balance */}
                    <div className="flex items-start gap-3 mb-3">
                      <div style={{
                        width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                        background: avatarGrad(c.client_type), color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 16, boxShadow: shadow.sm,
                      }}>{clientInitials(c.business_name || c.contact_name)}</div>

                      <div className="flex-1 min-w-0">
                        <div style={{ fontWeight: 800, fontSize: 14, color: colors.ink }} className="truncate">
                          {c.business_name || c.contact_name}
                        </div>
                        {c.business_name && (
                          <div className="text-xs truncate" style={{ color: colors.sub }}>{c.contact_name}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {c.client_type && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                                  style={{ background: tc.bg, color: tc.text }}>{c.client_type}</span>
                          )}
                          {c.city && <span className="text-[10px]" style={{ color: colors.faint }}>📍 {c.city}</span>}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        {balance > 0 ? (
                          <>
                            <div style={{ fontSize: 15, fontWeight: 900, color: '#dc2626' }}>
                              ₹{new Intl.NumberFormat('en-IN').format(Math.round(balance))}
                            </div>
                            <div className="text-[10px]" style={{ color: '#f87171' }}>outstanding</div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 15, fontWeight: 900, color: colors.ink }}>{fmtINR(c.total_billed)}</div>
                            <div className="text-[10px]" style={{ color: colors.faint }}>billed</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs mb-2.5" style={{ color: colors.body }}>
                      <span>🧾 <strong>{c.quote_count}</strong> quotes</span>
                      <span>🏷 <strong>{c.bill_count}</strong> bills</span>
                      <span style={{ fontWeight: 600, color: lastDays <= 30 ? '#16a34a' : lastDays <= 90 ? '#d97706' : colors.faint }}>
                        {lastDays === 0 ? 'Today' : lastDays === 1 ? 'Yesterday' : `${lastDays}d ago`}
                      </span>
                      {hasNotes && <span style={{ color: colors.purple }}>📝</span>}
                    </div>

                    {/* Payment behaviour */}
                    <div className="mb-2.5">
                      <PayBehavior paid={paid} partial={partial} pending={pending} />
                    </div>

                    {/* Quick actions — pinned to bottom */}
                    <div style={{ marginTop: 'auto', display: 'flex', gap: 7, alignItems: 'center' }}>
                      {c.phone && (
                        <>
                          <button type="button" onClick={(e) => callClient(e, c.phone)} title={`Call ${c.phone}`}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                              padding: '7px 11px', borderRadius: 9, fontSize: 11.5, fontWeight: 700,
                              background: '#EFF6FF', color: '#1d4ed8', border: '1px solid #bfdbfe', cursor: 'pointer' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>
                            Call
                          </button>
                          <button type="button" onClick={(e) => waClient(e, c.phone, c.business_name || c.contact_name)} title="WhatsApp"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              padding: '7px 10px', borderRadius: 9, fontSize: 11.5, fontWeight: 700,
                              background: '#F0FDF4', color: '#15803d', border: '1px solid #86efac', cursor: 'pointer' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.47 0 .14 5.33.14 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.57 0 11.9-5.33 11.9-11.9 0-3.18-1.24-6.17-3.43-8.42zM12.05 21.5h-.01a9.6 9.6 0 0 1-4.9-1.34l-.35-.21-3.75.98 1-3.66-.23-.38a9.55 9.55 0 0 1-1.48-5.1c0-5.28 4.3-9.58 9.6-9.58 2.56 0 4.97 1 6.78 2.81a9.5 9.5 0 0 1 2.8 6.78c0 5.28-4.3 9.58-9.46 9.58z"/></svg>
                          </button>
                        </>
                      )}
                      <div style={{ flex: 1 }} />
                      <PortalLinkBtn client={c} />
                    </div>

                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
