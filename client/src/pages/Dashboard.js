import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ClientTypeBadge } from '../components/leads/badges';
import { SkeletonCards, SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const formatDate = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  const d = s.length === 10 ? new Date(s + 'T00:00:00') : new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const greetingForHour = (h) => h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

const StatCard = ({ label, value, sub, icon, trend }) => (
  <div className="rounded-xl p-4 text-white shadow-sm"
       style={{ background: 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)' }}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-cyan-50/85">{label}</div>
        <div className="text-3xl font-bold mt-1">{value}</div>
        {sub && <div className="text-[11px] text-cyan-50/85 mt-1">{sub}</div>}
      </div>
      <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">{icon}</div>
    </div>
    {trend && (
      <div className="mt-3 text-[11px] inline-flex items-center gap-1 bg-white/15 px-2 py-0.5 rounded-full">
        <span aria-hidden="true">{trend.up ? '▲' : trend.down ? '▼' : '→'}</span>
        <span>{trend.label}</span>
      </div>
    )}
  </div>
);

// Inline icons (24px white)
const Icon = ({ d, ...p }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>{d}</svg>
);
const DocIcon  = () => <Icon d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>} />;
const CalIcon  = () => <Icon d={<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />;
const UsrIcon  = () => <Icon d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>} />;
const PctIcon  = () => <Icon d={<><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>} />;

const STATUS_BG = {
  draft:    'bg-slate-100 text-slate-700',
  sent:     'bg-cyan-100 text-cyan-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-700',
};

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
    return `${greetingForHour(new Date().getHours())}, ${first} 👋`;
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="animate-pulse space-y-2">
            <div className="h-5 w-48 bg-slate-200 rounded" />
            <div className="h-3 w-72 bg-slate-100 rounded" />
          </div>
        </div>
        <SkeletonCards count={4} height={104} />
        <SkeletonTable rows={5} cols={7} />
      </div>
    );
  }
  if (error)   return <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-4 text-sm">{error}</div>;

  const today = stats.quotes.today.count;
  const yesterday = stats.quotes.yesterday?.count ?? 0;
  const diff = today - yesterday;
  const trend = today === yesterday
    ? { label: 'same as yesterday' }
    : diff > 0
      ? { up: true, label: `+${diff} vs yesterday` }
      : { down: true, label: `${diff} vs yesterday` };

  const followUps = stats.leads.follow_ups_today || 0;
  const tagline = followUps > 0
    ? `You have ${followUps} ${followUps === 1 ? 'lead' : 'leads'} to follow up today.`
    : 'No follow-ups scheduled for today — a great day to chase new leads.';

  const todayDate = new Date().toLocaleDateString('en-IN',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const topProductsData = (stats.top_products || []).map((p) => ({
    name: p.product.length > 22 ? p.product.slice(0, 22) + '…' : p.product,
    full: p.product,
    quantity: p.quantity,
    revenue: p.revenue,
  }));

  return (
    <div className="space-y-5">
      {/* GREETING */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{greeting}</h2>
            <p className="text-sm text-slate-500 mt-1">{todayDate} · {tagline}</p>
          </div>
          {user?.region && (
            <div className="text-xs bg-cyan-50 text-cyan-700 border border-cyan-200 px-3 py-1.5 rounded-full self-start sm:self-auto">
              Region: {user.region}
            </div>
          )}
        </div>
      </div>

      {/* ── FOLLOW-UP REMINDERS SECTION ── */}
      {followUpsDue.length > 0 && (
        <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#a5b4fc' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
               style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', borderBottom: '1px solid #c7d2fe' }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <span className="font-bold text-sm" style={{ color: '#3730a3' }}>
                Follow-ups Due — {followUpsDue.length} lead{followUpsDue.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: '#6366f1', color: '#fff' }}>
                Action Required
              </span>
            </div>
            <Link to="/leads" className="text-xs font-semibold" style={{ color: '#4338ca', textDecoration: 'none' }}>
              View all leads →
            </Link>
          </div>

          {/* Lead rows */}
          <div style={{ background: '#fff' }}>
            {followUpsDue.map((l, i) => {
              const dueDate = l.follow_up_date ? new Date(l.follow_up_date + 'T00:00:00') : null;
              const today   = new Date(); today.setHours(0,0,0,0);
              const daysOverdue = dueDate ? Math.floor((today - dueDate) / 86400000) : 0;
              const isOverdue  = daysOverdue > 0;
              const isRescheduling = rescheduling[l.id] !== undefined;
              const busy = actionLoading[l.id];

              return (
                <div key={l.id}
                     className="px-4 py-3"
                     style={{ borderBottom: i < followUpsDue.length - 1 ? '1px solid #eef2ff' : 'none' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    {/* Lead info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {l.client_business_name || l.client_name}
                        </span>
                        {isOverdue ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                style={{ background: '#fee2e2', color: '#991b1b' }}>
                            {daysOverdue}d overdue
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                style={{ background: '#dcfce7', color: '#15803d' }}>
                            Due today
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                              style={{ background: '#f1f5f9', color: '#475569' }}>
                          {l.status}
                        </span>
                      </div>
                      {/* Follow-up note */}
                      {l.follow_up_note && (
                        <div className="text-xs font-semibold mb-1" style={{ color: '#4338ca' }}>
                          📌 {l.follow_up_note}
                        </div>
                      )}
                      <div className="text-xs text-slate-500">
                        {l.client_name}{l.client_city ? ` · ${l.client_city}` : ''}
                        {isAdmin && l.employee_name ? ` · 👤 ${l.employee_name}` : ''}
                        {l.quote_total ? ` · ${formatINR(l.quote_total)}` : ''}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      {isRescheduling ? (
                        <>
                          <input
                            type="date"
                            min={new Date().toISOString().slice(0, 10)}
                            value={rescheduling[l.id] || ''}
                            onChange={(e) => setRescheduling((p) => ({ ...p, [l.id]: e.target.value }))}
                            className="border border-indigo-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                          <button
                            disabled={!rescheduling[l.id] || busy}
                            onClick={() => saveReschedule(l.id)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                            style={{ background: '#6366f1', color: '#fff' }}>
                            {busy ? '…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setRescheduling((p) => { const n = { ...p }; delete n[l.id]; return n; })}
                            className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-300 text-slate-600">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => markDone(l.id)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                            style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                            {busy ? '…' : '✓ Done'}
                          </button>
                          <button
                            onClick={() => setRescheduling((p) => ({ ...p, [l.id]: '' }))}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                            style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                            📅 Reschedule
                          </button>
                          <Link to="/leads"
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                                style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', textDecoration: 'none' }}>
                            Open
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PAYMENT PENDING ALERT SECTION ── */}
      {pendingPayments.length > 0 && (
        <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#fcd34d' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
               style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', borderBottom: '1px solid #fcd34d' }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">⏳</span>
              <span className="font-bold text-sm" style={{ color: '#92400e' }}>
                Payment Pending — {pendingPayments.length} bill{pendingPayments.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: '#f59e0b', color: '#fff' }}>
                Action Required
              </span>
            </div>
            <span className="text-sm font-bold" style={{ color: '#78350f' }}>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
                .format(pendingPayments.reduce((s, b) => s + Number(b.total_amount || 0), 0))}
            </span>
          </div>
          {/* Bill rows */}
          <div style={{ background: '#fff' }}>
            {pendingPayments.map((b, i) => {
              const age = Math.floor((Date.now() - new Date(b.created_at).getTime()) / 86400000);
              return (
                <div key={b.id}
                     className="flex items-center justify-between px-4 py-3 gap-3"
                     style={{ borderBottom: i < pendingPayments.length - 1 ? '1px solid #fef3c7' : 'none' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-800 truncate">
                        {b.client_business_name || b.client_name}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ background: age >= 14 ? '#fee2e2' : age >= 7 ? '#ffedd5' : '#fef3c7',
                                     color: age >= 14 ? '#991b1b' : age >= 7 ? '#9a3412' : '#92400e' }}>
                        {age}d ago
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">{b.bill_number}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold text-sm" style={{ color: '#0f172a' }}>
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
                        .format(b.total_amount)}
                    </span>
                    <Link to={`/bills/${b.id}`}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{ background: '#f59e0b', color: '#fff', textDecoration: 'none' }}>
                      Collect
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Quotes Today"
          value={today}
          sub={formatINR(stats.quotes.today.value)}
          icon={<DocIcon />}
          trend={trend}
        />
        <StatCard
          label="Quotes This Month"
          value={stats.quotes.month.count}
          sub={formatINR(stats.quotes.month.value)}
          icon={<CalIcon />}
        />
        <StatCard
          label="Active Leads"
          value={stats.leads.active ?? 0}
          sub={`${stats.leads.total ?? 0} total`}
          icon={<UsrIcon />}
        />
        <StatCard
          label="Conversion Rate"
          value={`${stats.leads.conversion_rate ?? 0}%`}
          sub={`${stats.leads.converted ?? 0} converted`}
          icon={<PctIcon />}
        />
      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center gap-3">
        <Link
          to="/quotes/new"
          className="flex-1 sm:flex-none text-center bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-lg shadow-sm w-full sm:w-auto"
        >+ New Quote</Link>
        <Link
          to="/leads"
          className="flex-1 sm:flex-none text-center border border-cyan-600 text-cyan-700 hover:bg-cyan-50 font-medium px-4 py-2.5 rounded-lg w-full sm:w-auto"
        >View All Leads</Link>
        <Link
          to="/products"
          className="flex-1 sm:flex-none text-center border border-cyan-600 text-cyan-700 hover:bg-cyan-50 font-medium px-4 py-2.5 rounded-lg w-full sm:w-auto"
        >Product Catalog</Link>
      </div>

      {/* RECENT QUOTES + TOP PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <section className="lg:col-span-3 bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Recent Quotes</h3>
            <Link to="/quotes" className="text-xs text-cyan-700 hover:underline">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon="quote"
                title="No quotes yet"
                hint="Start by building your first quote — leads are auto-created from every quote."
                action={<Link to="/quotes/new" className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg">+ New Quote</Link>}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">Quote No.</th>
                    <th className="text-left px-3 py-2">Client</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-right px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((q) => (
                    <tr key={q.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-900">{q.quote_number}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{q.client_business_name || q.client_name}</div>
                        <div className="text-[11px] text-slate-500">{q.client_name} · {q.client_city || '—'}</div>
                      </td>
                      <td className="px-3 py-2"><ClientTypeBadge type={q.client_type} /></td>
                      <td className="px-3 py-2 text-right font-medium">{formatINR(q.total_amount)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_BG[q.status] || 'bg-slate-100 text-slate-700'}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{formatDate(q.created_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          to={`/quotes/${q.id}`}
                          className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100"
                        >View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Top Products This Month</h3>
            <div className="text-[11px] text-slate-500">By units in quotes</div>
          </div>
          {topProductsData.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 text-center">No product data yet.</div>
          ) : (
            <div className="p-3">
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={topProductsData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 11, fill: '#475569' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#ECFEFF' }}
                      formatter={(val, key, payload) => key === 'quantity'
                        ? [`${val} units`, 'Qty']
                        : [formatINR(val), 'Revenue']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.full}
                    />
                    <Bar dataKey="quantity" radius={[0, 6, 6, 0]} barSize={18}>
                      {topProductsData.map((_, i) => (
                        <Cell key={i} fill="#0891B2" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 text-xs text-slate-600 space-y-1">
                {topProductsData.map((p) => (
                  <li key={p.full} className="flex items-center justify-between border-t border-slate-100 pt-1">
                    <span className="truncate pr-2">{p.full}</span>
                    <span className="text-slate-500">{p.quantity} u · {formatINR(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* ADMIN — ASSOCIATE PERFORMANCE */}
      {isAdmin && (
        <section className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Associate Performance</h3>
            <span className="text-[11px] text-slate-500">All-time totals</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">Associate</th>
                  <th className="text-left px-3 py-2">Region</th>
                  <th className="text-right px-3 py-2">Quotes</th>
                  <th className="text-right px-3 py-2">Total Value</th>
                  <th className="text-right px-3 py-2">Leads</th>
                  <th className="text-right px-3 py-2">Conversions</th>
                  <th className="text-right px-3 py-2">Conv. %</th>
                </tr>
              </thead>
              <tbody>
                {(stats.associate_performance || []).map((a) => {
                  const convPct = a.leads_count
                    ? +((a.conversions / a.leads_count) * 100).toFixed(1)
                    : 0;
                  return (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{a.name}</div>
                        <div className="text-[11px] text-slate-500">{a.employee_id}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{a.region || '—'}</td>
                      <td className="px-3 py-2 text-right">{a.quotes_count}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatINR(a.quote_value)}</td>
                      <td className="px-3 py-2 text-right">{a.leads_count}</td>
                      <td className="px-3 py-2 text-right">{a.conversions}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={[
                          'inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full',
                          convPct >= 30 ? 'bg-emerald-100 text-emerald-800' :
                          convPct > 0   ? 'bg-amber-100 text-amber-800'      :
                                          'bg-slate-100 text-slate-600',
                        ].join(' ')}>{convPct}%</span>
                      </td>
                    </tr>
                  );
                })}
                {(stats.associate_performance || []).length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">No associate data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
