import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ClientTypeBadge } from '../components/leads/badges';
import { SkeletonCards, SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { colors, gradients, radii, shadow, font, tint } from '../theme/tokens';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const compactINR = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return formatINR(v);
};

const formatDate = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  const d = s.length === 10 ? new Date(s + 'T00:00:00') : new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const greetingForHour = (h) => h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

// ── Icons (white stroke) ─────────────────────────────────────
const Icon = ({ d, size = 18, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>{d}</svg>
);
const DocIcon   = (p) => <Icon {...p} d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>} />;
const CalIcon   = (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />;
const UsrIcon   = (p) => <Icon {...p} d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>} />;
const PctIcon   = (p) => <Icon {...p} d={<><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>} />;
const RupeeIcon = (p) => <Icon {...p} d={<><path d="M6 3h12M6 8h12M9 13c4 0 6-2 6-5M6 13h6l6 8" /></>} />;
const BoxIcon   = (p) => <Icon {...p} d={<><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>} />;
const PhoneIcon = (p) => <Icon {...p} d={<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />} />;
const ChartIcon = (p) => <Icon {...p} d={<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>} />;

const STATUS_BG = {
  draft:    'bg-slate-100 text-slate-700',
  sent:     'bg-cyan-100 text-cyan-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-700',
};

