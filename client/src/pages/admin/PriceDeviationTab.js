import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

/* ─── Formatters ─────────────────────────────────────────────── */
const fmtINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const fmtL = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

/* ─── Colour helpers ─────────────────────────────────────────── */
const discountColor = (pct) => {
  if (pct <= 0) return { bg: '#FEF9C3', fg: '#92400E', bar: '#EAB308' }; // above catalog → amber
  if (pct < 5)  return { bg: '#ECFEFF', fg: '#0E7490', bar: '#0891B2' }; // tiny – cyan
  if (pct < 15) return { bg: '#FEF3C7', fg: '#92400E', bar: '#F59E0B' }; // moderate – yellow
  if (pct < 30) return { bg: '#FFEDD5', fg: '#9A3412', bar: '#F97316' }; // high – orange
  return               { bg: '#FEE2E2', fg: '#991B1B', bar: '#EF4444' }; // extreme – red
};

const winRateColor = (pct) =>
  pct <= 0 ? '#EF4444' : pct < 5 ? '#0891B2' : pct < 15 ? '#F59E0B' : pct < 30 ? '#F97316' : '#EF4444';

/* ─── Sub-components ─────────────────────────────────────────── */
const KPICard = ({ label, value, sub, accent = '#0891B2', icon }) => (
  <div style={{
    background: '#fff', border: '1px solid #E5E7EB',
    borderRadius: 12, padding: '16px 18px',
    boxShadow: '0 1px 6px rgba(0,0,0,.04)',
    position: 'relative', overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute', top: 14, right: 14,
      width: 34, height: 34, borderRadius: 9,
      background: accent + '1A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16,
    }}>{icon}</div>
    <div style={{
      fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600,
      fontSize: 10.5, color: '#6B7280', letterSpacing: '.06em',
      textTransform: 'uppercase', marginBottom: 6,
    }}>{label}</div>
    <div style={{
      fontFamily: "'Nunito', sans-serif", fontWeight: 900,
      fontSize: 26, color: accent, lineHeight: 1,
    }}>{value}</div>
    {sub && (
      <div style={{
        fontFamily: "'Source Sans 3', sans-serif", fontSize: 11.5,
        color: '#9CA3AF', marginTop: 6,
      }}>{sub}</div>
    )}
  </div>
);

const DiscPctBadge = ({ pct }) => {
  const c = discountColor(pct);
  return (
    <span style={{
      display: 'inline-block',
      background: c.bg, color: c.fg,
      fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 11,
      padding: '2px 8px', borderRadius: 999,
      whiteSpace: 'nowrap',
    }}>
      {pct > 0 ? `-${pct}%` : pct < 0 ? `+${Math.abs(pct)}%` : '0%'}
    </span>
  );
};

