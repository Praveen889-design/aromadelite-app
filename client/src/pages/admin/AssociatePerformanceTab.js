import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

/* ─── Helpers ────────────────────────────────────────────── */
const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtK = (v) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
};

const pct = (a, b) => (b > 0 ? Math.min(100, +((a / b) * 100).toFixed(1)) : 0);

const initials = (name = '') =>
  name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

const AVATAR_COLORS = [
  { bg: '#eff6ff', fg: '#1d4ed8' },
  { bg: '#fdf4ff', fg: '#7e22ce' },
  { bg: '#f0fdf4', fg: '#15803d' },
  { bg: '#fff7ed', fg: '#c2410c' },
  { bg: '#fefce8', fg: '#a16207' },
];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

const MEDAL = ['🥇','🥈','🥉'];

/* ─── Sparkline ──────────────────────────────────────────── */
function Sparkline({ data, color = '#0891b2' }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.revenue);
  const max  = Math.max(...vals, 1);
  const W = 80, H = 28;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* last dot */}
      {(() => {
        const last = vals[vals.length - 1];
        const x = W;
        const y = H - (last / max) * H;
        return <circle cx={x} cy={y} r="3" fill={color} />;
      })()}
    </svg>
  );
}

/* ─── Progress bar ───────────────────────────────────────── */
function ProgBar({ value, max, color = '#0891b2', height = 6 }) {
  const p = pct(value, max);
  return (
    <div style={{ height, background: '#f1f5f9', borderRadius: height, overflow: 'hidden' }}>
      <div style={{
        width: `${p}%`, height: '100%', borderRadius: height,
        background: p >= 100 ? '#059669' : p >= 70 ? color : p >= 40 ? '#f59e0b' : '#ef4444',
        transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

/* ─── Stat pill ──────────────────────────────────────────── */
const Pill = ({ label, value, bg, text }) => (
  <div className="text-center px-3 py-2 rounded-lg" style={{ background: bg }}>
    <div className="text-sm font-bold" style={{ color: text }}>{value}</div>
    <div className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: text }}>{label}</div>
  </div>
);

/* ─── Rank badge ─────────────────────────────────────────── */
const RankBadge = ({ rank }) => {
  if (rank <= 3) return <span style={{ fontSize: 20 }}>{MEDAL[rank - 1]}</span>;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: '#f1f5f9', color: '#64748b',
      fontSize: 11, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>#{rank}</div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
export default function AssociatePerformanceTab() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data,  setData]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // associate id
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get('/api/reports/performance', { params: { year, month } });
      setData(res);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const associates = data?.associates || [];

  /* Summary totals */
  const totRevenue    = associates.reduce((s, a) => s + a.total_billed, 0);
  const totTarget     = associates.reduce((s, a) => s + a.revenue_target, 0);
  const totQuotes     = associates.reduce((s, a) => s + a.quote_count, 0);
  const totLeads      = associates.reduce((s, a) => s + a.lead_count, 0);
  const totConversions= associates.reduce((s, a) => s + a.conversions, 0);
  const hitTarget     = associates.filter(a => a.revenue_target > 0 && a.total_billed >= a.revenue_target).length;

  /* Year options */
  const years = [now.getFullYear(), now.getFullYear() - 1];

  return (
    <div style={{ padding: '20px 0' }}>

      {/* ── Header + period picker ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Associate Performance</h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Revenue, billing, lead conversion and collection metrics per associate.
          </p>
        </div>

        {/* Month + year picker */}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#0f172a', background: '#fff', cursor: 'pointer' }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#0f172a', background: '#fff', cursor: 'pointer' }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── Team summary strip ── */}
      {!loading && associates.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10, marginBottom: 20,
        }}>
          {[
            { label: 'Team Revenue',     value: fmtK(totRevenue),       bg: '#f0fdf4', text: '#15803d' },
            { label: 'vs Target',        value: totTarget > 0 ? `${pct(totRevenue, totTarget)}%` : '—', bg: '#eff6ff', text: '#1d4ed8' },
            { label: 'Hit Target',       value: `${hitTarget} / ${associates.filter(a => a.revenue_target > 0).length}`, bg: '#fefce8', text: '#a16207' },
            { label: 'Total Quotes',     value: totQuotes,  bg: '#fdf4ff', text: '#7e22ce' },
            { label: 'Leads Created',    value: totLeads,   bg: '#fff7ed', text: '#c2410c' },
            { label: 'Conversions',      value: totConversions, bg: '#ecfdf5', text: '#065f46' },
          ].map(s => <Pill key={s.label} {...s} />)}
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', color: '#991b1b', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: 14, height: 100, animation: 'pulse 1.5s ease infinite' }} />
          ))}
        </div>
      ) : associates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: '#f8fafc', borderRadius: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
          <div style={{ fontWeight: 700, color: '#475569' }}>No associate data for {MONTHS[month - 1]} {year}</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Set targets and create quotes to see performance here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {associates.map((a, idx) => {
            const isExpanded = expanded === a.id;
            const revPct     = pct(a.total_billed, a.revenue_target);
            const colPct     = a.collection_rate;
            const ac         = avatarColor(a.name);
            const noTarget   = a.revenue_target === 0;

            return (
              <div key={a.id} style={{
                background: '#fff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'box-shadow 0.15s',
              }}>
                {/* ── Main row ── */}
                <div
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}
                  onClick={() => setExpanded(isExpanded ? null : a.id)}
                >
                  {/* Rank + Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <RankBadge rank={idx + 1} />
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: ac.bg, color: ac.fg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800,
                    }}>
                      {initials(a.name)}
                    </div>
                  </div>

                  {/* Name + region + target bar */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{a.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>{a.employee_code}</span>
                      {a.region && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
                          📍 {a.region}
                        </span>
                      )}
                      {!noTarget && revPct >= 100 && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#d1fae5', color: '#065f46' }}>
                          ✓ Target hit
                        </span>
                      )}
                    </div>

                    {/* Revenue vs target bar */}
                    {!noTarget ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                          <span>{fmtK(a.total_billed)} billed</span>
                          <span style={{ color: revPct >= 100 ? '#059669' : '#94a3b8' }}>
                            {revPct}% of {fmtK(a.revenue_target)} target
                          </span>
                        </div>
                        <ProgBar value={a.total_billed} max={a.revenue_target} color="#0891b2" height={7} />
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {fmtK(a.total_billed)} billed <span style={{ color: '#cbd5e1' }}>· no target set</span>
                      </div>
                    )}
                  </div>

                  {/* Key stats */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{a.quote_count}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Quotes</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#7e22ce' }}>{a.conversions}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Converted</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 16, fontWeight: 800,
                        color: colPct >= 80 ? '#059669' : colPct >= 50 ? '#d97706' : '#dc2626',
                      }}>
                        {colPct}%
                      </div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Collected</div>
                    </div>

                    {/* Sparkline */}
                    <div style={{ opacity: 0.85 }}>
                      <Sparkline data={a.trend} color="#0891b2" />
                      <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>6mo trend</div>
                    </div>

                    {/* Expand chevron */}
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                    >
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                </div>

                {/* ── Expanded detail ── */}
                {isExpanded && (
                  <div style={{
                    borderTop: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    padding: '14px 16px',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>

                      {/* Quotes breakdown */}
                      <div style={{ background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                          🧾 Quote Breakdown
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {[
                            { label: 'Total Quotes',     val: a.quote_count,     color: '#0f172a' },
                            { label: 'Total Quoted',     val: fmtINR(a.total_quoted), color: '#1d4ed8' },
                            { label: 'Avg Deal Size',    val: fmtINR(a.avg_deal_size), color: '#7e22ce' },
                            { label: 'Accepted',         val: a.accepted_quotes, color: '#059669' },
                            { label: 'Sent (pending)',   val: a.sent_quotes,     color: '#d97706' },
                            { label: 'Still Draft',      val: a.draft_quotes,    color: '#94a3b8' },
                          ].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: '#64748b' }}>{row.label}</span>
                              <span style={{ fontWeight: 700, color: row.color }}>{row.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Billing & Collection */}
                      <div style={{ background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                          🏷 Billing & Collection
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {[
                            { label: 'Bills Raised',    val: a.bill_count,              color: '#0f172a' },
                            { label: 'Total Billed',    val: fmtINR(a.total_billed),    color: '#1d4ed8' },
                            { label: 'Collected',       val: fmtINR(a.total_collected), color: '#059669' },
                            { label: 'Balance Pending', val: fmtINR(Math.max(0, a.total_billed - a.total_collected)), color: '#dc2626' },
                            { label: 'Paid Bills',      val: a.paid_bills,    color: '#059669' },
                            { label: 'Partial Bills',   val: a.partial_bills, color: '#7c3aed' },
                            { label: 'Pending Bills',   val: a.pending_bills, color: '#d97706' },
                          ].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: '#64748b' }}>{row.label}</span>
                              <span style={{ fontWeight: 700, color: row.color }}>{row.val}</span>
                            </div>
                          ))}
                        </div>
                        {/* Collection progress */}
                        {a.total_billed > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 3 }}>
                              <span>Collection rate</span><span style={{ fontWeight: 700 }}>{colPct}%</span>
                            </div>
                            <ProgBar value={a.total_collected} max={a.total_billed} color="#059669" height={5} />
                          </div>
                        )}
                      </div>

                      {/* Leads & Pipeline */}
                      <div style={{ background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                          🎯 Leads & Pipeline
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {[
                            { label: 'Leads Created',    val: a.lead_count,      color: '#0f172a' },
                            { label: 'Active Leads',     val: a.active_leads,    color: '#0891b2' },
                            { label: 'Conversions',      val: a.conversions,     color: '#059669' },
                            { label: 'Conversion Rate',  val: `${a.conversion_rate}%`, color: a.conversion_rate >= 50 ? '#059669' : a.conversion_rate >= 25 ? '#d97706' : '#dc2626' },
                          ].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: '#64748b' }}>{row.label}</span>
                              <span style={{ fontWeight: 700, color: row.color }}>{row.val}</span>
                            </div>
                          ))}
                        </div>
                        {/* Conversion funnel bar */}
                        {a.lead_count > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Conversion funnel</div>
                            <div style={{ display: 'flex', gap: 2, height: 20, borderRadius: 6, overflow: 'hidden' }}>
                              {a.conversions > 0 && (
                                <div style={{ flex: a.conversions, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>{a.conversions}</span>
                                </div>
                              )}
                              {a.active_leads > 0 && (
                                <div style={{ flex: a.active_leads, background: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>{a.active_leads}</span>
                                </div>
                              )}
                              {(a.lead_count - a.conversions - a.active_leads) > 0 && (
                                <div style={{ flex: a.lead_count - a.conversions - a.active_leads, background: '#e2e8f0' }} />
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                              <span style={{ fontSize: 9, color: '#059669', fontWeight: 600 }}>■ Converted</span>
                              <span style={{ fontSize: 9, color: '#0891b2', fontWeight: 600 }}>■ Active</span>
                              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>■ Other</span>
                            </div>
                          </div>
                        )}

                        {/* Targets */}
                        {(a.leads_target > 0 || a.conversions_target > 0) && (
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>vs Target</div>
                            {a.leads_target > 0 && (
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                                  <span>Leads</span><span>{a.lead_count} / {a.leads_target}</span>
                                </div>
                                <ProgBar value={a.lead_count} max={a.leads_target} color="#0891b2" height={4} />
                              </div>
                            )}
                            {a.conversions_target > 0 && (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                                  <span>Conversions</span><span>{a.conversions} / {a.conversions_target}</span>
                                </div>
                                <ProgBar value={a.conversions} max={a.conversions_target} color="#7c3aed" height={4} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Trend label row */}
                    {a.trend.length > 1 && (
                      <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                          📈 6-Month Revenue Trend
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                          <Sparkline data={a.trend} color="#0891b2" />
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {a.trend.map((t, i) => (
                              <div key={i} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a' }}>{fmtK(t.revenue)}</div>
                                <div style={{ fontSize: 9, color: '#94a3b8' }}>{MONTHS[t.mo - 1]}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick links */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <Link
                        to={`/clients?associate=${a.id}`}
                        style={{
                          fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
                          background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                          textDecoration: 'none',
                        }}
                      >
                        🏢 View Clients
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
