import React, { useState, useEffect, useCallback } from 'react';
import TeamTab from './admin/TeamTab';
import ProductsTab from './admin/ProductsTab';
import QuotesTab from './admin/QuotesTab';
import LeadsTab from './admin/LeadsTab';
import ReportsTab from './admin/ReportsTab';
import PriceDeviationTab from './admin/PriceDeviationTab';
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

// ─── Pipeline funnel ─────────────────────────────────────────
const PIPE_STAGES = [
  { key: 'new',       label: 'New Leads',  color: '#475569', fill: '#64748B', light: '#F1F5F9' },
  { key: 'contacted', label: 'Contacted',  color: '#0E7490', fill: '#0891B2', light: '#ECFEFF' },
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
    <div style={{
      background: '#FFFFFF', border: '1px solid #ECFEFF',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 10px rgba(8,42,56,.04)',
    }}>
      {/* Card header */}
      <div style={{
        padding: '14px 18px 10px',
        borderBottom: '1px solid #F1F5F9',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <h3 style={{
            margin: 0, fontFamily: "'Nunito', sans-serif",
            fontWeight: 800, fontSize: 14, color: '#164E63',
          }}>Lead Pipeline Funnel</h3>
          <div style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 11,
            color: '#6B7280', marginTop: 2,
          }}>{grandTotal} total leads · stages New → Contacted → Qualified → Converted</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
          <div style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 10,
            color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.06em',
          }}>Overall conversion</div>
          <div style={{
            fontFamily: "'Nunito', sans-serif", fontWeight: 900,
            fontSize: 26, color: '#059669', lineHeight: 1.1,
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
                    fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#94A3B8',
                  }}>
                    ▼ {passPct}% progressed from previous stage
                  </div>
                )}

                {/* Centered tapering bar */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    width: `${barPct}%`, minWidth: count > 0 ? 120 : 0,
                    maxWidth: '100%',
                    background: `linear-gradient(135deg, ${stage.fill}EE, ${stage.fill})`,
                    borderRadius: 8,
                    height: 52,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 14px',
                    transition: 'width .4s ease',
                    boxShadow: `0 2px 8px ${stage.fill}44`,
                  }}>
                    <span style={{
                      fontFamily: "'Nunito', sans-serif", fontWeight: 800,
                      fontSize: 12, color: '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{stage.label}</span>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <div style={{
                        fontFamily: "'Nunito', sans-serif", fontWeight: 900,
                        fontSize: 20, color: '#fff', lineHeight: 1,
                      }}>{count}</div>
                      {value > 0 && (
                        <div style={{
                          fontFamily: "'DM Mono', monospace", fontSize: 9,
                          color: 'rgba(255,255,255,.75)', marginTop: 1,
                        }}>{fmtL(value)}</div>
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
                  fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
                  fontSize: 10, color: stage.color, textTransform: 'uppercase',
                  letterSpacing: '.06em', marginBottom: 4,
                }}>{stage.label}</div>
                <div style={{
                  fontFamily: "'Nunito', sans-serif", fontWeight: 900,
                  fontSize: 22, color: stage.color, lineHeight: 1,
                }}>{count}</div>
                {value > 0 && (
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    color: stage.color, opacity: .75, marginTop: 2,
                  }}>{fmtL(value)}</div>
                )}
                {passPct !== null && (
                  <div style={{
                    marginTop: 5, display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <ArrowRight style={{ color: stage.color, width: 10, height: 10 }} />
                    <span style={{
                      fontFamily: "'Source Sans 3', sans-serif", fontSize: 10,
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
              fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
              fontSize: 12, color: '#B91C1C',
            }}>
              ✖ Lost Leads
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{
                fontFamily: "'Nunito', sans-serif", fontWeight: 900,
                fontSize: 20, color: '#DC2626',
              }}>{lostCount}</span>
              <span style={{
                fontFamily: "'Source Sans 3', sans-serif", fontSize: 10,
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
      fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#9CA3AF',
    }}>⏳ Loading aging quotes…</div>
  );

  // Error state
  if (err) return (
    <div style={{
      border: '1px solid #FECACA', borderRadius: 14,
      padding: '14px 18px', background: '#FEF2F2',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#991B1B' }}>
        ⚠ Aging Quotes: {err}
      </span>
      <button onClick={load} style={{
        background: '#EF4444', color: '#fff', border: 0, borderRadius: 8,
        padding: '5px 14px', cursor: 'pointer',
        fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12,
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
          fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: '#065F46',
        }}>No Aging Quotes — All Clear!</span>
        <span style={{
          marginLeft: 8,
          fontFamily: "'Source Sans 3', sans-serif", fontSize: 11.5, color: '#6B7280',
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
              fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14,
              color: '#991B1B',
            }}>⚠ Aging Quotes Alert</span>
            <span style={{
              marginLeft: 8,
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 11.5, color: '#B91C1C',
            }}>{summary.total} quote{summary.total !== 1 ? 's' : ''} waiting for action</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {AGE_BUCKETS.map((b) => summary[b.key] > 0 && (
            <span key={b.key} style={{
              background: b.pill, color: b.fg,
              fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 11,
              padding: '3px 10px', borderRadius: 999,
              border: `1px solid ${b.border}`,
            }}>
              {summary[b.key]} {b.label}
            </span>
          ))}
          <span style={{
            marginLeft: 4, fontSize: 13, color: '#9CA3AF', fontWeight: 600,
            fontFamily: "'Source Sans 3', sans-serif",
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
                fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
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
                      fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
                      fontSize: 10, color: '#0E7490', letterSpacing: '.07em',
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
                          fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 11,
                          padding: '3px 8px', borderRadius: 999,
                          border: `1px solid ${cfg.border}`,
                          whiteSpace: 'nowrap',
                        }}>{q.age_days}d old</span>
                      </td>
                      {/* Quote # */}
                      <td style={{ padding: '10px 12px' }}>
                        <a href={`/quotes/${q.id}`} style={{
                          fontFamily: "'DM Mono', monospace", fontWeight: 700,
                          fontSize: 12, color: '#0E7490', textDecoration: 'none',
                        }}>{q.quote_number}</a>
                        <div style={{
                          fontFamily: "'Source Sans 3', sans-serif",
                          fontSize: 10, color: '#9CA3AF', marginTop: 1,
                        }}>{q.created_at?.slice(0, 10)}</div>
                      </td>
                      {/* Client */}
                      <td style={{ padding: '10px 12px', maxWidth: 160 }}>
                        <div style={{
                          fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                          fontSize: 12.5, color: '#164E63',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{q.client_business_name || q.client_name}</div>
                        <div style={{
                          fontFamily: "'Source Sans 3', sans-serif",
                          fontSize: 10.5, color: '#6B7280',
                        }}>{q.client_name} · {q.client_city || '—'}</div>
                      </td>
                      {/* Associate */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{
                          fontFamily: "'Source Sans 3', sans-serif",
                          fontSize: 12, color: '#374151', fontWeight: 600,
                        }}>{q.employee_name}</div>
                        <div style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10, color: '#9CA3AF',
                        }}>{q.employee_code}</div>
                      </td>
                      {/* Status */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          background: q.status === 'sent' ? '#ECFEFF' : '#F1F5F9',
                          color:      q.status === 'sent' ? '#0E7490'  : '#374151',
                          fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
                          fontSize: 9.5, padding: '2px 8px', borderRadius: 999,
                          textTransform: 'uppercase', letterSpacing: '.06em',
                        }}>{q.status}</span>
                      </td>
                      {/* Amount */}
                      <td style={{
                        padding: '10px 12px', textAlign: 'right',
                        fontFamily: "'DM Mono', monospace", fontWeight: 600,
                        fontSize: 12, color: '#164E63', whiteSpace: 'nowrap',
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
                            color: overdue ? '#991B1B' : '#0E7490',
                            fontFamily: "'DM Mono', monospace", fontSize: 10,
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
                            fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
                            cursor: 'pointer', marginRight: 4,
                          }}>✓ Accept</button>
                        <button
                          onClick={() => updateStatus(q, 'rejected')}
                          style={{
                            background: '#FEE2E2', color: '#991B1B', border: 0,
                            borderRadius: 6, padding: '4px 9px', fontSize: 11,
                            fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
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
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 11.5, color: '#9CA3AF',
            }}>
              {visible.length} quote{visible.length !== 1 ? 's' : ''} shown
            </span>
            <span style={{
              fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 13,
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
            margin: 0, fontFamily: "'Nunito', sans-serif",
            fontWeight: 800, fontSize: 14, color: '#164E63',
          }}>🏆 Top Clients by Revenue</h3>
          <div style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 11,
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
              background: period === p.key ? '#0891B2' : 'transparent',
              color: period === p.key ? '#fff' : '#6B7280',
              fontFamily: "'Source Sans 3', sans-serif",
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
          fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#6B7280',
        }}>Loading…</div>
      ) : err ? (
        <div style={{
          padding: '24px 18px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#991B1B' }}>
            ⚠ {err}
          </span>
          <button onClick={() => load(period)} style={{
            background: '#0891B2', color: '#fff', border: 0, borderRadius: 8,
            padding: '5px 14px', cursor: 'pointer',
            fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12,
          }}>Retry</button>
        </div>
      ) : clients.length === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center',
          fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#6B7280',
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
                      fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12,
                    }}>
                      {i < 3 ? MEDALS[i] : i + 1}
                    </div>

                    {/* Name */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Nunito', sans-serif", fontWeight: 800,
                        fontSize: 13, color: '#164E63',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{c.client}</div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap',
                      }}>
                        {/* Type badge */}
                        <span style={{
                          background: cfg.bg, color: cfg.fg,
                          fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 10,
                          padding: '1px 6px', borderRadius: 999,
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>{cfg.emoji} {c.client_type}</span>
                        {/* City */}
                        {c.client_city && (
                          <span style={{
                            fontFamily: "'Source Sans 3', sans-serif", fontSize: 10.5, color: '#9CA3AF',
                          }}>📍 {c.client_city}</span>
                        )}
                        {/* Associate */}
                        {c.top_associate && (
                          <span style={{
                            fontFamily: "'Source Sans 3', sans-serif", fontSize: 10.5, color: '#9CA3AF',
                          }}>👤 {c.top_associate}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: revenue + stats */}
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{
                      fontFamily: "'DM Mono', monospace", fontWeight: 700,
                      fontSize: 14, color: '#164E63',
                    }}>{fmtL(c.total_revenue)}</div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      justifyContent: 'flex-end', marginTop: 2,
                    }}>
                      <span style={{
                        fontFamily: "'Source Sans 3', sans-serif", fontSize: 10.5, color: '#6B7280',
                      }}>{c.quote_count} quote{c.quote_count !== 1 ? 's' : ''}</span>
                      {/* Win rate */}
                      <span style={{
                        background: winColor + '22', color: winColor,
                        fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 10,
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
                      background: `linear-gradient(90deg, #0891B2, #06B6D4)`,
                      borderRadius: 999, transition: 'width .4s ease',
                    }} />
                  </div>
                  {c.accepted_revenue > 0 && (
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
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
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: '#9CA3AF',
          }}>
            Showing top {clients.length} clients
          </span>
          <span style={{
            fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 12, color: '#0E7490',
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
  p >= 100 ? '#059669' : p >= 80 ? '#0891B2' : p >= 50 ? '#F59E0B' : '#EF4444';

const ProgBar = ({ actual, target, fmt }) => {
  if (!target) return (
    <span style={{ fontSize: 11, color: '#9CA3AF', fontFamily: "'Source Sans 3', sans-serif" }}>
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
          fontFamily: "'DM Mono', monospace", fontSize: 11,
          color: '#164E63', fontWeight: 700,
        }}>{fmt(actual)}</span>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9CA3AF',
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
        fontFamily: "'DM Mono', monospace", fontSize: 10,
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
  if (rp >= 80)  return { label: '🔵 On Track',        bg: '#ECFEFF', fg: '#0E7490' };
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
              margin: 0, fontFamily: "'Nunito', sans-serif",
              fontWeight: 800, fontSize: 14, color: '#164E63',
            }}>Target vs Actual</h3>
            <div style={{
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 11,
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
                fontFamily: "'DM Mono', monospace", fontSize: 11,
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
                background: '#0891B2', color: '#fff',
                border: 0, borderRadius: 8, cursor: 'pointer',
                fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12,
                padding: '6px 14px', whiteSpace: 'nowrap',
              }}
            >Set Targets</button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{
            padding: 32, textAlign: 'center',
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#6B7280',
          }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{
            padding: 32, textAlign: 'center',
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#6B7280',
          }}>No active associates found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Associate', 'Revenue vs Target', 'Leads vs Target', 'Conversions', 'Status'].map((h, i) => (
                    <th key={i} style={{
                      fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
                      fontSize: 10, color: '#0E7490', letterSpacing: '.07em',
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
                            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 11,
                          }}>{initials(r.name)}</div>
                          <div>
                            <div style={{
                              fontFamily: "'Nunito', sans-serif", fontWeight: 800,
                              fontSize: 13, color: '#164E63',
                            }}>{r.name}</div>
                            <div style={{
                              fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#6B7280',
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
                          fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
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
                      fontFamily: "'Nunito', sans-serif", fontWeight: 800,
                      fontSize: 12, color: '#164E63',
                    }}>Team Total</td>
                    <td style={{ padding: '10px 14px', minWidth: 160 }}>
                      <ProgBar actual={totRev} target={totTgt} fmt={fmtL} />
                    </td>
                    <td style={{
                      padding: '10px 14px',
                      fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#164E63',
                    }}>{totLd} leads</td>
                    <td style={{
                      padding: '10px 14px',
                      fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#164E63',
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
      fontFamily: "'Source Sans 3', sans-serif",
    }}>Loading dashboard…</div>
  );

  if (error) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 60, gap: 12,
    }}>
      <div style={{
        fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 15, color: '#991B1B',
      }}>Dashboard failed to load</div>
      <div style={{
        fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: '#6B7280',
      }}>{error}</div>
      <button onClick={load} style={{
        background: '#0891B2', color: '#fff', border: 0, borderRadius: 8,
        padding: '8px 18px', cursor: 'pointer',
        fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13,
      }}>Retry</button>
    </div>
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

      {/* Lead Pipeline Funnel */}
      {stats.pipeline_stages && (
        <PipelineFunnel pipeline={stats.pipeline_stages} />
      )}

      {/* Top Clients */}
      <TopClients />

      {/* Target vs Actual */}
      <TargetVsActual />

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
  { id: 'overview',   label: 'Overview'   },
  { id: 'team',       label: 'Team'       },
  { id: 'products',   label: 'Products'   },
  { id: 'quotes',     label: 'All Quotes' },
  { id: 'leads',      label: 'All Leads'  },
  { id: 'discounts',  label: '💸 Discounts' },
  { id: 'reports',    label: 'Reports'    },
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
        {tab === 'discounts' && <PriceDeviationTab />}
        {tab === 'reports'   && <ReportsTab />}
      </div>
    </div>
  );
}