// ── Premium gradient stat card ───────────────────────────────
const StatCard = ({ label, value, sub, icon, gradient, trend }) => (
  <div style={{
    position: 'relative', overflow: 'hidden', borderRadius: radii.lg,
    padding: '15px 15px 14px', color: '#fff', background: gradient,
    boxShadow: shadow.md, minWidth: 0,
  }}>
    <div style={{ position: 'absolute', right: -22, top: -22, width: 86, height: 86, borderRadius: '50%', background: 'rgba(255,255,255,.16)' }} />
    <div style={{ position: 'absolute', right: 8, bottom: -26, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,.10)' }} />
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        {trend && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
            background: 'rgba(255,255,255,.22)',
          }}>
            <span aria-hidden="true">{trend.up ? '▲' : trend.down ? '▼' : '→'}</span>{trend.label}
          </span>
        )}
      </div>
      <div style={{ ...font.kpi, marginTop: 12 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: .95, marginTop: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, opacity: .88, marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

// ── Reusable section card ────────────────────────────────────
const Section = ({ title, hint, accent = colors.primary, icon, right, children, pad = true }) => (
  <section style={{ background: colors.card, borderRadius: radii.lg, border: `1px solid ${colors.border}`, boxShadow: shadow.sm, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${colors.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {icon && (
          <div style={{ width: 30, height: 30, borderRadius: 9, background: tint(accent, .14), color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ ...font.h2, color: colors.ink }}>{title}</div>
          {hint && <div style={{ fontSize: 11, color: colors.sub, marginTop: 1 }}>{hint}</div>}
        </div>
      </div>
      {right}
    </div>
    <div style={pad ? { padding: 14 } : undefined}>{children}</div>
  </section>
);

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stats, setStats]                   = useState(null);
  const [recent, setRecent]                 = useState([]);
  const [pendingPayments, setPending]       = useState([]);
  const [followUpsDue, setFollowUpsDue]     = useState([]);
  const [rescheduling, setRescheduling]     = useState({}); // leadId → 'date' string
  const [actionLoading, setActionLoading]   = useState({}); // leadId → bool
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');

  const loadFollowUps = async () => {
    try {
      const { data } = await api.get('/api/leads/followups/due');
      setFollowUpsDue(data.leads || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    (async () => {
      try {
        const [sRes, qRes, pyRes] = await Promise.all([
          api.get('/api/dashboard/stats'),
          api.get('/api/quotes'),
          api.get('/api/bills/payment-pending'),
        ]);
        setStats(sRes.data.stats);
        setRecent((qRes.data.quotes || []).slice(0, 5));
        setPending(pyRes.data.bills || []);
      } catch (e) {
        setError(e?.response?.data?.error || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
    loadFollowUps();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark a follow-up as done — clears the date so it leaves the list
  const markDone = async (leadId) => {
    setActionLoading((p) => ({ ...p, [leadId]: true }));
    try {
      await api.patch(`/api/leads/${leadId}`, { follow_up_date: null, follow_up_note: null });
      setFollowUpsDue((p) => p.filter((l) => l.id !== leadId));
    } catch { /* toast not needed — silent retry */ }
    finally { setActionLoading((p) => ({ ...p, [leadId]: false })); }
  };

  // Save a rescheduled date
  const saveReschedule = async (leadId) => {
    const newDate = rescheduling[leadId];
    if (!newDate) return;
    setActionLoading((p) => ({ ...p, [leadId]: true }));
    try {
      await api.patch(`/api/leads/${leadId}`, { follow_up_date: newDate });
      setFollowUpsDue((p) => p.filter((l) => l.id !== leadId)); // remove from due list
      setRescheduling((p) => { const n = { ...p }; delete n[leadId]; return n; });
    } catch { /* silent */ }
    finally { setActionLoading((p) => ({ ...p, [leadId]: false })); }
  };

  const greeting = useMemo(() => {
    const first = user?.name?.split(/\s+/)[0] || '';
    return `${greetingForHour(new Date().getHours())}, ${first}`;
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div style={{ background: gradients.hero, borderRadius: radii.xl, padding: 22 }}>
          <div className="animate-pulse space-y-2">
            <div className="h-5 w-48 rounded" style={{ background: 'rgba(255,255,255,.35)' }} />
            <div className="h-3 w-72 rounded" style={{ background: 'rgba(255,255,255,.22)' }} />
          </div>
        </div>
        <SkeletonCards count={4} height={104} />
        <SkeletonTable rows={5} cols={7} />
      </div>
    );
  }
  if (error) return <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-4 text-sm">{error}</div>;

  const today = stats.quotes.today.count;
  const yesterday = stats.quotes.yesterday?.count ?? 0;
  const diff = today - yesterday;
  const trend = today === yesterday
    ? { label: 'same' }
    : diff > 0
      ? { up: true, label: `+${diff}` }
      : { down: true, label: `${diff}` };

  const followUps = stats.leads.follow_ups_today || 0;
  const tagline = followUps > 0
    ? `You have ${followUps} ${followUps === 1 ? 'lead' : 'leads'} to follow up today.`
    : 'No follow-ups today — a great day to chase new leads.';

  const todayDate = new Date().toLocaleDateString('en-IN',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const topProductsData = (stats.top_products || []).map((p) => ({
    name: p.product.length > 22 ? p.product.slice(0, 22) + '…' : p.product,
    full: p.product,
    quantity: p.quantity,
    revenue: p.revenue,
  }));

  const pendingTotal = pendingPayments.reduce((s, b) => s + Number(b.total_amount || 0), 0);

  // Quick actions — link only to existing, accessible routes
  const quickActions = [
    { to: '/quotes/new', label: 'New Quote', grad: gradients.blue,   icon: <DocIcon size={20} /> },
    { to: '/clients',    label: 'Customers', grad: gradients.purple, icon: <UsrIcon size={20} /> },
    { to: '/leads',      label: 'Follow-ups', grad: gradients.orange, icon: <PhoneIcon size={20} /> },
    { to: '/products',   label: 'Products',  grad: gradients.green,  icon: <BoxIcon size={20} /> },
    ...(isAdmin ? [{ to: '/admin?tab=reports', label: 'Reports', grad: gradients.cyan, icon: <ChartIcon size={20} /> }] : []),
  ];

  return (
    <div style={{ fontFamily: font.family }} className="space-y-5">

      {/* ── HERO ── */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: radii.xl, padding: '22px 22px 20px', background: gradients.hero, boxShadow: shadow.lg }}>
        <div style={{ position: 'absolute', right: -40, top: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.10)' }} />
        <div style={{ position: 'absolute', right: 60, bottom: -70, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>{todayDate}</div>
            <h1 style={{ ...font.display, color: '#fff', marginTop: 4 }}>{greeting} <span style={{ fontSize: 24 }}>👋</span></h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.9)', marginTop: 6, maxWidth: 520 }}>{tagline}</p>
          </div>
          {user?.region && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: 12, fontWeight: 700,
              padding: '7px 14px', borderRadius: 999, backdropFilter: 'blur(6px)',
            }}>📍 {user.region}</span>
          )}
        </div>
      </div>

      {/* ── PERFORMANCE STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <StatCard label="Quotes Today" value={today} sub={formatINR(stats.quotes.today.value)} icon={<DocIcon />} gradient={gradients.blue} trend={trend} />
        <StatCard label="This Month" value={stats.quotes.month.count} sub={compactINR(stats.quotes.month.value)} icon={<CalIcon />} gradient={gradients.purple} />
        <StatCard label="Active Leads" value={stats.leads.active ?? 0} sub={`${stats.leads.total ?? 0} total`} icon={<UsrIcon />} gradient={gradients.green} />
        <StatCard label="Conversion" value={`${stats.leads.conversion_rate ?? 0}%`} sub={`${stats.leads.converted ?? 0} converted`} icon={<PctIcon />} gradient={gradients.orange} />
        <StatCard label="Pending Pay" value={pendingPayments.length} sub={compactINR(pendingTotal)} icon={<RupeeIcon />} gradient={gradients.red} />
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 10 }}>
        {quickActions.map((a) => (
          <Link key={a.to} to={a.to} style={{
            background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radii.md,
            padding: '14px 8px 11px', textDecoration: 'none', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            boxShadow: shadow.sm,
          }}>
            <span style={{ width: 44, height: 44, borderRadius: 13, background: a.grad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadow.sm }}>{a.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: colors.ink }}>{a.label}</span>
          </Link>
        ))}
      </div>

      {/* ── FOLLOW-UPS DUE ── */}
      {followUpsDue.length > 0 && (
        <Section
          title="Follow-ups Due"
          hint={`${followUpsDue.length} lead${followUpsDue.length !== 1 ? 's' : ''} need attention`}
          accent={colors.orange}
          icon={<PhoneIcon size={16} />}
          right={<Link to="/leads" style={{ fontSize: 12, fontWeight: 700, color: colors.primary, textDecoration: 'none' }}>View all →</Link>}
          pad={false}
        >
          {followUpsDue.map((l, i) => {
            const dueDate = l.follow_up_date ? new Date(l.follow_up_date + 'T00:00:00') : null;
            const todayD  = new Date(); todayD.setHours(0,0,0,0);
            const daysOverdue = dueDate ? Math.floor((todayD - dueDate) / 86400000) : 0;
            const isOverdue  = daysOverdue > 0;
            const isRescheduling = rescheduling[l.id] !== undefined;
            const busy = actionLoading[l.id];

            return (
              <div key={l.id} style={{ padding: '12px 16px', borderTop: i > 0 ? `1px solid ${colors.border}` : 'none' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span style={{ fontWeight: 800, fontSize: 13.5, color: colors.ink }} className="truncate">
                        {l.client_business_name || l.client_name}
                      </span>
                      {isOverdue ? (
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: tint(colors.red, .12), color: '#b91c1c' }}>{daysOverdue}d overdue</span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: tint(colors.green, .14), color: '#15803d' }}>Due today</span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: colors.sub, textTransform: 'capitalize' }}>{l.status}</span>
                    </div>
                    {l.follow_up_note && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: colors.primary, marginBottom: 3 }}>📌 {l.follow_up_note}</div>
                    )}
                    <div style={{ fontSize: 12, color: colors.sub }}>
                      {l.client_name}{l.client_city ? ` · ${l.client_city}` : ''}
                      {isAdmin && l.employee_name ? ` · 👤 ${l.employee_name}` : ''}
                      {l.quote_total ? ` · ${formatINR(l.quote_total)}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {isRescheduling ? (
                      <>
                        <input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={rescheduling[l.id] || ''}
                          onChange={(e) => setRescheduling((p) => ({ ...p, [l.id]: e.target.value }))}
                          className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2"
                          style={{ borderColor: '#c7d2fe' }}
                        />
                        <button disabled={!rescheduling[l.id] || busy} onClick={() => saveReschedule(l.id)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                          style={{ background: colors.primary, color: '#fff' }}>{busy ? '…' : 'Save'}</button>
                        <button onClick={() => setRescheduling((p) => { const n = { ...p }; delete n[l.id]; return n; })}
                          className="text-xs font-semibold px-2 py-1.5 rounded-lg border"
                          style={{ borderColor: colors.border, color: colors.sub }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button disabled={busy} onClick={() => markDone(l.id)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                          style={{ background: tint(colors.green, .14), color: '#15803d', border: '1px solid #86efac' }}>{busy ? '…' : '✓ Done'}</button>
                        <button onClick={() => setRescheduling((p) => ({ ...p, [l.id]: '' }))}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{ background: tint(colors.primary, .1), color: colors.primary, border: '1px solid #c7d2fe' }}>📅 Reschedule</button>
                        <Link to="/leads" className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{ background: '#f8fafc', color: colors.sub, border: `1px solid ${colors.border}`, textDecoration: 'none' }}>Open</Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {/* ── PAYMENT PENDING ── */}
      {pendingPayments.length > 0 && (
        <Section
          title="Pending Payments"
          hint={`${pendingPayments.length} bill${pendingPayments.length !== 1 ? 's' : ''} awaiting collection`}
          accent={colors.red}
          icon={<RupeeIcon size={16} />}
          right={<span style={{ fontSize: 14, fontWeight: 900, color: '#b91c1c' }}>{compactINR(pendingTotal)}</span>}
          pad={false}
        >
          {pendingPayments.map((b, i) => {
            const age = Math.floor((Date.now() - new Date(b.created_at).getTime()) / 86400000);
            return (
              <div key={b.id} className="flex items-center justify-between gap-3"
                style={{ padding: '12px 16px', borderTop: i > 0 ? `1px solid ${colors.border}` : 'none' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: colors.ink }} className="truncate">{b.client_business_name || b.client_name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 6,
                      background: age >= 14 ? tint(colors.red, .12) : age >= 7 ? tint(colors.orange, .14) : '#fef3c7',
                      color: age >= 14 ? '#991b1b' : age >= 7 ? '#9a3412' : '#92400e' }}>{age}d ago</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: colors.sub, marginTop: 1, fontFamily: 'monospace' }}>{b.bill_number}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span style={{ fontWeight: 800, fontSize: 13.5, color: colors.ink }}>{formatINR(b.total_amount)}</span>
                  <Link to={`/bills/${b.id}`} className="text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: gradients.orange, color: '#fff', textDecoration: 'none' }}>Collect</Link>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {/* ── RECENT QUOTES + TOP PRODUCTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <Section
            title="Recent Quotes" accent={colors.primary} icon={<DocIcon size={16} />}
            right={<Link to="/quotes" style={{ fontSize: 12, fontWeight: 700, color: colors.primary, textDecoration: 'none' }}>View all →</Link>}
            pad={false}
          >
            {recent.length === 0 ? (
              <div className="p-4">
                <EmptyState icon="quote" title="No quotes yet"
                  hint="Start by building your first quote — leads are auto-created from every quote."
                  action={<Link to="/quotes/new" className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: gradients.blue }}>+ New Quote</Link>} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: '#F7FAFF' }} className="text-xs uppercase tracking-wide" >
                    <tr style={{ color: colors.sub }}>
                      <th className="text-left px-3 py-2.5">Quote No.</th>
                      <th className="text-left px-3 py-2.5">Client</th>
                      <th className="text-left px-3 py-2.5">Type</th>
                      <th className="text-right px-3 py-2.5">Total</th>
                      <th className="text-left px-3 py-2.5">Status</th>
                      <th className="text-left px-3 py-2.5">Date</th>
                      <th className="text-right px-3 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50" style={{ borderTop: `1px solid ${colors.border}` }}>
                        <td className="px-3 py-2.5 font-bold" style={{ color: colors.primary }}>{q.quote_number}</td>
                        <td className="px-3 py-2.5">
                          <div style={{ fontWeight: 700, color: colors.ink }}>{q.client_business_name || q.client_name}</div>
                          <div className="text-[11px]" style={{ color: colors.sub }}>{q.client_name} · {q.client_city || '—'}</div>
                        </td>
                        <td className="px-3 py-2.5"><ClientTypeBadge type={q.client_type} /></td>
                        <td className="px-3 py-2.5 text-right font-bold" style={{ color: colors.ink }}>{formatINR(q.total_amount)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_BG[q.status] || 'bg-slate-100 text-slate-700'}`}>{q.status}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: colors.sub }}>{formatDate(q.created_at)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Link to={`/quotes/${q.id}`} className="text-xs font-semibold px-3 py-1 rounded-lg"
                            style={{ background: tint(colors.primary, .1), color: colors.primary, textDecoration: 'none' }}>View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="lg:col-span-2">
          <Section title="Top Products" hint="By units in quotes this month" accent={colors.green} icon={<BoxIcon size={16} />}>
            {topProductsData.length === 0 ? (
              <div className="py-6 text-sm text-center" style={{ color: colors.sub }}>No product data yet.</div>
            ) : (
              <>
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={topProductsData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#22C55E" />
                          <stop offset="100%" stopColor="#06B6D4" />
                        </linearGradient>
                      </defs>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: colors.body }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: tint(colors.green, .08) }}
                        formatter={(val, key) => key === 'quantity' ? [`${val} units`, 'Qty'] : [formatINR(val), 'Revenue']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.full} />
                      <Bar dataKey="quantity" radius={[0, 7, 7, 0]} barSize={18}>
                        {topProductsData.map((_, i) => <Cell key={i} fill="url(#barGrad)" />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 text-xs space-y-1" style={{ color: colors.body }}>
                  {topProductsData.map((p) => (
                    <li key={p.full} className="flex items-center justify-between pt-1" style={{ borderTop: `1px solid ${colors.border}` }}>
                      <span className="truncate pr-2">{p.full}</span>
                      <span style={{ color: colors.sub }}>{p.quantity} u · {formatINR(p.revenue)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        </div>
      </div>

      {/* ── ADMIN — ASSOCIATE PERFORMANCE ── */}
      {isAdmin && (
        <Section title="Associate Performance" hint="All-time totals" accent={colors.purple} icon={<UsrIcon size={16} />} pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#F7FAFF' }} className="text-xs uppercase tracking-wide">
                <tr style={{ color: colors.sub }}>
                  <th className="text-left px-3 py-2.5">Associate</th>
                  <th className="text-left px-3 py-2.5">Region</th>
                  <th className="text-right px-3 py-2.5">Quotes</th>
                  <th className="text-right px-3 py-2.5">Total Value</th>
                  <th className="text-right px-3 py-2.5">Leads</th>
                  <th className="text-right px-3 py-2.5">Conversions</th>
                  <th className="text-right px-3 py-2.5">Conv. %</th>
                </tr>
              </thead>
              <tbody>
                {(stats.associate_performance || []).map((a) => {
                  const convPct = a.leads_count ? +((a.conversions / a.leads_count) * 100).toFixed(1) : 0;
                  return (
                    <tr key={a.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                      <td className="px-3 py-2.5">
                        <div style={{ fontWeight: 700, color: colors.ink }}>{a.name}</div>
                        <div className="text-[11px]" style={{ color: colors.sub }}>{a.employee_id}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: colors.body }}>{a.region || '—'}</td>
                      <td className="px-3 py-2.5 text-right">{a.quotes_count}</td>
                      <td className="px-3 py-2.5 text-right font-bold" style={{ color: colors.ink }}>{formatINR(a.quote_value)}</td>
                      <td className="px-3 py-2.5 text-right">{a.leads_count}</td>
                      <td className="px-3 py-2.5 text-right">{a.conversions}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={[
                          'inline-block text-[11px] font-bold px-2 py-0.5 rounded-full',
                          convPct >= 30 ? 'bg-emerald-100 text-emerald-800' :
                          convPct > 0   ? 'bg-amber-100 text-amber-800'      :
                                          'bg-slate-100 text-slate-600',
                        ].join(' ')}>{convPct}%</span>
                      </td>
                    </tr>
                  );
                })}
                {(stats.associate_performance || []).length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-sm" style={{ color: colors.sub }}>No associate data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
