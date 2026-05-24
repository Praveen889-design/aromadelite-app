import React, { useState, useEffect, useCallback } from 'react';
import TeamTab from './admin/TeamTab';
import ProductsTab from './admin/ProductsTab';
import QuotesTab from './admin/QuotesTab';
import LeadsTab from './admin/LeadsTab';
import ReportsTab from './admin/ReportsTab';
// PriceDeviationTab replaced by DiscountApprovalTab in the Discounts tab
// import PriceDeviationTab from './admin/PriceDeviationTab';
import CommissionTab from './admin/CommissionTab';
import UnitsTab from './admin/UnitsTab';
import SettingsTab from './admin/SettingsTab';
import PaymentPendingTab from './admin/PaymentPendingTab';
import FollowUpsTab from './admin/FollowUpsTab';
import AssociatePerformanceTab from './admin/AssociatePerformanceTab';
import DiscountApprovalTab from './admin/DiscountApprovalTab';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useToast } from '../components/Toast';

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
  { bg: '#ECFEFF', fg: '#155DA6' },
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

// ─── Shared card primitives ──────────────────────────────────
const CARD = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.07)',
  borderRadius: 14,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.05)',
  overflow: 'hidden',
};
const CARD_HDR = {
  padding: '14px 20px',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
};

// ─── KPI tile ────────────────────────────────────────────────
const KPI = ({ glyph, label, value, sub, accent = '#1F6BC7' }) => (
  <div style={{
    ...CARD, padding: '20px 20px 16px',
    position: 'relative',
    borderTop: `3px solid ${accent}`,
  }}>
    <div style={{
      position: 'absolute', top: 16, right: 16,
      width: 40, height: 40, borderRadius: 12,
      background: `${accent}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: accent,
    }}>{glyph}</div>
    <div style={{
      fontSize: 10.5, fontWeight: 700, color: '#64748b',
      letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10,
    }}>{label}</div>
    <div style={{
      fontSize: 34, fontWeight: 900, color: '#0f172a',
      lineHeight: 1, letterSpacing: '-.03em', marginBottom: 8,
    }}>{value}</div>
    <div style={{ fontSize: 12, color: '#94a3b8' }}>{sub}</div>
  </div>
);

// ─── Horizontal bar ──────────────────────────────────────────
const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const ProductBar = ({ rank, name, value, max, color }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '28px 1fr 50px',
    alignItems: 'center', gap: 10, padding: '8px 0',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
  }}>
    <div style={{
      fontSize: rank <= 3 ? 16 : 12, textAlign: 'center', flexShrink: 0,
      color: rank <= 3 ? undefined : '#94a3b8',
      fontWeight: 700,
    }}>{rank <= 3 ? RANK_MEDALS[rank - 1] : rank}</div>
    <div>
      <div style={{
        fontWeight: 600, fontSize: 12.5, color: '#1e293b',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5,
      }}>{name}</div>
      <div style={{ height: 5, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${(value / (max || 1)) * 100}%`,
          background: `linear-gradient(90deg, ${color}, ${color}99)`,
          borderRadius: 999, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
        }}/>
      </div>
    </div>
    <div style={{
      fontWeight: 700, fontSize: 12, color: '#0f172a', textAlign: 'right',
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
            fontFamily: "'Manrope', sans-serif", fontWeight: 900, fontSize: 24,
            color: '#0F1620', lineHeight: 1, letterSpacing: '-.02em',
          }}>{total}</div>
          <div style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 10,
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
              fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 10.5,
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
              fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 11.5,
              color: '#0F1620', textAlign: 'right',
            }}>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Activity row ────────────────────────────────────────────
const KIND_CFG = {
  accepted: { bg: '#dcfce7', fg: '#15803d', dot: '#22c55e', label: 'Accepted' },
  rejected: { bg: '#fee2e2', fg: '#b91c1c', dot: '#ef4444', label: 'Rejected' },
  sent:     { bg: '#e0f2fe', fg: '#0369a1', dot: '#0ea5e9', label: 'Sent'     },
  draft:    { bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8', label: 'Draft'    },
};

const ActivityRow = ({ name, quoteNum, clientName, status, amount, time }) => {
  const col  = avatarColor(name);
  const kind = KIND_CFG[status] || KIND_CFG.draft;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 0', borderBottom: '1px solid rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: col.bg, color: col.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 11, border: `2px solid ${col.bg}`,
        boxShadow: `0 0 0 2px ${col.fg}22`,
      }}>{initials(name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>{name}</span>
          <span style={{ color: '#cbd5e1', margin: '0 5px' }}>·</span>
          <span style={{ fontWeight: 500, color: '#475569' }}>{clientName}</span>
        </div>
        <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>{quoteNum} · {time}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {amount > 0 && (
          <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>{fmtL(amount)}</span>
        )}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: kind.bg, color: kind.fg,
          fontWeight: 700, fontSize: 9.5,
          padding: '2px 8px', borderRadius: 999, letterSpacing: '.06em',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: kind.dot, flexShrink: 0 }} />
          {kind.label}
        </span>
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
      background: best
        ? 'linear-gradient(90deg, #fffbeb 0%, #fefce8 50%, #ffffff 100%)'
        : '#ffffff',
      borderBottom: '1px solid rgba(0,0,0,0.05)',
    }}>
      <td style={{ padding: '11px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Rank */}
          <div style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0, textAlign: 'center',
            fontSize: rank <= 3 ? 14 : 10, lineHeight: rank <= 3 ? '20px' : '20px',
            fontWeight: 700, color: rank > 3 ? '#94a3b8' : undefined,
          }}>{rank <= 3 ? RANK_MEDALS[rank - 1] : rank}</div>
          {/* Avatar */}
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: col.bg, color: col.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 12,
            boxShadow: best ? '0 0 0 2px #f59e0b66' : 'none',
          }}>{initials(emp.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</span>
              {best && <span style={{ fontSize: 12 }}>🏆</span>}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
              {emp.employee_id}{emp.region ? ` · ${emp.region}` : ''}
            </div>
          </div>
        </div>
      </td>
      {[emp.quotes_count, fmtL(emp.quote_value), emp.leads_count, `${conv}%`].map((v, i) => (
        <td key={i} style={{
          textAlign: 'right', padding: '11px 16px',
          fontWeight: i === 1 ? 700 : 600, fontSize: 13,
          color: i === 1 ? '#1F6BC7' : '#0f172a',
        }}>{v}</td>
      ))}
    </tr>
  );
};

