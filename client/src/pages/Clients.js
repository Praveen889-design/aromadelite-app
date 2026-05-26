import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const typeColor = (t) => TYPE_COLOR[(t || '').toLowerCase()] || TYPE_COLOR.other;

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
      let clientId = client.client_id;

      // If no client record yet, auto-create it first
      if (!clientId) {
        const { data: upserted } = await api.post('/api/clients/upsert', {
          client_name:          client.contact_name,
          client_business_name: client.business_name,
          client_phone:         client.phone,
          client_email:         client.email,
          client_city:          client.city,
          client_type:          client.client_type,
        });
        clientId = upserted.client.id;
        onClientCreated && onClientCreated(clientId);
      }

      const { data: resp } = await api.post(`/api/clients/${clientId}/portal-link`);
      const link = resp.url;
      setUrl(link);
      navigator.clipboard?.writeText(link).catch(() => {});
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      /* silent */
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

/* ── Main page ───────────────────────────────────────────────── */
export default function Clients() {
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [debouncedQ, setDQ]     = useState('');
  const [sortBy, setSortBy]     = useState('last_quote_at');
  const [error, setError]       = useState('');

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
                  style={{ textDecoration: 'none', display: 'block' }}
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
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <PayBehavior paid={paid} partial={partial} pending={pending} />
                      {balance > 0 && (
                        <span className="text-[10px] font-bold text-rose-600 flex-shrink-0">
                          ₹{new Intl.NumberFormat('en-IN').format(Math.round(balance))} due
                        </span>
                      )}
                    </div>

                    {/* Notes indicator */}
                    {hasNotes && (
                      <div className="text-[10px] text-indigo-600 font-medium mb-1">📝 Has notes</div>
                    )}

                    {/* 🛒 Portal link button — stops click from navigating */}
                    <PortalLinkBtn client={c} />

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