const BarRow = ({ label, sub, value, max, pct, extra }) => {
  const c = discountColor(pct);
  const barW = max > 0 ? Math.max((Math.abs(value) / Math.abs(max)) * 100, value !== 0 ? 4 : 0) : 0;
  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid #F8FAFC' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 5,
      }}>
        <div>
          <div style={{
            fontFamily: "'Nunito', sans-serif", fontWeight: 700,
            fontSize: 12.5, color: '#164E63',
          }}>{label}</div>
          {sub && (
            <div style={{
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 10.5, color: '#9CA3AF', marginTop: 1,
            }}>{sub}</div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontWeight: 700,
            fontSize: 12, color: value >= 0 ? c.fg : '#065F46',
          }}>
            {value >= 0 ? '-' : '+'}{fmtL(Math.abs(value))}
          </div>
          {extra && (
            <div style={{
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 10.5, color: '#9CA3AF', marginTop: 1,
            }}>{extra}</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, height: 6, background: '#F1F5F9',
          borderRadius: 999, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${barW}%`,
            background: `linear-gradient(90deg, ${c.bar}, ${c.bar}CC)`,
            borderRadius: 999, transition: 'width .4s ease',
          }} />
        </div>
        <DiscPctBadge pct={pct} />
      </div>
    </div>
  );
};

const SectionCard = ({ title, sub, children }) => (
  <div style={{
    background: '#fff', border: '1px solid #E5E7EB',
    borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 1px 8px rgba(0,0,0,.04)',
  }}>
    <div style={{
      padding: '13px 16px 10px',
      borderBottom: '1px solid #F1F5F9',
    }}>
      <h3 style={{
        margin: 0, fontFamily: "'Nunito', sans-serif",
        fontWeight: 800, fontSize: 13.5, color: '#164E63',
      }}>{title}</h3>
      {sub && (
        <div style={{
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: 11, color: '#9CA3AF', marginTop: 2,
        }}>{sub}</div>
      )}
    </div>
    <div style={{ padding: '8px 16px 12px' }}>{children}</div>
  </div>
);

/* ─── STATUS badge ───────────────────────────────────────────── */
const STATUS_CFG = {
  draft:    { bg: '#F1F5F9', fg: '#374151' },
  sent:     { bg: '#ECFEFF', fg: '#0E7490' },
  accepted: { bg: '#D1FAE5', fg: '#065F46' },
  rejected: { bg: '#FEE2E2', fg: '#991B1B' },
};

/* ─── Main component ─────────────────────────────────────────── */
const PERIODS = [
  { key: 'all',     label: 'All Time'     },
  { key: 'year',    label: 'This Year'    },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'month',   label: 'This Month'   },
];

export default function PriceDeviationTab() {
  const { toast } = useToast();
  const [period,   setPeriod]   = useState('all');
  const [from,     setFrom]     = useState('');
  const [to,       setTo]       = useState('');
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState(null);
  const [search,   setSearch]   = useState('');
  const [sortBy,   setSortBy]   = useState('discount_amount'); // discount_amount | discount_pct | quoted_value
  const [expandedQuote, setExpandedQuote] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ period });
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      const { data: res } = await api.get(`/api/reports/price-deviation?${params}`);
      setData(res);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load price deviation data');
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => { load(); }, [load]);

  const quoteDetails = useMemo(() => {
    if (!data?.quote_details) return [];
    let rows = data.quote_details;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.quote_number.toLowerCase().includes(q) ||
        r.client.toLowerCase().includes(q) ||
        r.employee_name.toLowerCase().includes(q) ||
        (r.employee_code || '').toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      if (sortBy === 'discount_pct')   return b.discount_pct   - a.discount_pct;
      if (sortBy === 'quoted_value')   return b.quoted_value   - a.quoted_value;
      return b.discount_amount - a.discount_amount;
    });
  }, [data, search, sortBy]);

  /* ── Render ── */
  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 60, color: '#6B7280',
      fontFamily: "'Source Sans 3', sans-serif", fontSize: 14,
    }}>Loading price deviation data…</div>
  );

  if (err) return (
    <div style={{
      padding: 40, textAlign: 'center', display: 'flex',
      flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        fontFamily: "'Nunito', sans-serif", fontWeight: 800,
        fontSize: 15, color: '#991B1B',
      }}>{err}</div>
      <button onClick={load} style={{
        background: '#0891B2', color: '#fff', border: 0,
        borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
        fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13,
      }}>Retry</button>
    </div>
  );

  const s = data?.summary || {};
  const maxAssocDisc = data?.by_associate?.[0]?.discount || 1;
  const maxProdDisc  = data?.by_product?.[0]?.discount   || 1;
  const maxTypeDisc  = data?.by_client_type?.[0]?.discount || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Page header + filters ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h2 style={{
            margin: 0, fontFamily: "'Nunito', sans-serif",
            fontWeight: 900, fontSize: 18, color: '#164E63',
          }}>💸 Discount / Price Deviation Tracker</h2>
          <div style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 12,
            color: '#6B7280', marginTop: 3,
          }}>
            Track quotes where client price differs from catalog price
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Period tabs */}
          <div style={{
            display: 'flex', gap: 3, background: '#F1F5F9',
            borderRadius: 8, padding: 3,
          }}>
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => { setPeriod(p.key); setFrom(''); setTo(''); }} style={{
                border: 0, borderRadius: 6, cursor: 'pointer',
                padding: '4px 10px',
                background: period === p.key && !from && !to ? '#0891B2' : 'transparent',
                color: period === p.key && !from && !to ? '#fff' : '#6B7280',
                fontFamily: "'Source Sans 3', sans-serif",
                fontWeight: 600, fontSize: 11,
              }}>{p.label}</button>
            ))}
          </div>
          {/* Date range */}
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPeriod('all'); }}
            style={{
              border: '1px solid #E5E7EB', borderRadius: 8,
              padding: '5px 10px', fontSize: 12, color: '#374151',
            }} />
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>to</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPeriod('all'); }}
            style={{
              border: '1px solid #E5E7EB', borderRadius: 8,
              padding: '5px 10px', fontSize: 12, color: '#374151',
            }} />
        </div>
      </div>

      {/* ── KPI row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
      }}>
        <KPICard
          icon="🏷️" label="Total Discount Given" accent="#EF4444"
          value={fmtL(s.total_discount)}
          sub={`across ${s.quotes_with_deviation} quote${s.quotes_with_deviation !== 1 ? 's' : ''}`}
        />
        <KPICard
          icon="📉" label="Avg Discount %" accent="#F97316"
          value={`${s.avg_discount_pct}%`}
          sub="of catalog price waived"
        />
        <KPICard
          icon="📋" label="Catalog Value" accent="#0891B2"
          value={fmtL(s.total_catalog)}
          sub={`quoted at ${fmtL(s.total_quoted)}`}
        />
        <KPICard
          icon="⬆️" label="Above Catalog" accent="#F59E0B"
          value={s.above_catalog_items}
          sub="line items priced above catalog"
        />
        <KPICard
          icon="⬇️" label="Discounted Items" accent="#6B7280"
          value={s.discounted_items}
          sub="line items below catalog price"
        />
      </div>

      {/* ── 3-column breakdowns ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 14,
      }}>

        {/* By Associate */}
        <SectionCard
          title="By Associate"
          sub="Total discount given per sales associate"
        >
          {(data?.by_associate || []).length === 0 ? (
            <div style={{ padding: '12px 0', color: '#9CA3AF', fontSize: 13 }}>No data</div>
          ) : (data.by_associate).map((a, i) => (
            <BarRow
              key={i}
              label={a.name}
              sub={`${a.code}${a.region ? ` · ${a.region}` : ''} · ${a.quotes} quote${a.quotes !== 1 ? 's' : ''}`}
              value={a.discount}
              max={maxAssocDisc}
              pct={a.discount_pct}
              extra={`${a.discounted_quotes} discounted`}
            />
          ))}
        </SectionCard>

        {/* By Product */}
        <SectionCard
          title="By Product"
          sub="Most-discounted products by total ₹ given away"
        >
          {(data?.by_product || []).slice(0, 10).length === 0 ? (
            <div style={{ padding: '12px 0', color: '#9CA3AF', fontSize: 13 }}>No data</div>
          ) : (data.by_product).slice(0, 10).map((p, i) => (
            <BarRow
              key={i}
              label={p.name}
              sub={p.category}
              value={p.discount}
              max={maxProdDisc}
              pct={p.discount_pct}
              extra={`${p.items} units`}
            />
          ))}
        </SectionCard>

        {/* By Client Type */}
        <SectionCard
          title="By Client Type"
          sub="Which business segments get the deepest discounts"
        >
          {(data?.by_client_type || []).length === 0 ? (
            <div style={{ padding: '12px 0', color: '#9CA3AF', fontSize: 13 }}>No data</div>
          ) : (data.by_client_type).map((t, i) => (
            <BarRow
              key={i}
              label={t.type}
              sub={`${t.quotes} quote${t.quotes !== 1 ? 's' : ''}`}
              value={t.discount}
              max={maxTypeDisc}
              pct={t.discount_pct}
              extra={fmtL(t.catalog) + ' catalog'}
            />
          ))}
        </SectionCard>

      </div>

      {/* ── Quote-level detail table ── */}
      <div style={{
        background: '#fff', border: '1px solid #E5E7EB',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 1px 8px rgba(0,0,0,.04)',
      }}>
        {/* Table header + controls */}
        <div style={{
          padding: '13px 16px 10px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <div>
            <h3 style={{
              margin: 0, fontFamily: "'Nunito', sans-serif",
              fontWeight: 800, fontSize: 13.5, color: '#164E63',
            }}>Quote-Level Breakdown</h3>
            <div style={{
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 11, color: '#9CA3AF', marginTop: 2,
            }}>
              {quoteDetails.length} of {data?.quote_details?.length || 0} quotes with price deviation
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="search" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quote / client / associate…"
              style={{
                border: '1px solid #E5E7EB', borderRadius: 8,
                padding: '6px 12px', fontSize: 12, width: 220,
              }}
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{
              border: '1px solid #E5E7EB', borderRadius: 8,
              padding: '6px 10px', fontSize: 12,
            }}>
              <option value="discount_amount">Sort: Discount ₹</option>
              <option value="discount_pct">Sort: Discount %</option>
              <option value="quoted_value">Sort: Quoted Value</option>
            </select>
          </div>
        </div>

        {quoteDetails.length === 0 ? (
          <div style={{
            padding: 40, textAlign: 'center',
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#9CA3AF',
          }}>
            {search ? 'No quotes match your search.' : 'No price deviation found for this period.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Quote', 'Client', 'Associate', 'Status', 'Catalog Value', 'Quoted Value', 'Discount', 'Disc %', ''].map((h, i) => (
                    <th key={i} style={{
                      fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
                      fontSize: 10, color: '#0E7490', letterSpacing: '.07em',
                      textTransform: 'uppercase', padding: '9px 12px',
                      textAlign: i >= 4 ? 'right' : 'left',
                      borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quoteDetails.map((q) => {
                  const isExpanded = expandedQuote === q.id;
                  const sc = STATUS_CFG[q.status] || STATUS_CFG.draft;
                  const dc = discountColor(q.discount_pct);
                  return (
                    <React.Fragment key={q.id}>
                      <tr style={{
                        borderBottom: isExpanded ? 'none' : '1px solid #F1F5F9',
                        borderLeft: `3px solid ${dc.bar}`,
                        background: isExpanded ? '#FAFAFA' : '#fff',
                        cursor: 'pointer',
                      }} onClick={() => setExpandedQuote(isExpanded ? null : q.id)}>
                        {/* Quote */}
                        <td style={{ padding: '10px 12px' }}>
                          <Link
                            to={`/quotes/${q.id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontFamily: "'DM Mono', monospace", fontWeight: 700,
                              fontSize: 12, color: '#0E7490', textDecoration: 'none',
                            }}
                          >{q.quote_number}</Link>
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
                          }}>{q.client}</div>
                          <div style={{
                            fontFamily: "'Source Sans 3', sans-serif",
                            fontSize: 10.5, color: '#9CA3AF',
                          }}>{q.client_type}{q.client_city ? ` · ${q.client_city}` : ''}</div>
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
                            background: sc.bg, color: sc.fg,
                            fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
                            fontSize: 9.5, padding: '2px 8px', borderRadius: 999,
                            textTransform: 'uppercase', letterSpacing: '.06em',
                          }}>{q.status}</span>
                        </td>
                        {/* Catalog */}
                        <td style={{
                          padding: '10px 12px', textAlign: 'right',
                          fontFamily: "'DM Mono', monospace", fontSize: 12,
                          color: '#6B7280',
                        }}>{fmtINR(q.catalog_value)}</td>
                        {/* Quoted */}
                        <td style={{
                          padding: '10px 12px', textAlign: 'right',
                          fontFamily: "'DM Mono', monospace", fontSize: 12,
                          color: '#164E63', fontWeight: 700,
                        }}>{fmtINR(q.quoted_value)}</td>
                        {/* Discount ₹ */}
                        <td style={{
                          padding: '10px 12px', textAlign: 'right',
                          fontFamily: "'DM Mono', monospace", fontSize: 12,
                          color: q.discount_amount >= 0 ? dc.fg : '#065F46',
                          fontWeight: 700,
                        }}>
                          {q.discount_amount >= 0 ? '-' : '+'}{fmtINR(Math.abs(q.discount_amount))}
                        </td>
                        {/* Disc % */}
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <DiscPctBadge pct={q.discount_pct} />
                        </td>
                        {/* Expand toggle */}
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 11, color: '#9CA3AF' }}>
                          {isExpanded ? '▲' : '▼'}
                        </td>
                      </tr>

                      {/* Expanded item breakdown */}
                      {isExpanded && (
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td colSpan={9} style={{
                            padding: '0 12px 12px 36px',
                            background: '#FAFAFA',
                          }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                              <thead>
                                <tr>
                                  {['Product', 'Category', 'Qty', 'Catalog ₹', 'Quoted ₹', 'Deviation'].map((h, i) => (
                                    <th key={i} style={{
                                      fontFamily: "'Source Sans 3', sans-serif",
                                      fontWeight: 700, fontSize: 9.5,
                                      color: '#0E7490', padding: '6px 8px',
                                      textAlign: i >= 2 ? 'right' : 'left',
                                      borderBottom: '1px solid #E5E7EB',
                                      textTransform: 'uppercase', letterSpacing: '.05em',
                                    }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(q.items || []).map((it, j) => (
                                  <tr key={j} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                    <td style={{
                                      padding: '6px 8px',
                                      fontFamily: "'Nunito', sans-serif",
                                      fontWeight: 700, fontSize: 11.5, color: '#164E63',
                                    }}>{it.name}</td>
                                    <td style={{
                                      padding: '6px 8px',
                                      fontFamily: "'Source Sans 3', sans-serif",
                                      fontSize: 11, color: '#9CA3AF',
                                    }}>{it.category}</td>
                                    <td style={{
                                      padding: '6px 8px', textAlign: 'right',
                                      fontFamily: "'DM Mono', monospace",
                                      fontSize: 11, color: '#374151',
                                    }}>{it.qty}</td>
                                    <td style={{
                                      padding: '6px 8px', textAlign: 'right',
                                      fontFamily: "'DM Mono', monospace",
                                      fontSize: 11, color: '#6B7280',
                                    }}>{fmtINR(it.catalog)}</td>
                                    <td style={{
                                      padding: '6px 8px', textAlign: 'right',
                                      fontFamily: "'DM Mono', monospace",
                                      fontSize: 11,
                                      color: it.quoted < it.catalog ? '#065F46' :
                                             it.quoted > it.catalog ? '#92400E' : '#374151',
                                      fontWeight: 700,
                                    }}>
                                      {it.quoted < it.catalog && '↓ '}
                                      {it.quoted > it.catalog && '↑ '}
                                      {fmtINR(it.quoted)}
                                    </td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                      <DiscPctBadge pct={it.discount_pct} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