// ─── Pipeline funnel ─────────────────────────────────────────
const PIPE_STAGES = [
  { key: 'new',       label: 'New Leads',  color: '#475569', fill: '#64748B', light: '#F1F5F9' },
  { key: 'contacted', label: 'Contacted',  color: '#155DA6', fill: '#1F6BC7', light: '#ECFEFF' },
  { key: 'qualified', label: 'Qualified',  color: '#6D28D9', fill: '#7C3AED', light: '#EDE9FE' },
  { key: 'converted', label: 'Converted',  color: '#065F46', fill: '#059669', light: '#D1FAE5' },
];

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const PipelineFunnel = ({ pipeline }) => {
  const topCount   = pipeline.new?.count       || 0;
  const lostCount  = pipeline.lost?.count      || 0;
  const convCount  = pipeline.converted?.count || 0;
  const grandTotal = PIPE_STAGES.reduce((s, st) => s + (pipeline[st.key]?.count || 0), 0) + lostCount;
  const overallConv = grandTotal > 0 ? Math.round((convCount / grandTotal) * 100) : 0;

  return (
    <div style={{ ...CARD }}>
      {/* Card header */}
      <div style={{ ...CARD_HDR }}>
        <div>
          <h3 style={{
            margin: 0, fontFamily: "'Manrope', sans-serif",
            fontWeight: 800, fontSize: 14, color: '#0F1620',
          }}>Lead Pipeline Funnel</h3>
          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: 11,
            color: '#6B7280', marginTop: 2,
          }}>{grandTotal} total leads · stages New → Contacted → Qualified → Converted</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>
            Overall conversion
          </div>
          <div style={{
            fontSize: 28, fontWeight: 900, lineHeight: 1.1,
            color: overallConv >= 50 ? '#059669' : overallConv >= 25 ? '#d97706' : '#64748b',
          }}>{overallConv}%</div>
        </div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {/* ── Visual funnel bars ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {PIPE_STAGES.map((stage, i) => {
            const count    = pipeline[stage.key]?.count || 0;
            const value    = pipeline[stage.key]?.value || 0;
            const barPct   = topCount > 0 ? Math.max((count / topCount) * 100, count > 0 ? 10 : 0) : (count > 0 ? 50 : 0);
            const prevCnt  = i > 0 ? (pipeline[PIPE_STAGES[i - 1].key]?.count || 0) : 0;
            const passPct  = i > 0 && prevCnt > 0 ? Math.round((count / prevCnt) * 100) : null;

            return (
              <div key={stage.key}>
                {/* Drop indicator */}
                {passPct !== null && (
                  <div style={{
                    textAlign: 'center', marginBottom: 4,
                    fontSize: 10, color: '#94a3b8', letterSpacing: '0.03em',
                  }}>
                    ▼ {passPct}% progressed from previous stage
                  </div>
                )}

                {/* Premium tapering bar */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    width: `${barPct}%`, minWidth: count > 0 ? 140 : 0,
                    maxWidth: '100%',
                    background: `linear-gradient(135deg, ${stage.fill}, ${stage.fill}CC)`,
                    borderRadius: 10,
                    height: 56,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 16px',
                    transition: 'width .5s cubic-bezier(.4,0,.2,1)',
                    boxShadow: `0 4px 16px ${stage.fill}33`,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.label}</span>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <div style={{ fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1 }}>{count}</div>
                      {value > 0 && (
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.75)', marginTop: 1 }}>{fmtL(value)}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Stage stat cards row ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 8, marginBottom: lostCount > 0 ? 12 : 0,
        }}>
          {PIPE_STAGES.map((stage, i) => {
            const count   = pipeline[stage.key]?.count || 0;
            const value   = pipeline[stage.key]?.value || 0;
            const prevCnt = i > 0 ? (pipeline[PIPE_STAGES[i - 1].key]?.count || 0) : 0;
            const passPct = i > 0 && prevCnt > 0 ? Math.round((count / prevCnt) * 100) : null;

            return (
              <div key={stage.key} style={{
                background: stage.light, borderRadius: 10,
                padding: '10px 12px', border: `1px solid ${stage.fill}33`,
              }}>
                <div style={{
                  fontFamily: "'Inter', sans-serif", fontWeight: 700,
                  fontSize: 10, color: stage.color, textTransform: 'uppercase',
                  letterSpacing: '.06em', marginBottom: 4,
                }}>{stage.label}</div>
                <div style={{
                  fontFamily: "'Manrope', sans-serif", fontWeight: 900,
                  fontSize: 22, color: stage.color, lineHeight: 1,
                }}>{count}</div>
                {value > 0 && (
                  <div style={{
                    fontFamily: "'Manrope', sans-serif", fontSize: 10,
                    color: stage.color, opacity: .75, marginTop: 2,
                  }}>{fmtL(value)}</div>
                )}
                {passPct !== null && (
                  <div style={{
                    marginTop: 5, display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <ArrowRight style={{ color: stage.color, width: 10, height: 10 }} />
                    <span style={{
                      fontFamily: "'Inter', sans-serif", fontSize: 10,
                      color: stage.color, fontWeight: 700,
                    }}>{passPct}% in</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Lost leads row ── */}
        {lostCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 8, padding: '8px 14px',
          }}>
            <div style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 700,
              fontSize: 12, color: '#B91C1C',
            }}>
              ✖ Lost Leads
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{
                fontFamily: "'Manrope', sans-serif", fontWeight: 900,
                fontSize: 20, color: '#DC2626',
              }}>{lostCount}</span>
              <span style={{
                fontFamily: "'Inter', sans-serif", fontSize: 10,
                color: '#EF4444', fontWeight: 600,
              }}>
                {grandTotal > 0 ? Math.round((lostCount / grandTotal) * 100) : 0}% of all leads
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Aging Quotes Alert ──────────────────────────────────────
const AGE_BUCKETS = [
  { key: 'critical', label: 'Critical',  days: '30+ days', bg: '#FEF2F2', fg: '#991B1B', bar: '#EF4444', border: '#FECACA', pill: '#FEE2E2' },
  { key: 'warning',  label: 'Warning',   days: '14–29 days', bg: '#FFF7ED', fg: '#9A3412', bar: '#F97316', border: '#FED7AA', pill: '#FFEDD5' },
  { key: 'notice',   label: 'Notice',    days: '7–13 days', bg: '#FEFCE8', fg: '#92400E', bar: '#EAB308', border: '#FEF08A', pill: '#FEF9C3' },
];

function AgingQuotesAlert() {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState(null);
  const [expanded,  setExpanded]  = useState(false);
  const [filter,    setFilter]    = useState('all');
  const { toast }                 = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data: res } = await api.get('/api/quotes/aging');
      setData(res);
    } catch (e) {
      console.warn('[aging]', e);
      setErr(e?.response?.data?.error || 'Could not load aging quotes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (q, status) => {
    try {
      await api.patch(`/api/quotes/${q.id}/status`, { status });
      toast(`${q.quote_number} marked ${status}.`, { kind: 'success' });
      load();
    } catch (e) {
      toast(e?.response?.data?.error || 'Update failed', { kind: 'error' });
    }
  };

  // Loading skeleton
  if (loading) return (
    <div style={{
      border: '1px solid #E5E7EB', borderRadius: 14,
      padding: '14px 18px', background: '#FAFAFA',
      fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#9CA3AF',
    }}>⏳ Loading aging quotes…</div>
  );

  // Error state
  if (err) return (
    <div style={{
      border: '1px solid #FECACA', borderRadius: 14,
      padding: '14px 18px', background: '#FEF2F2',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#991B1B' }}>
        ⚠ Aging Quotes: {err}
      </span>
      <button onClick={load} style={{
        background: '#EF4444', color: '#fff', border: 0, borderRadius: 8,
        padding: '5px 14px', cursor: 'pointer',
        fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
      }}>Retry</button>
    </div>
  );

  // All-clear state — no aging quotes
  if (!data || data.summary.total === 0) return (
    <div style={{
      border: '1px solid #A7F3D0', borderRadius: 14,
      padding: '13px 18px', background: '#F0FDF4',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>✅</span>
      <div>
        <span style={{
          fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, color: '#065F46',
        }}>No Aging Quotes — All Clear!</span>
        <span style={{
          marginLeft: 8,
          fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: '#6B7280',
        }}>All draft/sent quotes are less than 7 days old.</span>
      </div>
    </div>
  );

  const { summary, quotes } = data;
  const visible = filter === 'all' ? quotes : quotes.filter((q) => q.bucket === filter);
  const bucketCfg = (key) => AGE_BUCKETS.find((b) => b.key === key) || AGE_BUCKETS[2];

  return (
    <div style={{
      border: '1px solid #FECACA',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(239,68,68,.08)',
      background: '#FFFBFB',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '13px 18px',
        background: 'linear-gradient(90deg, #FEF2F2, #FFF7ED)',
        borderBottom: expanded ? '1px solid #FECACA' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, cursor: 'pointer',
      }} onClick={() => setExpanded((x) => !x)}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Pulse dot */}
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: '#EF4444',
            boxShadow: summary.critical > 0 ? '0 0 0 3px #FECACA' : 'none',
          }} />
          <div>
            <span style={{
              fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 14,
              color: '#991B1B',
            }}>⚠ Aging Quotes Alert</span>
            <span style={{
              marginLeft: 8,
              fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: '#B91C1C',
            }}>{summary.total} quote{summary.total !== 1 ? 's' : ''} waiting for action</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {AGE_BUCKETS.map((b) => summary[b.key] > 0 && (
            <span key={b.key} style={{
              background: b.pill, color: b.fg,
              fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 11,
              padding: '3px 10px', borderRadius: 999,
              border: `1px solid ${b.border}`,
            }}>
              {summary[b.key]} {b.label}
            </span>
          ))}
          <span style={{
            marginLeft: 4, fontSize: 13, color: '#9CA3AF', fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
          }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div>
          {/* Filter tabs */}
          <div style={{
            padding: '10px 18px 0',
            display: 'flex', gap: 6, flexWrap: 'wrap',
          }}>
            {[{ key: 'all', label: `All (${summary.total})` },
              ...AGE_BUCKETS.filter((b) => summary[b.key] > 0).map((b) => ({
                key: b.key, label: `${b.label} (${summary[b.key]})`,
              }))
            ].map((tab) => (
              <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
                border: '1px solid',
                borderColor: filter === tab.key ? '#EF4444' : '#E5E7EB',
                borderRadius: 8, background: filter === tab.key ? '#FEF2F2' : '#fff',
                color: filter === tab.key ? '#991B1B' : '#6B7280',
                fontFamily: "'Inter', sans-serif", fontWeight: 700,
                fontSize: 11.5, padding: '4px 12px', cursor: 'pointer',
              }}>{tab.label}</button>
            ))}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', padding: '10px 0 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Age', 'Quote', 'Client', 'Associate', 'Status', 'Amount', 'Follow-up', 'Actions'].map((h, i) => (
                    <th key={i} style={{
                      fontFamily: "'Inter', sans-serif", fontWeight: 700,
                      fontSize: 10, color: '#155DA6', letterSpacing: '.07em',
                      textTransform: 'uppercase', padding: '8px 12px',
                      textAlign: i >= 5 ? 'right' : 'left',
                      borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((q) => {
                  const cfg = bucketCfg(q.bucket);
                  const overdue = q.next_follow_up_date &&
                    q.next_follow_up_date < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={q.id} style={{
                      borderBottom: '1px solid #F1F5F9',
                      borderLeft: `3px solid ${cfg.bar}`,
                      background: filter === 'all' ? '#fff' : cfg.bg,
                    }}>
                      {/* Age */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          background: cfg.pill, color: cfg.fg,
                          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 11,
                          padding: '3px 8px', borderRadius: 999,
                          border: `1px solid ${cfg.border}`,
                          whiteSpace: 'nowrap',
                        }}>{q.age_days}d old</span>
                      </td>
                      {/* Quote # */}
                      <td style={{ padding: '10px 12px' }}>
                        <a href={`/quotes/${q.id}`} style={{
                          fontFamily: "'Manrope', sans-serif", fontWeight: 700,
                          fontSize: 12, color: '#155DA6', textDecoration: 'none',
                        }}>{q.quote_number}</a>
                        <div style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 10, color: '#9CA3AF', marginTop: 1,
                        }}>{q.created_at?.slice(0, 10)}</div>
                      </td>
                      {/* Client */}
                      <td style={{ padding: '10px 12px', maxWidth: 160 }}>
                        <div style={{
                          fontFamily: "'Manrope', sans-serif", fontWeight: 700,
                          fontSize: 12.5, color: '#0F1620',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{q.client_business_name || q.client_name}</div>
                        <div style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 10.5, color: '#6B7280',
                        }}>{q.client_name} · {q.client_city || '—'}</div>
                      </td>
                      {/* Associate */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 12, color: '#374151', fontWeight: 600,
                        }}>{q.employee_name}</div>
                        <div style={{
                          fontFamily: "'Manrope', sans-serif",
                          fontSize: 10, color: '#9CA3AF',
                        }}>{q.employee_code}</div>
                      </td>
                      {/* Status */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          background: q.status === 'sent' ? '#ECFEFF' : '#F1F5F9',
                          color:      q.status === 'sent' ? '#155DA6'  : '#374151',
                          fontFamily: "'Inter', sans-serif", fontWeight: 700,
                          fontSize: 9.5, padding: '2px 8px', borderRadius: 999,
                          textTransform: 'uppercase', letterSpacing: '.06em',
                        }}>{q.status}</span>
                      </td>
                      {/* Amount */}
                      <td style={{
                        padding: '10px 12px', textAlign: 'right',
                        fontFamily: "'Manrope', sans-serif", fontWeight: 600,
                        fontSize: 12, color: '#0F1620', whiteSpace: 'nowrap',
                      }}>
                        {new Intl.NumberFormat('en-IN', {
                          style: 'currency', currency: 'INR', maximumFractionDigits: 0,
                        }).format(q.total_amount)}
                      </td>
                      {/* Follow-up */}
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {q.next_follow_up_date ? (
                          <span style={{
                            display: 'inline-block',
                            background: overdue ? '#FEE2E2' : '#ECFEFF',
                            color: overdue ? '#991B1B' : '#155DA6',
                            fontFamily: "'Manrope', sans-serif", fontSize: 10,
                            fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                          }}>
                            {overdue ? '⚠ ' : ''}{q.next_follow_up_date}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#D1D5DB' }}>—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => updateStatus(q, 'accepted')}
                          style={{
                            background: '#D1FAE5', color: '#065F46', border: 0,
                            borderRadius: 6, padding: '4px 9px', fontSize: 11,
                            fontFamily: "'Inter', sans-serif", fontWeight: 700,
                            cursor: 'pointer', marginRight: 4,
                          }}>✓ Accept</button>
                        <button
                          onClick={() => updateStatus(q, 'rejected')}
                          style={{
                            background: '#FEE2E2', color: '#991B1B', border: 0,
                            borderRadius: 6, padding: '4px 9px', fontSize: 11,
                            fontFamily: "'Inter', sans-serif", fontWeight: 700,
                            cursor: 'pointer',
                          }}>✕ Reject</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer total value */}
          <div style={{
            padding: '10px 18px',
            borderTop: '1px solid #FEE2E2',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{
              fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: '#9CA3AF',
            }}>
              {visible.length} quote{visible.length !== 1 ? 's' : ''} shown
            </span>
            <span style={{
              fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13,
              color: '#991B1B',
            }}>
              Total at risk:{' '}
              {new Intl.NumberFormat('en-IN', {
                style: 'currency', currency: 'INR', maximumFractionDigits: 0,
              }).format(visible.reduce((s, q) => s + q.total_amount, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── P&L Dashboard ───────────────────────────────────────────
const fmtINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const marginColor = (m) =>
  m >= 50 ? { bg: '#dcfce7', text: '#15803d' } :
  m >= 30 ? { bg: '#d1fae5', text: '#065f46' } :
  m >= 10 ? { bg: '#fef3c7', text: '#92400e' } :
            { bg: '#fee2e2', text: '#991b1b' };

// Export all data as CSV
const exportPnlCsv = (pnl) => {
  const rows = [];
  rows.push(['Section', 'Name', 'Category', 'Revenue (₹)', 'COGS (₹)', 'Gross Profit (₹)', 'Margin (%)']);

  (pnl.by_product || []).forEach((r) =>
    rows.push(['Product', r.name, r.category || '', r.revenue, r.cogs, r.profit, r.margin])
  );
  rows.push([]);
  (pnl.by_category || []).forEach((r) =>
    rows.push(['Category', r.name, '', r.revenue, r.cogs, r.profit, r.margin])
  );
  rows.push([]);
  (pnl.by_associate || []).forEach((r) =>
    rows.push(['Associate', r.name, '', r.revenue, r.cogs, r.profit, r.margin])
  );
  rows.push([]);
  (pnl.by_city || []).forEach((r) =>
    rows.push(['City', r.name, '', r.revenue, r.cogs, r.profit, r.margin])
  );

  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `PnL_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

// Compact side table for associate / city
const PnlMiniTable = ({ title, icon, rows }) => (
  <div style={{
    background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
    overflow: 'hidden', flex: 1, minWidth: 0,
  }}>
    <div style={{
      padding: '14px 18px 10px', borderBottom: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{title}</span>
    </div>
    {rows.length === 0 ? (
      <div style={{ padding: '20px 18px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>No data yet</div>
    ) : (
      <div style={{ padding: '8px 0' }}>
        {rows.map((r, i) => {
          const mc = marginColor(r.margin);
          const pct = rows[0].revenue > 0 ? (r.revenue / rows[0].revenue) * 100 : 0;
          return (
            <div key={i} style={{ padding: '10px 18px', borderBottom: i < rows.length - 1 ? '1px solid #f8fafc' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e40af' }}>{fmtINR(r.revenue)}</span>
                  <span style={{ background: mc.bg, color: mc.text, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{r.margin}%</span>
                </div>
              </div>
              <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: '#3b82f6', borderRadius: 4, transition: 'width .4s' }} />
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

// Main P&L dashboard component
const PnlDashboard = ({ pnl }) => {
  const [expandedCat, setExpandedCat] = React.useState(null);

  const cats      = pnl.by_category  || [];
  const associates = pnl.by_associate || [];
  const cities    = pnl.by_city       || [];

  const totalRev    = cats.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = cats.reduce((s, r) => s + r.profit, 0);
  const totalCogs   = cats.reduce((s, r) => s + r.cogs, 0);
  const avgMargin   = totalRev > 0 ? +((totalProfit / totalRev) * 100).toFixed(1) : 0;

  const productsByCategory = React.useMemo(() => {
    const map = {};
    (pnl.by_product || []).forEach((p) => {
      const key = p.category || 'Uncategorized';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [pnl.by_product]);

  const kpis = [
    { label: 'Total Revenue', value: fmtINR(totalRev), icon: '💰', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Gross Profit',  value: fmtINR(totalProfit), icon: '📈', color: '#065f46', bg: '#f0fdf4', border: '#86efac' },
    { label: 'Total COGS',    value: fmtINR(totalCogs), icon: '🏭', color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
    { label: 'Avg Margin',    value: `${avgMargin}%`, icon: '🎯', color: marginColor(avgMargin).text, bg: marginColor(avgMargin).bg, border: marginColor(avgMargin).bg },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Profit & Loss</h3>
          <span style={{
            background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 10,
            padding: '3px 10px', borderRadius: 20, letterSpacing: '.06em', textTransform: 'uppercase',
            border: '1px solid #86efac',
          }}>Converted Leads Only</span>
        </div>
        <button
          onClick={() => exportPnlCsv(pnl)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', background: '#0f172a', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          ⬇ Export CSV
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{
            background: k.bg, border: `1.5px solid ${k.border}`, borderRadius: 14,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown — main table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{
          padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>🗂</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>By Category</span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>Click a row to see products</span>
        </div>

        {cats.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No converted leads yet</div>
        ) : (
          <div>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 80px 32px',
              padding: '8px 20px', background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
            }}>
              {['Category', 'Revenue', 'COGS', 'Gross Profit', 'Margin', ''].map((h, i) => (
                <div key={i} style={{
                  fontSize: 10, fontWeight: 700, color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: '.06em',
                  textAlign: i === 0 ? 'left' : 'right',
                }}>{h}</div>
              ))}
            </div>

            {cats.map((r, idx) => {
              const mc   = marginColor(r.margin);
              const pct  = totalRev > 0 ? (r.revenue / totalRev) * 100 : 0;
              const isEx = expandedCat === r.name;
              const prods = productsByCategory[r.name] || [];

              return (
                <div key={idx}>
                  {/* Category row */}
                  <div
                    onClick={() => setExpandedCat(isEx ? null : r.name)}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 80px 32px',
                      padding: '13px 20px', cursor: 'pointer',
                      background: isEx ? '#f8fafc' : '#fff',
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background .15s',
                    }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{r.name}</div>
                      <div style={{ height: 5, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', width: '90%' }}>
                        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: '#3b82f6', borderRadius: 4 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1e40af', alignSelf: 'center' }}>{fmtINR(r.revenue)}</div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: '#64748b', alignSelf: 'center' }}>{fmtINR(r.cogs)}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: r.profit >= 0 ? '#065f46' : '#991b1b', alignSelf: 'center' }}>{fmtINR(r.profit)}</div>
                    <div style={{ textAlign: 'right', alignSelf: 'center' }}>
                      <span style={{ background: mc.bg, color: mc.text, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{r.margin}%</span>
                    </div>
                    <div style={{ textAlign: 'right', alignSelf: 'center', fontSize: 14, color: '#94a3b8', userSelect: 'none' }}>
                      {isEx ? '▲' : '▼'}
                    </div>
                  </div>

                  {/* Expanded product rows */}
                  {isEx && prods.length > 0 && (
                    <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {/* sub-header */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 80px 32px',
                        padding: '6px 20px 4px 36px',
                      }}>
                        {['Product', 'Revenue', 'COGS', 'Gross Profit', 'Margin', ''].map((h, i) => (
                          <div key={i} style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
                        ))}
                      </div>
                      {prods.map((p, pi) => {
                        const pmc = marginColor(p.margin);
                        return (
                          <div key={pi} style={{
                            display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 80px 32px',
                            padding: '9px 20px 9px 36px',
                            borderTop: '1px solid #e9eef4',
                          }}>
                            <div style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{p.name}</div>
                            <div style={{ textAlign: 'right', fontSize: 12, color: '#1e40af', fontWeight: 600 }}>{fmtINR(p.revenue)}</div>
                            <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>{fmtINR(p.cogs)}</div>
                            <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: p.profit >= 0 ? '#065f46' : '#991b1b' }}>{fmtINR(p.profit)}</div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ background: pmc.bg, color: pmc.text, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{p.margin}%</span>
                            </div>
                            <div />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Totals footer */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 80px 32px',
              padding: '12px 20px', background: '#0f172a', borderTop: '2px solid #e2e8f0',
            }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: '#fff' }}>TOTAL</div>
              <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#93c5fd' }}>{fmtINR(totalRev)}</div>
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#94a3b8' }}>{fmtINR(totalCogs)}</div>
              <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#6ee7b7' }}>{fmtINR(totalProfit)}</div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ background: marginColor(avgMargin).bg, color: marginColor(avgMargin).text, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{avgMargin}%</span>
              </div>
              <div />
            </div>
          </div>
        )}
      </div>

      {/* Associate + City side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <PnlMiniTable title="By Associate" icon="👤" rows={associates} />
        <PnlMiniTable title="By City"      icon="📍" rows={cities} />
      </div>
    </div>
  );
};

// ─── Top Clients ─────────────────────────────────────────────
const CLIENT_TYPE_CFG = {
  hospital:   { emoji: '🏥', bg: '#DBEAFE', fg: '#1E40AF' },
  fmc:        { emoji: '🏢', bg: '#E0E7FF', fg: '#3730A3' },
  apartment:  { emoji: '🏙️', bg: '#D1FAE5', fg: '#065F46' },
  restaurant: { emoji: '🍽️', bg: '#FFEDD5', fg: '#9A3412' },
  school:     { emoji: '🏫', bg: '#FEF9C3', fg: '#92400E' },
  contractor: { emoji: '🔧', bg: '#F3E8FF', fg: '#6B21A8' },
  other:      { emoji: '📦', bg: '#F1F5F9', fg: '#6B7280' },
};
const clientTypeCfg = (t) =>
  CLIENT_TYPE_CFG[(t || '').toLowerCase()] || CLIENT_TYPE_CFG.other;

const MEDALS = ['🥇', '🥈', '🥉'];

const PERIODS = [
  { key: 'all',     label: 'All Time'     },
  { key: 'year',    label: 'This Year'    },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'month',   label: 'This Month'   },
];

function TopClients() {
  const [period,  setPeriod]  = useState('all');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState(null);

  const load = useCallback(async (p) => {
    setLoading(true);
    setErr(null);
    try {
      const { data: res } = await api.get(`/api/reports/top-clients?limit=10&period=${p}`);
      setData(res);
    } catch (e) {
      console.warn('[top-clients]', e);
      setErr(e?.response?.data?.error || 'Could not load client data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  const clients  = data?.clients || [];
  const maxRev   = clients.length ? clients[0].total_revenue : 1;

  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #ECFEFF',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 10px rgba(8,42,56,.04)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px 10px',
        borderBottom: '1px solid #F1F5F9',
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <h3 style={{
            margin: 0, fontFamily: "'Manrope', sans-serif",
            fontWeight: 800, fontSize: 14, color: '#0F1620',
          }}>🏆 Top Clients by Revenue</h3>
          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: 11,
            color: '#6B7280', marginTop: 2,
          }}>
            {loading ? 'Loading…' : `${clients.length} client${clients.length !== 1 ? 's' : ''} · by total quoted value`}
          </div>
        </div>

        {/* Period selector */}
        <div style={{
          display: 'flex', gap: 4, background: '#F1F5F9',
          borderRadius: 8, padding: 3,
        }}>
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              border: 0, borderRadius: 6, cursor: 'pointer',
              padding: '4px 10px',
              background: period === p.key ? '#1F6BC7' : 'transparent',
              color: period === p.key ? '#fff' : '#6B7280',
              fontFamily: "'Inter', sans-serif",
              fontWeight: period === p.key ? 700 : 500, fontSize: 11,
              transition: 'all .15s',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{
          padding: 32, textAlign: 'center',
          fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#6B7280',
        }}>Loading…</div>
      ) : err ? (
        <div style={{
          padding: '24px 18px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#991B1B' }}>
            ⚠ {err}
          </span>
          <button onClick={() => load(period)} style={{
            background: '#1F6BC7', color: '#fff', border: 0, borderRadius: 8,
            padding: '5px 14px', cursor: 'pointer',
            fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
          }}>Retry</button>
        </div>
      ) : clients.length === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center',
          fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#6B7280',
        }}>No quote data for this period.</div>
      ) : (
        <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {clients.map((c, i) => {
            const cfg      = clientTypeCfg(c.client_type);
            const barPct   = maxRev > 0 ? (c.total_revenue / maxRev) * 100 : 0;
            const winColor = c.win_rate >= 60 ? '#059669' : c.win_rate >= 30 ? '#F59E0B' : '#EF4444';

            return (
              <div key={i} style={{
                padding: '10px 0',
                borderBottom: i < clients.length - 1 ? '1px solid #F8FAFC' : 'none',
              }}>
                {/* Row: rank + name + badges */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 10, marginBottom: 7,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {/* Rank */}
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: i < 3 ? '#FEF3C7' : '#F1F5F9',
                      color: i < 3 ? '#92400E' : '#6B7280',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 12,
                    }}>
                      {i < 3 ? MEDALS[i] : i + 1}
                    </div>

                    {/* Name */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Manrope', sans-serif", fontWeight: 800,
                        fontSize: 13, color: '#0F1620',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{c.client}</div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap',
                      }}>
                        {/* Type badge */}
                        <span style={{
                          background: cfg.bg, color: cfg.fg,
                          fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 10,
                          padding: '1px 6px', borderRadius: 999,
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>{cfg.emoji} {c.client_type}</span>
                        {/* City */}
                        {c.client_city && (
                          <span style={{
                            fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: '#9CA3AF',
                          }}>📍 {c.client_city}</span>
                        )}
                        {/* Associate */}
                        {c.top_associate && (
                          <span style={{
                            fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: '#9CA3AF',
                          }}>👤 {c.top_associate}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: revenue + stats */}
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{
                      fontFamily: "'Manrope', sans-serif", fontWeight: 700,
                      fontSize: 14, color: '#0F1620',
                    }}>{fmtL(c.total_revenue)}</div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      justifyContent: 'flex-end', marginTop: 2,
                    }}>
                      <span style={{
                        fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: '#6B7280',
                      }}>{c.quote_count} quote{c.quote_count !== 1 ? 's' : ''}</span>
                      {/* Win rate */}
                      <span style={{
                        background: winColor + '22', color: winColor,
                        fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 10,
                        padding: '1px 6px', borderRadius: 999,
                      }}>{c.win_rate}% win</span>
                    </div>
                  </div>
                </div>

                {/* Revenue bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    flex: 1, height: 6, background: '#F1F5F9',
                    borderRadius: 999, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${barPct}%`,
                      background: `linear-gradient(90deg, #1F6BC7, #06B6D4)`,
                      borderRadius: 999, transition: 'width .4s ease',
                    }} />
                  </div>
                  {c.accepted_revenue > 0 && (
                    <span style={{
                      fontFamily: "'Manrope', sans-serif", fontSize: 10,
                      color: '#059669', fontWeight: 600, whiteSpace: 'nowrap',
                    }}>✓ {fmtL(c.accepted_revenue)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer summary */}
      {!loading && clients.length > 0 && (
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid #F1F5F9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{
            fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#9CA3AF',
          }}>
            Showing top {clients.length} clients
          </span>
          <span style={{
            fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12, color: '#155DA6',
          }}>
            Total: {fmtL(clients.reduce((s, c) => s + c.total_revenue, 0))}
            {clients.some(c => c.accepted_revenue > 0) && (
              <span style={{ color: '#059669', marginLeft: 10 }}>
                ✓ Accepted: {fmtL(clients.reduce((s, c) => s + c.accepted_revenue, 0))}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Target vs Actual ────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthLabel = (y, m) => `${MONTHS[m - 1]} ${y}`;

const pctColor = (p) =>
  p >= 100 ? '#059669' : p >= 80 ? '#1F6BC7' : p >= 50 ? '#F59E0B' : '#EF4444';

const ProgBar = ({ actual, target, fmt }) => {
  if (!target) return (
    <span style={{ fontSize: 11, color: '#9CA3AF', fontFamily: "'Inter', sans-serif" }}>
      No target
    </span>
  );
  const pct  = Math.round((actual / target) * 100);
  const fill = Math.min(100, (actual / target) * 100);
  const col  = pctColor(pct);
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{
          fontFamily: "'Manrope', sans-serif", fontSize: 11,
          color: '#0F1620', fontWeight: 700,
        }}>{fmt(actual)}</span>
        <span style={{
          fontFamily: "'Manrope', sans-serif", fontSize: 10, color: '#9CA3AF',
        }}>/ {fmt(target)}</span>
      </div>
      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${fill}%`,
          background: `linear-gradient(90deg, ${col}, ${col}CC)`,
          borderRadius: 999, transition: 'width .4s ease',
        }} />
      </div>
      <div style={{
        marginTop: 2, textAlign: 'right',
        fontFamily: "'Manrope', sans-serif", fontSize: 10,
        color: col, fontWeight: 700,
      }}>{pct}%</div>
    </div>
  );
};

const statusBadge = (row) => {
  const hasAny = row.revenue_target > 0 || row.leads_target > 0 || row.conversions_target > 0;
  if (!hasAny) return { label: 'No Target', bg: '#F1F5F9', fg: '#6B7280' };
  const rp = row.revenue_target > 0 ? (row.actual_revenue / row.revenue_target) * 100 : 100;
  if (rp >= 100) return { label: '🏆 Exceeded',       bg: '#D1FAE5', fg: '#065F46' };
  if (rp >= 80)  return { label: '🔵 On Track',        bg: '#ECFEFF', fg: '#155DA6' };
  if (rp >= 50)  return { label: '🟡 Getting There',   bg: '#FEF3C7', fg: '#92400E' };
  return             { label: '🔴 Behind',             bg: '#FEE2E2', fg: '#991B1B' };
};

function SetTargetsModal({ open, year, month, rows, onClose, onSaved }) {
  const { toast } = useToast();
  const [vals, setVals] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !rows) return;
    const init = {};
    for (const r of rows) {
      init[r.employee_id] = {
        revenue_target:     r.revenue_target     || '',
        leads_target:       r.leads_target       || '',
        conversions_target: r.conversions_target || '',
      };
    }
    setVals(init);
  }, [open, rows]);

  if (!open) return null;

  const upd = (empId, field, val) =>
    setVals((v) => ({ ...v, [empId]: { ...v[empId], [field]: val } }));

  const save = async () => {
    setSaving(true);
    try {
      const targets = (rows || []).map((r) => ({
        employee_id:        r.employee_id,
        revenue_target:     Number(vals[r.employee_id]?.revenue_target)     || 0,
        leads_target:       Number(vals[r.employee_id]?.leads_target)       || 0,
        conversions_target: Number(vals[r.employee_id]?.conversions_target) || 0,
      }));
      await api.post('/api/targets/bulk', { year, month, targets });
      toast(`Targets saved for ${monthLabel(year, month)}.`, { kind: 'success' });
      onSaved();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to save targets', { kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full text-right border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 px-3 py-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Set Targets</h2>
            <div className="text-xs text-slate-500 mt-0.5">{monthLabel(year, month)}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {['Associate', 'Revenue Target (₹)', 'Leads', 'Conversions'].map((h, i) => (
                  <th key={i} className={`px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500 font-semibold border-b border-slate-200 ${i === 0 ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.employee_id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800 text-sm">{r.name}</div>
                    <div className="text-[11px] text-slate-500">{r.employee_code}{r.region ? ` · ${r.region}` : ''}</div>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} className={inputCls}
                      value={vals[r.employee_id]?.revenue_target ?? ''}
                      onChange={(e) => upd(r.employee_id, 'revenue_target', e.target.value)}
                      placeholder="0" />
                  </td>
                  <td className="px-3 py-2 w-24">
                    <input type="number" min={0} className={inputCls}
                      value={vals[r.employee_id]?.leads_target ?? ''}
                      onChange={(e) => upd(r.employee_id, 'leads_target', e.target.value)}
                      placeholder="0" />
                  </td>
                  <td className="px-3 py-2 w-24">
                    <input type="number" min={0} className={inputCls}
                      value={vals[r.employee_id]?.conversions_target ?? ''}
                      onChange={(e) => upd(r.employee_id, 'conversions_target', e.target.value)}
                      placeholder="0" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Targets'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TargetVsActual() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data,  setData]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/api/targets?year=${year}&month=${month}`);
      setData(res);
    } catch (e) {
      console.error('targets fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const goBack = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const goFwd = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  const rows   = data?.rows || [];
  const totRev = rows.reduce((s, r) => s + r.actual_revenue,  0);
  const totTgt = rows.reduce((s, r) => s + r.revenue_target,  0);
  const totLd  = rows.reduce((s, r) => s + r.actual_leads,    0);
  const totCv  = rows.reduce((s, r) => s + r.actual_conversions, 0);

  return (
    <>
      <div style={{
        background: '#FFFFFF', border: '1px solid #ECFEFF',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(8,42,56,.04)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px 10px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
        }}>
          <div>
            <h3 style={{
              margin: 0, fontFamily: "'Manrope', sans-serif",
              fontWeight: 800, fontSize: 14, color: '#0F1620',
            }}>Target vs Actual</h3>
            <div style={{
              fontFamily: "'Inter', sans-serif", fontSize: 11,
              color: '#6B7280', marginTop: 2,
            }}>{rows.length} associate{rows.length !== 1 ? 's' : ''} · {monthLabel(year, month)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button onClick={goBack} style={{
                border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff',
                padding: '4px 8px', cursor: 'pointer', fontSize: 13, color: '#374151',
                fontWeight: 600, lineHeight: 1,
              }}>‹</button>
              <span style={{
                fontFamily: "'Manrope', sans-serif", fontSize: 11,
                color: '#374151', padding: '0 6px', whiteSpace: 'nowrap',
              }}>{monthLabel(year, month)}</span>
              <button onClick={goFwd} style={{
                border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff',
                padding: '4px 8px', cursor: 'pointer', fontSize: 13, color: '#374151',
                fontWeight: 600, lineHeight: 1,
              }}>›</button>
            </div>
            {/* Set targets button */}
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: '#1F6BC7', color: '#fff',
                border: 0, borderRadius: 8, cursor: 'pointer',
                fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
                padding: '6px 14px', whiteSpace: 'nowrap',
              }}
            >Set Targets</button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{
            padding: 32, textAlign: 'center',
            fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#6B7280',
          }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{
            padding: 32, textAlign: 'center',
            fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#6B7280',
          }}>No active associates found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Associate', 'Revenue vs Target', 'Leads vs Target', 'Conversions', 'Status'].map((h, i) => (
                    <th key={i} style={{
                      fontFamily: "'Inter', sans-serif", fontWeight: 700,
                      fontSize: 10, color: '#155DA6', letterSpacing: '.07em',
                      textTransform: 'uppercase', padding: '9px 14px',
                      textAlign: i === 0 ? 'left' : i === 4 ? 'center' : 'left',
                      borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const badge = statusBadge(r);
                  const col   = avatarColor(r.name);
                  return (
                    <tr key={r.employee_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      {/* Associate */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            background: col.bg, color: col.fg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 11,
                          }}>{initials(r.name)}</div>
                          <div>
                            <div style={{
                              fontFamily: "'Manrope', sans-serif", fontWeight: 800,
                              fontSize: 13, color: '#0F1620',
                            }}>{r.name}</div>
                            <div style={{
                              fontFamily: "'Manrope', sans-serif", fontSize: 10, color: '#6B7280',
                            }}>{r.employee_code}{r.region ? ` · ${r.region}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      {/* Revenue */}
                      <td style={{ padding: '12px 14px', minWidth: 160 }}>
                        <ProgBar actual={r.actual_revenue} target={r.revenue_target} fmt={fmtL} />
                      </td>
                      {/* Leads */}
                      <td style={{ padding: '12px 14px', minWidth: 130 }}>
                        <ProgBar actual={r.actual_leads} target={r.leads_target} fmt={String} />
                      </td>
                      {/* Conversions */}
                      <td style={{ padding: '12px 14px', minWidth: 130 }}>
                        <ProgBar actual={r.actual_conversions} target={r.conversions_target} fmt={String} />
                      </td>
                      {/* Status */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          background: badge.bg, color: badge.fg,
                          fontFamily: "'Inter', sans-serif", fontWeight: 700,
                          fontSize: 10.5, padding: '3px 10px', borderRadius: 999,
                          whiteSpace: 'nowrap',
                        }}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer */}
              {rows.length > 1 && (
                <tfoot>
                  <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E5E7EB' }}>
                    <td style={{
                      padding: '10px 14px',
                      fontFamily: "'Manrope', sans-serif", fontWeight: 800,
                      fontSize: 12, color: '#0F1620',
                    }}>Team Total</td>
                    <td style={{ padding: '10px 14px', minWidth: 160 }}>
                      <ProgBar actual={totRev} target={totTgt} fmt={fmtL} />
                    </td>
                    <td style={{
                      padding: '10px 14px',
                      fontFamily: "'Manrope', sans-serif", fontSize: 12, color: '#0F1620',
                    }}>{totLd} leads</td>
                    <td style={{
                      padding: '10px 14px',
                      fontFamily: "'Manrope', sans-serif", fontSize: 12, color: '#0F1620',
                    }}>{totCv} converted</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <SetTargetsModal
        open={modalOpen}
        year={year} month={month}
        rows={rows}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </>
  );
}

// ─── Overview dashboard tab ──────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('aromadelite_token');
    const hdrs  = { Authorization: `Bearer ${token}` };
    try {
      const statsRes = await fetch('/api/dashboard/stats', { headers: hdrs });
      if (!statsRes.ok) throw new Error(`Dashboard API error: ${statsRes.status}`);
      const statsData = await statsRes.json();
      setStats(statsData.stats);
    } catch (e) {
      console.error('[dashboard/stats]', e);
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
    // PnL loads independently — failure won't blank the whole page
    try {
      const token2 = localStorage.getItem('aromadelite_token');
      const pnlRes = await fetch('/api/reports/pnl', { headers: { Authorization: `Bearer ${token2}` } });
      if (pnlRes.ok) {
        const pnlData = await pnlRes.json();
        setPnl(pnlData);
      }
    } catch (e) {
      console.warn('[reports/pnl]', e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 60, color: '#6B7280',
      fontFamily: "'Inter', sans-serif",
    }}>Loading dashboard…</div>
  );

  if (error) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 60, gap: 12,
    }}>
      <div style={{
        fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15, color: '#991B1B',
      }}>Dashboard failed to load</div>
      <div style={{
        fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#6B7280',
      }}>{error}</div>
      <button onClick={load} style={{
        background: '#1F6BC7', color: '#fff', border: 0, borderRadius: 8,
        padding: '8px 18px', cursor: 'pointer',
        fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13,
      }}>Retry</button>
    </div>
  );

  if (!stats) return null;

  const perf     = stats.associate_performance || [];
  const bestIdx  = perf.length ? perf.reduce((bi, p, i) => p.quote_value > perf[bi].quote_value ? i : bi, 0) : -1;
  const topProds = stats.top_products || [];
  const maxUnits = topProds.length ? Math.max(...topProds.map(p => p.quantity), 1) : 1;
  const BAR_COLORS = ['#1F6BC7','#155DA6','#06B6D4','#22D3EE','#67E8F9'];
  const activity   = stats.recent_activity || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
        gap: 14,
      }}>
        <KPI glyph={Ic.quote}  label="Quotes (Month)" accent="#1F6BC7"
          value={stats.quotes.month.count}
          sub="all associates" />
        <KPI glyph={Ic.rupee}  label="Total Value"    accent="#059669"
          value={fmtL(stats.quotes.month.value)}
          sub="this month" />
        <KPI glyph={Ic.people} label="Total Leads"    accent="#22D3EE"
          value={stats.leads.total}
          sub="across team" />
        <KPI glyph={Ic.trend}  label="Conversion"     accent="#1F6BC7"
          value={`${stats.leads.conversion_rate}%`}
          sub="lead → converted" />
      </div>

      {/* Aging Quotes Alert */}
      <AgingQuotesAlert />

      {/* Team performance + Leads by biz */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 16,
      }}>
        {/* Team table */}
        <div style={{
          ...CARD,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            ...CARD_HDR,
          }}>
            <div>
              <h3 style={{
                margin: 0,
                fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 14,
                color: '#0F1620',
              }}>Team Performance</h3>
              <div style={{
                fontSize: 11, color: '#64748b', marginTop: 3,
              }}>{perf.length} associate{perf.length !== 1 ? 's' : ''} · by value</div>
            </div>
          </div>
          {perf.length === 0 ? (
            <div style={{
              padding: 24, textAlign: 'center',
              fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#6B7280',
            }}>No associate data</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Associate','Quotes','Value','Leads','Conv%'].map((h, i) => (
                      <th key={i} style={{
                        fontWeight: 600, fontSize: 10.5,
                        color: '#64748b', letterSpacing: '.06em', textTransform: 'uppercase',
                        padding: '10px 16px', textAlign: i === 0 ? 'left' : 'right',
                        borderBottom: '1px solid rgba(0,0,0,0.07)', whiteSpace: 'nowrap',
                        background: '#f8fafc',
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
          ...CARD, padding: '18px 20px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
          }}>
            <div>
              <h3 style={{
                margin: 0,
                fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 14,
                color: '#0F1620',
              }}>Leads by Business Type</h3>
              <div style={{
                fontSize: 11, color: '#64748b', marginTop: 3,
              }}>{stats.leads.total} leads total</div>
            </div>
          </div>
          <LeadsByBiz data={stats.leads_by_client_type || {}} />
        </div>
      </div>

      {/* Lead Pipeline Funnel */}
      {stats.pipeline_stages && (
        <PipelineFunnel pipeline={stats.pipeline_stages} />
      )}

      {/* Top Clients */}
      <TopClients />

      {/* Target vs Actual */}
      <TargetVsActual />

      {/* P&L Dashboard */}
      {pnl && <PnlDashboard pnl={pnl} />}

      {/* Top products + Recent activity */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {/* Top products */}
        <div style={{
          ...CARD, padding: '18px 20px 14px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
          }}>
            <h3 style={{
              margin: 0,
              fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 14,
              color: '#0F1620',
            }}>Top Products</h3>
            <span style={{
              fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#6B7280',
            }}>by units quoted</span>
          </div>
          {topProds.length === 0 ? (
            <div style={{
              padding: '16px 0', textAlign: 'center',
              fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#6B7280',
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
          ...CARD, padding: '18px 20px 10px',
        }}>
          <h3 style={{
            margin: '0 0 2px',
            fontWeight: 700, fontSize: 14, color: '#0f172a',
          }}>Recent Activity</h3>
          {activity.length === 0 ? (
            <div style={{
              padding: '16px 0', textAlign: 'center',
              fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#6B7280',
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
  { id: 'overview',     label: 'Overview'        },
  { id: 'payment',     label: '⏳ Payments'     },
  { id: 'followups',   label: '🔔 Follow-ups'   },
  { id: 'performance', label: '🏆 Performance'  },
  { id: 'team',        label: 'Team'            },
  { id: 'products',   label: 'Products'   },
  { id: 'quotes',     label: 'All Quotes' },
  { id: 'leads',      label: 'All Leads'  },
  { id: 'units',       label: '🏭 Units'       },
  { id: 'discounts',   label: '💸 Discounts'   },
  { id: 'commissions', label: '💰 Commissions' },
  { id: 'reports',     label: 'Reports'        },
  { id: 'settings',    label: '⚙️ Settings'   },
];

export default function AdminPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [tabFilters, setTabFilters] = useState({});
  const [pendingModCount, setPendingModCount]         = useState(0);
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [followUpCount, setFollowUpCount]             = useState(0);
  const [discountApprovalCount, setDiscountApprovalCount] = useState(0);

  useEffect(() => {
    api.get('/api/quotes')
      .then(({ data }) => {
        const count = (data.quotes || []).filter((q) => q.modification_status === 'pending_approval').length;
        setPendingModCount(count);
      })
      .catch(() => {});
    api.get('/api/bills/payment-pending')
      .then(({ data }) => setPendingPaymentCount((data.bills || []).length))
      .catch(() => {});
    api.get('/api/leads/followups/due')
      .then(({ data }) => setFollowUpCount((data.leads || []).length))
      .catch(() => {});
    api.get('/api/quotes/pending-discount-approval')
      .then(({ data }) => setDiscountApprovalCount((data.quotes || []).length))
      .catch(() => {});
  }, [tab]);

  const switchTab = (id, filters = {}) => { setTab(id); setTabFilters(filters); };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const TAB_ICONS = {
    overview: '◉', payment: '⏳', followups: '🔔', team: '👥', products: '📦', quotes: '🧾',
    leads: '📋', units: '🏭', discounts: '💸', commissions: '💰',
    reports: '📊', settings: '⚙️',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: '100vh', background: '#f0f4f8' }}>

      {/* ── Premium header bar ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f2744 100%)',
        borderRadius: 16, padding: '22px 28px', marginBottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        boxShadow: '0 4px 24px rgba(15,23,42,0.25)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
              Admin Console
            </h2>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#ef4444', color: '#fff',
              fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 5,
              letterSpacing: '.1em', textTransform: 'uppercase',
            }}>
              {Ic.shield} ADMIN
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            Welcome back, <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{user?.name?.split(' ')[0]}</span>
            {' '}— here's your business overview
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>{dateStr}</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Sri Vemuri Sai Enterprises</div>
        </div>
      </div>

      {/* ── Tab navigation bar ── */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        position: 'sticky', top: 0, zIndex: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        overflowX: 'auto',
      }}>
        <div style={{ display: 'flex', minWidth: 'max-content', padding: '0 4px' }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            const badge = t.id === 'quotes'     && pendingModCount > 0        ? { count: pendingModCount,       color: '#ea580c' }
                        : t.id === 'payment'   && pendingPaymentCount > 0    ? { count: pendingPaymentCount,   color: '#d97706' }
                        : t.id === 'followups' && followUpCount > 0          ? { count: followUpCount,         color: '#6366f1' }
                        : t.id === 'discounts' && discountApprovalCount > 0  ? { count: discountApprovalCount, color: '#dc2626' }
                        : null;
            return (
              <button key={t.id} onClick={() => switchTab(t.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '14px 18px', border: 'none', background: 'transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? '#1F6BC7' : '#64748b',
                borderBottom: active ? '2px solid #1F6BC7' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: -1,
              }}>
                <span style={{ fontSize: 12, opacity: active ? 1 : 0.6 }}>{TAB_ICONS[t.id]}</span>
                {t.label.replace(/[🏭💸💰⚙️⏳]/g, '').trim()}
                {badge && (
                  <span style={{
                    background: badge.color, color: '#fff',
                    fontSize: 9, fontWeight: 900,
                    borderRadius: '50%', minWidth: 16, height: 16,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px', lineHeight: 1,
                  }}>
                    {badge.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: '20px 0', flex: 1 }}>
        {tab === 'overview'   && <OverviewTab />}
        {tab === 'payment'    && <PaymentPendingTab />}
        {tab === 'followups'   && <FollowUpsTab />}
        {tab === 'performance' && <AssociatePerformanceTab />}
        {tab === 'team'       && <TeamTab onSwitchTab={switchTab} />}
        {tab === 'products'  && <ProductsTab />}
        {tab === 'quotes'    && <QuotesTab initialFilters={tabFilters} />}
        {tab === 'leads'     && <LeadsTab />}
        {tab === 'units'       && <UnitsTab />}
        {tab === 'discounts'   && <DiscountApprovalTab />}
        {tab === 'commissions' && <CommissionTab />}
        {tab === 'reports'     && <ReportsTab />}
        {tab === 'settings'    && <SettingsTab />}
      </div>
    </div>
  );
}
