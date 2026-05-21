import React, { useState, useEffect, useCallback } from 'react';
import TeamTab from './admin/TeamTab';
import ProductsTab from './admin/ProductsTab';
import QuotesTab from './admin/QuotesTab';
import LeadsTab from './admin/LeadsTab';
import ReportsTab from './admin/ReportsTab';
import { useAuth } from '../context/AuthContext';

// ─── Icons ───────────────────────────────────────────────────
const Ic = {
  up:     (<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 15l6-6 6 6"/></svg>),
  down:   (<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>),
  quote:  (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>),
  rupee:  (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 6h11M7 10h11M7.5 10c4.5 0 6 2 6 4 0 1.8-1.6 3-4 3H6l8 7"/></svg>),
  people: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3.5"/><path d="M2.5 19c.6-3.2 3.4-5.5 6.5-5.5s5.9 2.3 6.5 5.5"/><path d="M16 4a3 3 0 0 1 0 6M22 18c-.4-2.4-2.2-4-4.5-4.4"/></svg>),
  trend:  (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>),
  trophy: (<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4h14v3a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V4z"/><path d="M10 12v3h4v-3M8 18h8v2H8z" stroke="currentColor" fill="none" strokeWidth="1.5"/></svg>),
  more:   (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>),
  shield: (<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v7c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V5l-8-3z"/></svg>),
};

// ─── Helpers ─────────────────────────────────────────────────
const fmtL = (v) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
};

const initials = (name = '') =>
  name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

const avatarColors = [
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#E0E7FF', fg: '#3730A3' },
  { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#FEE2E2', fg: '#991B1B' },
  { bg: '#ECFEFF', fg: '#0E7490' },
];
const avatarColor = (name = '') => avatarColors[name.charCodeAt(0) % avatarColors.length];

const relativeTime = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ─── KPI tile ────────────────────────────────────────────────
const KPI = ({ glyph, label, value, sub, accent = '#0891B2' }) => (
  <div style={{
    background: '#FFFFFF', border: '1px solid #ECFEFF',
    borderRadius: 14, padding: '16px 18px',
    boxShadow: '0 2px 10px rgba(8,42,56,.04)',
    position: 'relative', overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute', top: 14, right: 14,
      width: 36, height: 36, borderRadius: 10,
      background: '#ECFEFF', color: accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{glyph}</div>
    <div style={{
      fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, fontSize: 11,
      color: '#6B7280', letterSpacing: '.06em', textTransform: 'uppercase',
    }}>{label}</div>
    <div style={{
      fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 30,
      color: '#164E63', lineHeight: 1, letterSpacing: '-.02em', marginTop: 8,
    }}>{value}</div>
    <div style={{
      fontFamily: "'Source Sans 3', sans-serif", fontSize: 11.5,
      color: '#6B7280', marginTop: 8,
    }}>{sub}</div>
  </div>
);

// ─── Horizontal bar ──────────────────────────────────────────
const ProductBar = ({ rank, name, value, max, color }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '24px 1fr 44px',
    alignItems: 'center', gap: 10, padding: '7px 0',
  }}>
    <div style={{
      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
      background: rank === 1 ? '#FEF3C7' : '#F1F5F9',
      color: rank === 1 ? '#92400E' : '#6B7280',
      fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 11,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{rank}</div>
    <div>
      <div style={{
        fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12.5,
        color: '#164E63', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: 4,
      }}>{name}</div>
      <div style={{ height: 8, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${(value / (max || 1)) * 100}%`,
          background: `linear-gradient(90deg, ${color}, ${color}BB)`,
          borderRadius: 999,
        }}/>
      </div>
    </div>
    <div style={{
      fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 12,
      color: '#164E63', textAlign: 'right',
    }}>{value}</div>
  </div>
);

// ─── Leads donut ─────────────────────────────────────────────
const BIZ_CONFIG = [
  { key: 'hospital',   label: 'Hospital',   emoji: '🏥', bg: '#DBEAFE', fg: '#1E40AF', bar: '#2563EB' },
  { key: 'fmc',        label: 'FMC',        emoji: '🏢', bg: '#E0E7FF', fg: '#3730A3', bar: '#4F46E5' },
  { key: 'apartment',  label: 'Apartment',  emoji: '🏙️', bg: '#D1FAE5', fg: '#065F46', bar: '#059669' },
  { key: 'restaurant', label: 'Restaurant', emoji: '🍽️', bg: '#FFEDD5', fg: '#9A3412', bar: '#EA580C' },
  { key: 'other',      label: 'Other',      emoji: '📦', bg: '#F1F5F9', fg: '#6B7280', bar: '#94A3B8' },
];

const LeadsByBiz = ({ data }) => {
  const items = BIZ_CONFIG.map(c => ({
    ...c,
    value: (data[c.key] || data[c.label] || data[c.label.toLowerCase()] || 0),
  }));
  const total = items.reduce((a, b) => a + b.value, 0);
  const max   = Math.max(...items.map(i => i.value), 1);
  const radius = 52, circ = 2 * Math.PI * radius;
  let acc = 0;
  const segs = items.filter(it => it.value > 0).map((it) => {
    const frac = it.value / (total || 1);
    const start = acc; acc += frac;
    return { ...it, start, end: acc };
  });

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="16"/>
          {segs.map((s, i) => (
            <circle key={i} cx="65" cy="65" r={radius} fill="none"
              stroke={s.bar} strokeWidth="16"
              strokeDasharray={`${(s.end - s.start) * circ} ${circ}`}
              strokeDashoffset={`${-s.start * circ}`}
              transform="rotate(-90 65 65)"
            />
          ))}
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 24,
            color: '#164E63', lineHeight: 1, letterSpacing: '-.02em',
          }}>{total}</div>
          <div style={{
            fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, fontSize: 10,
            color: '#6B7280', marginTop: 3, letterSpacing: '.05em', textTransform: 'uppercase',
          }}>Leads</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((it) => (
          <div key={it.key} style={{
            display: 'grid', gridTemplateColumns: '100px 1fr 28px',
            alignItems: 'center', gap: 8,
          }}>
            <span style={{
              background: it.bg, color: it.fg,
              fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 10.5,
              padding: '2px 8px', borderRadius: 999,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}><span>{it.emoji}</span>{it.label}</span>
            <div style={{ height: 6, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(it.value / max) * 100}%`,
                background: it.bar, borderRadius: 999,
              }}/>
            </div>
            <span style={{
              fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 11.5,
              color: '#164E63', textAlign: 'right',
            }}>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Activity row ────────────────────────────────────────────
const KIND_CFG = {
  accepted: { bg: '#D1FAE5', fg: '#065F46', label: 'ACCEPTED' },
  rejected: { bg: '#FEE2E2', fg: '#991B1B', label: 'REJECTED' },
  sent:     { bg: '#ECFEFF', fg: '#0E7490', label: 'SENT'     },
  draft:    { bg: '#F1F5F9', fg: '#374151', label: 'DRAFT'    },
};

const ActivityRow = ({ name, quoteNum, clientName, status, amount, time }) => {
  const col   = avatarColor(name);
  const kind  = KIND_CFG[status] || KIND_CFG.draft;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0', borderBottom: '1px solid #F1F5F9',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: col.bg, color: col.fg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 11,
      }}>{initials(name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Source Sans 3', sans-serif", fontSize: 12.5,
          color: '#374151', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <span style={{ fontWeight: 700, color: '#164E63' }}>{name}</span>
          {' · '}
          <span style={{ fontWeight: 600 }}>{clientName}</span>
        </div>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: '#6B7280', marginTop: 2,
        }}>{quoteNum} · {time}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        {amount > 0 && (
          <span style={{
            fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 12, color: '#164E63',
          }}>{fmtL(amount)}</span>
        )}
        <span style={{
          background: kind.bg, color: kind.fg,
          fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 9,
          padding: '2px 6px', borderRadius: 999, letterSpacing: '.08em',
        }}>{kind.label}</span>
      </div>
    </div>
  );
};

// ─── Team row ────────────────────────────────────────────────
const TeamRow = ({ emp, rank, best }) => {
  const col  = avatarColor(emp.name);
  const conv = emp.leads_count
    ? Math.round((emp.conversions / emp.leads_count) * 100)
    : 0;

  return (
    <tr style={{
      background: best ? 'linear-gradient(90deg,#FEF3C7 0%,#FFFBEB 60%,#FFFFFF 100%)' : '#FFFFFF',
      borderBottom: '1px solid #F1F5F9',
      borderLeft: best ? '3px solid #F59E0B' : '3px solid transparent',
    }}>
      <td style={{ padding: '12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: col.bg, color: col.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12,
          }}>{initials(emp.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13,
                color: '#164E63', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{emp.name}</span>
              {best && <span style={{ color: '#D97706' }}>{Ic.trophy}</span>}
            </div>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#6B7280', marginTop: 1,
            }}>{emp.employee_id}{emp.region ? ` · ${emp.region}` : ''}</div>
          </div>
        </div>
      </td>
      {[emp.quotes_count, fmtL(emp.quote_value), emp.leads_count, `${conv}%`].map((v, i) => (
        <td key={i} style={{
          textAlign: 'right', padding: '12px 12px',
          fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 13,
          color: '#164E63',
        }}>{v}</td>
      ))}
    </tr>
  );
};

// ─── P&L table ───────────────────────────────────────────────
const fmtINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const PnlTable = ({ title, rows, emptyMsg = 'No data' }) => (
  <div style={{
    background: '#FFFFFF', border: '1px solid #ECFEFF',
    borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 2px 10px rgba(8,42,56,.04)',
  }}>
    <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #F1F5F9' }}>
      <h3 style={{
        margin: 0,
        fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14,
        color: '#164E63',
      }}>{title}</h3>
    </div>
    {rows.length === 0 ? (
      <div style={{
        padding: 24, textAlign: 'center',
        fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#6B7280',
      }}>{emptyMsg}</div>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['Name', 'Revenue', 'COGS', 'Gross Profit', 'Margin'].map((h, i) => (
                <th key={i} style={{
                  fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 10,
                  color: '#0E7490', letterSpacing: '.07em', textTransform: 'uppercase',
                  padding: '9px 12px', textAlign: i === 0 ? 'left' : 'right',
                  borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
                <td style={{
                  padding: '10px 12px',
                  fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13,
                  color: '#164E63', maxWidth: 180,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{r.name}</td>
                <td style={{
                  textAlign: 'right', padding: '10px 12px',
                  fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#0E7490',
                }}>{fmtINR(r.revenue)}</td>
                <td style={{
                  textAlign: 'right', padding: '10px 12px',
                  fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#6B7280',
                }}>{fmtINR(r.cogs)}</td>
                <td style={{
                  textAlign: 'right', padding: '10px 12px',
                  fontFamily: "'DM Mono', monospace", fontSize: 12,
                  color: r.profit >= 0 ? '#065F46' : '#991B1B',
                  fontWeight: 700,
                }}>{fmtINR(r.profit)}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                  <span style={{
                    display: 'inline-block',
                    background: r.margin >= 30 ? '#D1FAE5' : r.margin >= 10 ? '#FEF3C7' : '#FEE2E2',
                    color: r.margin >= 30 ? '#065F46' : r.margin >= 10 ? '#92400E' : '#991B1B',
                    fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 999,
                  }}>{r.margin}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// ─── Overview dashboard tab ──────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  const load = useCallback(async () => {
    try {
      const [statsRes, pnlRes] = await Promise.all([
        fetch('/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/reports/pnl',     { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const statsData = await statsRes.json();
      const pnlData   = await pnlRes.json();
      setStats(statsData.stats);
      setPnl(pnlData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 60, color: '#6B7280',
      fontFamily: "'Source Sans 3', sans-serif",
    }}>Loading dashboard…</div>
  );

  if (!stats) return null;

  const perf     = stats.associate_performance || [];
  const bestIdx  = perf.length ? perf.reduce((bi, p, i) => p.quote_value > perf[bi].quote_value ? i : bi, 0) : -1;
  const topProds = stats.top_products || [];
  const maxUnits = topProds.length ? Math.max(...topProds.map(p => p.quantity), 1) : 1;
  const BAR_COLORS = ['#0891B2','#0E7490','#06B6D4','#22D3EE','#67E8F9'];
  const activity   = stats.recent_activity || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
      }}>
        <KPI glyph={Ic.quote}  label="Quotes (Month)" accent="#0891B2"
          value={stats.quotes.month.count}
          sub="all associates" />
        <KPI glyph={Ic.rupee}  label="Total Value"    accent="#059669"
          value={fmtL(stats.quotes.month.value)}
          sub="this month" />
        <KPI glyph={Ic.people} label="Total Leads"    accent="#22D3EE"
          value={stats.leads.total}
          sub="across team" />
        <KPI glyph={Ic.trend}  label="Conversion"     accent="#0891B2"
          value={`${stats.leads.conversion_rate}%`}
          sub="lead → converted" />
      </div>

      {/* Team performance + Leads by biz */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 16,
      }}>
        {/* Team table */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #ECFEFF',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(8,42,56,.04)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px',
            borderBottom: '1px solid #F1F5F9',
          }}>
            <div>
              <h3 style={{
                margin: 0,
                fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14,
                color: '#164E63',
              }}>Team Performance</h3>
              <div style={{
                fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: '#6B7280', marginTop: 2,
              }}>{perf.length} associate{perf.length !== 1 ? 's' : ''} · by value</div>
            </div>
          </div>
          {perf.length === 0 ? (
            <div style={{
              padding: 24, textAlign: 'center',
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#6B7280',
            }}>No associate data</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Associate','Quotes','Value','Leads','Conv%'].map((h, i) => (
                      <th key={i} style={{
                        fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 10,
                        color: '#0E7490', letterSpacing: '.07em', textTransform: 'uppercase',
                        padding: '9px 12px', textAlign: i === 0 ? 'left' : 'right',
                        borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perf.map((emp, i) => (
                    <TeamRow key={emp.id} emp={emp} rank={i + 1} best={i === bestIdx} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Leads by biz type */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #ECFEFF',
          borderRadius: 14, padding: '14px 16px',
          boxShadow: '0 2px 10px rgba(8,42,56,.04)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
          }}>
            <div>
              <h3 style={{
                margin: 0,
                fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14,
                color: '#164E63',
              }}>Leads by Business Type</h3>
              <div style={{
                fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: '#6B7280', marginTop: 2,
              }}>{stats.leads.total} leads total</div>
            </div>
          </div>
          <LeadsByBiz data={stats.leads_by_client_type || {}} />
        </div>
      </div>

      {/* P&L Dashboard */}
      {pnl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            paddingTop: 4,
          }}>
            <h3 style={{
              margin: 0,
              fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 16,
              color: '#164E63',
            }}>Profit &amp; Loss</h3>
            <span style={{
              background: '#D1FAE5', color: '#065F46',
              fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 9.5,
              padding: '2px 8px', borderRadius: 4, letterSpacing: '.06em', textTransform: 'uppercase',
            }}>Converted Leads Only</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 14,
          }}>
            <PnlTable title="By Category"  rows={pnl.by_category  || []} emptyMsg="No converted leads yet" />
            <PnlTable title="By Product"   rows={pnl.by_product   || []} emptyMsg="No converted leads yet" />
            <PnlTable title="By Associate" rows={pnl.by_associate || []} emptyMsg="No converted leads yet" />
            <PnlTable title="By City"      rows={pnl.by_city      || []} emptyMsg="No converted leads yet" />
          </div>
        </div>
      )}

      {/* Top products + Recent activity */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {/* Top products */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #ECFEFF',
          borderRadius: 14, padding: '14px 16px 12px',
          boxShadow: '0 2px 10px rgba(8,42,56,.04)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
          }}>
            <h3 style={{
              margin: 0,
              fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14,
              color: '#164E63',
            }}>Top Products</h3>
            <span style={{
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: '#6B7280',
            }}>by units quoted</span>
          </div>
          {topProds.length === 0 ? (
            <div style={{
              padding: '16px 0', textAlign: 'center',
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#6B7280',
            }}>No quote data yet</div>
          ) : topProds.map((p, i) => (
            <ProductBar key={i}
              rank={i + 1} name={p.product}
              value={p.quantity} max={maxUnits}
              color={BAR_COLORS[i % BAR_COLORS.length]}
            />
          ))}
        </div>

        {/* Recent activity */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #ECFEFF',
          borderRadius: 14, padding: '14px 16px 6px',
          boxShadow: '0 2px 10px rgba(8,42,56,.04)',
        }}>
          <h3 style={{
            margin: '0 0 2px',
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14,
            color: '#164E63',
          }}>Recent Activity</h3>
          {activity.length === 0 ? (
            <div style={{
              padding: '16px 0', textAlign: 'center',
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#6B7280',
            }}>No recent activity</div>
          ) : activity.map((q) => (
            <ActivityRow key={q.id}
              name={q.employee_name}
              quoteNum={q.quote_number}
              clientName={q.client_name}
              status={q.status}
              amount={q.total_amount}
              time={relativeTime(q.created_at)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'team',      label: 'Team' },
  { id: 'products',  label: 'Products' },
  { id: 'quotes',    label: 'All Quotes' },
  { id: 'leads',     label: 'All Leads' },
  { id: 'reports',   label: 'Reports' },
];

export default function AdminPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [tabFilters, setTabFilters] = useState({});

  const switchTab = (id, filters = {}) => { setTab(id); setTabFilters(filters); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{
          margin: 0,
          fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 20,
          color: '#164E63',
        }}>Admin Console</h2>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: '#EF4444', color: '#FFFFFF',
          fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 9.5,
          padding: '2px 7px', borderRadius: 4, letterSpacing: '.08em', textTransform: 'uppercase',
        }}>{Ic.shield} Admin</span>
        {user?.name && (
          <span style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 12.5, color: '#6B7280', marginLeft: 4,
          }}>Welcome, {user.name.split(' ')[0]}</span>
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E5E7EB',
        borderRadius: 12, padding: '4px 6px',
        overflowX: 'auto',
      }}>
        <div style={{ display: 'flex', gap: 2, minWidth: 'max-content' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                whiteSpace: 'nowrap', padding: '7px 14px', borderRadius: 8,
                border: 0, cursor: 'pointer', transition: 'all .15s',
                fontFamily: "'Nunito', sans-serif", fontWeight: tab === t.id ? 800 : 600, fontSize: 13,
                background: tab === t.id ? '#0891B2' : 'transparent',
                color: tab === t.id ? '#FFFFFF' : '#475569',
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'overview'  && <OverviewTab />}
        {tab === 'team'      && <TeamTab onSwitchTab={switchTab} />}
        {tab === 'products'  && <ProductsTab />}
        {tab === 'quotes'    && <QuotesTab initialFilters={tabFilters} />}
        {tab === 'leads'     && <LeadsTab />}
        {tab === 'reports'   && <ReportsTab />}
      </div>
    </div>
  );
}
