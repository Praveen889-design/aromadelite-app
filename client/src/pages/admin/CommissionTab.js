import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { downloadCSV } from '../../utils/csv';

/* ─── Formatters ──────────────────────────────────────────────── */
const fmtINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const fmtL = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthLabel = (y, m) => `${MONTHS[m - 1]} ${y}`;

const avatarColors = [
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#E0E7FF', fg: '#3730A3' },
  { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#FEE2E2', fg: '#991B1B' },
  { bg: '#ECFEFF', fg: '#0E7490' },
];
const avatarColor = (name = '') => avatarColors[(name.charCodeAt(0) || 0) % avatarColors.length];
const initials = (name = '') =>
  name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

/* ─── CommissionTypeBadge ─────────────────────────────────────── */
const CommissionTypeBadge = ({ row }) => {
  if (!row.has_structure) return (
    <span style={{
      background: '#F1F5F9', color: '#94A3B8',
      fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
      fontSize: 10, padding: '2px 8px', borderRadius: 999,
    }}>Not set</span>
  );
  if (row.commission_type === 'flat') return (
    <span style={{
      background: '#ECFEFF', color: '#0E7490',
      fontFamily: "'DM Mono', monospace", fontWeight: 700,
      fontSize: 10.5, padding: '2px 8px', borderRadius: 999,
    }}>Flat {row.flat_rate}%</span>
  );
  const slabs = row.slabs || [];
  return (
    <span style={{
      background: '#F3E8FF', color: '#6B21A8',
      fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
      fontSize: 10, padding: '2px 8px', borderRadius: 999,
    }}>Slab · {slabs.length} tier{slabs.length !== 1 ? 's' : ''}</span>
  );
};

/* ─── SlabPreview (tooltip-style) ────────────────────────────── */
const SlabPreview = ({ slabs }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    {slabs.map((s, i) => (
      <div key={i} style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
        fontFamily: "'Source Sans 3', sans-serif",
      }}>
        <span style={{ color: '#6B7280', minWidth: 80 }}>
          {fmtL(s.min)} – {s.max != null && s.max !== '' ? fmtL(s.max) : '∞'}
        </span>
        <span style={{
          background: '#F3E8FF', color: '#6B21A8',
          fontFamily: "'DM Mono', monospace", fontWeight: 700,
          fontSize: 10, padding: '1px 6px', borderRadius: 999,
        }}>{s.rate}%</span>
      </div>
    ))}
  </div>
);

/* ─── Drill-down modal ────────────────────────────────────────── */
function DrillDownModal({ row, year, month, onClose }) {
  const [quotes, setQuotes] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/commissions/quotes/${row.employee_id}?year=${year}&month=${month}`)
      .then(({ data }) => setQuotes(data.quotes || []))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, [row.employee_id, year, month]);

  const commission = row.commission_earned;
  const col = avatarColor(row.name);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 px-3 py-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: col.bg, color: col.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13,
          }}>{initials(row.name)}</div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 15, color: '#164E63' }}>
              {row.name}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: '#9CA3AF' }}>
              {row.employee_code}{row.region ? ` · ${row.region}` : ''} · {monthLabel(year, month)}
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>Commission</div>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 22, color: '#059669' }}>{fmtINR(commission)}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl ml-2">×</button>
        </div>

        {/* Commission structure summary */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <CommissionTypeBadge row={row} />
          {row.commission_type === 'slab' && row.slabs.length > 0 && (
            <SlabPreview slabs={row.slabs} />
          )}
          <div className="ml-auto text-right">
            <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: '#6B7280' }}>
              Accepted Revenue: <strong style={{ color: '#164E63' }}>{fmtINR(row.accepted_revenue)}</strong>
            </span>
          </div>
        </div>

        {/* Quotes table */}
        <div className="overflow-y-auto max-h-[55vh]">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading quotes…</div>
          ) : quotes.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No accepted quotes this month.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {['Quote', 'Client', 'Amount', 'Date'].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 text-[10px] uppercase tracking-wide text-slate-500 font-semibold border-b border-slate-200 ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 12, color: '#0E7490' }}>{q.quote_number}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12.5, color: '#164E63' }}>{q.client_business_name || q.client_name}</div>
                      <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 10.5, color: '#9CA3AF' }}>{q.client_type}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 12, color: '#164E63' }}>
                      {fmtINR(q.total_amount)}
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: '#9CA3AF' }}>
                      {q.created_at?.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={2} className="px-4 py-2.5" style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5, color: '#164E63' }}>
                    Total ({quotes.length} quotes)
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 13, color: '#059669' }}>
                    {fmtINR(row.accepted_revenue)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Commission Structure Modal ──────────────────────────────── */
function SetCommissionModal({ row, onClose, onSaved }) {
  const { toast } = useToast();
  const [type,      setType]     = useState(row?.commission_type || 'flat');
  const [flatRate,  setFlatRate] = useState(row?.flat_rate != null ? String(row.flat_rate) : '');
  const [slabs,     setSlabs]    = useState(
    row?.slabs?.length
      ? row.slabs.map((s) => ({ min: String(s.min || 0), max: s.max != null ? String(s.max) : '', rate: String(s.rate || 0) }))
      : [{ min: '0', max: '', rate: '' }]
  );
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState('');

  /* Live preview */
  useEffect(() => {
    const rev = 100000;
    if (type === 'flat') {
      const r = Number(flatRate) || 0;
      setPreview(`At ₹1L revenue → ${r}% = ${fmtINR(rev * r / 100)} commission`);
    } else {
      const sorted = [...slabs]
        .map((s) => ({ min: Number(s.min) || 0, max: s.max !== '' ? Number(s.max) : null, rate: Number(s.rate) || 0 }))
        .sort((a, b) => a.min - b.min);
      let comm = 0;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const s = sorted[i];
        if (rev >= s.min && (s.max == null || rev < s.max)) { comm = rev * s.rate / 100; break; }
      }
      setPreview(`At ₹1L revenue → ${fmtINR(comm)} commission`);
    }
  }, [type, flatRate, slabs]);

  const addSlab = () => {
    const last = slabs[slabs.length - 1];
    const newMin = last?.max !== '' && last?.max != null ? last.max : '';
    setSlabs([...slabs, { min: newMin, max: '', rate: '' }]);
  };

  const updSlab = (i, field, val) => {
    setSlabs((prev) => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));
  };

  const removeSlab = (i) => setSlabs((prev) => prev.filter((_, j) => j !== i));

  const save = async () => {
    if (type === 'flat' && (Number(flatRate) < 0 || flatRate === '')) {
      return toast('Enter a valid flat rate %', { kind: 'error' });
    }
    if (type === 'slab' && slabs.some((s) => s.rate === '' || Number(s.rate) < 0)) {
      return toast('Fill all slab rates', { kind: 'error' });
    }
    setSaving(true);
    try {
      const body = {
        employee_id: row.employee_id,
        type,
        flat_rate: type === 'flat' ? Number(flatRate) : 0,
        slabs: type === 'slab'
          ? slabs.map((s) => ({ min: Number(s.min) || 0, max: s.max !== '' ? Number(s.max) : null, rate: Number(s.rate) || 0 }))
          : [],
      };
      await api.post('/api/commissions/structure', body);
      toast(`Commission saved for ${row.name}`, { kind: 'success' });
      onSaved();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.error || 'Save failed', { kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 w-full text-right';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 px-3 py-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 15, color: '#164E63', margin: 0 }}>
              Set Commission — {row.name}
            </h2>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: '#9CA3AF', marginTop: 2 }}>
              {row.employee_code}{row.region ? ` · ${row.region}` : ''}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl">×</button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Type toggle */}
          <div>
            <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
              Commission Type
            </div>
            <div className="flex gap-3">
              {[
                { key: 'flat', label: '📊 Flat Rate', sub: 'Single % on all revenue' },
                { key: 'slab', label: '📈 Slab-wise', sub: 'Different % per revenue band' },
              ].map((t) => (
                <button key={t.key} onClick={() => setType(t.key)} style={{
                  flex: 1, border: `2px solid ${type === t.key ? '#0891B2' : '#E5E7EB'}`,
                  borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                  background: type === t.key ? '#ECFEFF' : '#fff',
                  transition: 'all .15s',
                }}>
                  <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: type === t.key ? '#0E7490' : '#374151' }}>{t.label}</div>
                  <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{t.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Flat rate input */}
          {type === 'flat' && (
            <div>
              <label style={{ fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>
                Commission Rate (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100} step={0.1}
                  value={flatRate}
                  onChange={(e) => setFlatRate(e.target.value)}
                  placeholder="e.g. 8"
                  className={inputCls}
                  style={{ maxWidth: 120 }}
                />
                <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: '#374151' }}>% of accepted revenue</span>
              </div>
            </div>
          )}

          {/* Slab builder */}
          {type === 'slab' && (
            <div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Revenue Slabs
              </div>
              <table className="w-full text-sm mb-2">
                <thead>
                  <tr>
                    {['From (₹)', 'To (₹)', 'Rate %', ''].map((h, i) => (
                      <th key={i} style={{
                        fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 10,
                        color: '#0E7490', textTransform: 'uppercase', letterSpacing: '.05em',
                        padding: '4px 6px', textAlign: 'right', borderBottom: '1px solid #E5E7EB',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slabs.map((s, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-1.5 py-1.5">
                        <input type="number" min={0} value={s.min} onChange={(e) => updSlab(i, 'min', e.target.value)}
                          className={inputCls} placeholder="0" />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input type="number" min={0} value={s.max} onChange={(e) => updSlab(i, 'max', e.target.value)}
                          className={inputCls} placeholder="No limit" />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input type="number" min={0} max={100} step={0.1} value={s.rate}
                          onChange={(e) => updSlab(i, 'rate', e.target.value)}
                          className={inputCls} placeholder="%" />
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        {slabs.length > 1 && (
                          <button onClick={() => removeSlab(i)} style={{
                            color: '#EF4444', fontWeight: 700, fontSize: 16,
                            background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
                          }}>×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addSlab} style={{
                background: '#F0F9FF', color: '#0891B2', border: '1px dashed #BAE6FD',
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 12,
              }}>+ Add Slab</button>
              <div style={{ marginTop: 8, fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: '#94A3B8' }}>
                💡 Leave "To" blank on the last slab to cover all revenue above the minimum.
              </div>
            </div>
          )}

          {/* Live preview */}
          {preview && (
            <div style={{
              background: '#F0FDF4', border: '1px solid #A7F3D0',
              borderRadius: 8, padding: '10px 14px',
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 12.5, color: '#065F46',
              fontWeight: 600,
            }}>
              📊 Preview: {preview}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Commission'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main tab ────────────────────────────────────────────────── */
export default function CommissionTab() {
  const { toast } = useToast();
  const now = new Date();
  const [year,    setYear]    = useState(now.getFullYear());
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState(null);
  const [configRow,   setConfigRow]   = useState(null); // row being configured
  const [drillRow,    setDrillRow]    = useState(null); // row for drill-down

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data: res } = await api.get(`/api/commissions?year=${year}&month=${month}`);
      setData(res);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load commission data');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const goBack = () => { if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1); };
  const goFwd  = () => { if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1); };

  const exportCSV = () => {
    if (!data?.rows) return;
    downloadCSV(data.rows, [
      { header: 'Associate',        key: 'name' },
      { header: 'Code',             key: 'employee_code' },
      { header: 'Region',           key: 'region' },
      { header: 'Commission Type',  key: 'commission_type' },
      { header: 'Flat Rate %',      key: 'flat_rate' },
      { header: 'Accepted Revenue', key: 'accepted_revenue' },
      { header: 'Commission Earned',key: 'commission_earned' },
      { header: 'Accepted Quotes',  key: 'accepted_quotes' },
      { header: 'Total Quotes',     key: 'total_quotes' },
    ], `Commission_${monthLabel(year, month).replace(' ', '_')}.csv`);
    toast('CSV exported', { kind: 'success' });
  };

  /* ── Render ── */
  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 60, color: '#6B7280',
      fontFamily: "'Source Sans 3', sans-serif", fontSize: 14,
    }}>Loading commission ledger…</div>
  );

  if (err) return (
    <div style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 15, color: '#991B1B' }}>{err}</div>
      <button onClick={load} style={{ background: '#0891B2', color: '#fff', border: 0, borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13 }}>Retry</button>
    </div>
  );

  const rows             = data?.rows || [];
  const totalCommission  = data?.totalCommission || 0;
  const totalRevenue     = data?.totalRevenue    || 0;
  const noStructureCount = rows.filter((r) => !r.has_structure).length;
  const topEarner        = rows.reduce((best, r) => (!best || r.commission_earned > best.commission_earned) ? r : best, null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 20, color: '#164E63' }}>
            💰 Associate Commission Ledger
          </h2>
          <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: '#6B7280', marginTop: 3 }}>
            Commission earned from accepted quotes · {monthLabel(year, month)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
            <button onClick={goBack} style={{ border: 0, background: 'transparent', padding: '4px 10px', cursor: 'pointer', fontSize: 15, color: '#374151', fontWeight: 700, borderRadius: 6 }}>‹</button>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#374151', padding: '0 4px', whiteSpace: 'nowrap' }}>{monthLabel(year, month)}</span>
            <button onClick={goFwd} style={{ border: 0, background: 'transparent', padding: '4px 10px', cursor: 'pointer', fontSize: 15, color: '#374151', fontWeight: 700, borderRadius: 6 }}>›</button>
          </div>
          <button onClick={exportCSV} style={{ background: '#059669', color: '#fff', border: 0, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12 }}>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Warning: associates without structure ── */}
      {noStructureCount > 0 && (
        <div style={{ background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12.5, color: '#92400E', fontWeight: 600 }}>
            {noStructureCount} associate{noStructureCount !== 1 ? 's' : ''} have no commission structure set. Click "Configure" to set their rate.
          </span>
        </div>
      )}

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { icon: '💰', label: 'Total Commissions Due',  value: fmtINR(totalCommission), sub: monthLabel(year, month),              accent: '#059669' },
          { icon: '📈', label: 'Accepted Revenue',       value: fmtL(totalRevenue),       sub: 'basis for commission',               accent: '#0891B2' },
          { icon: '🏆', label: 'Top Earner',             value: topEarner?.name?.split(' ')[0] || '—', sub: topEarner ? fmtINR(topEarner.commission_earned) : '—', accent: '#F59E0B' },
          { icon: '👥', label: 'Active Associates',      value: rows.length,              sub: `${rows.filter(r => r.has_structure).length} with commission set`, accent: '#6B7280' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,.04)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 9, background: k.accent + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{k.icon}</div>
            <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, fontSize: 10.5, color: '#6B7280', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 24, color: k.accent, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11.5, color: '#9CA3AF', marginTop: 6 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main ledger table ── */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Associate', 'Commission Structure', 'Total Quoted', 'Accepted Revenue', 'Commission Earned', 'Quotes', ''].map((h, i) => (
                  <th key={i} style={{
                    fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 10,
                    color: '#0E7490', letterSpacing: '.07em', textTransform: 'uppercase',
                    padding: '10px 14px', textAlign: i >= 2 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left',
                    borderBottom: '2px solid #E5E7EB', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const col = avatarColor(r.name);
                const isTop = topEarner && r.employee_id === topEarner.employee_id && r.commission_earned > 0;
                return (
                  <tr key={r.employee_id} style={{
                    borderBottom: '1px solid #F1F5F9',
                    borderLeft: isTop ? '3px solid #F59E0B' : '3px solid transparent',
                    background: isTop ? '#FFFBEB' : '#fff',
                    cursor: 'pointer',
                  }}
                    onClick={() => r.accepted_revenue > 0 && setDrillRow(r)}
                  >
                    {/* Associate */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: col.bg, color: col.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12 }}>{initials(r.name)}</div>
                        <div>
                          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: '#164E63', display: 'flex', alignItems: 'center', gap: 5 }}>
                            {r.name}
                            {isTop && <span title="Top earner this month">🏆</span>}
                          </div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9CA3AF' }}>{r.employee_code}{r.region ? ` · ${r.region}` : ''}</div>
                        </div>
                      </div>
                    </td>

                    {/* Commission structure */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <CommissionTypeBadge row={r} />
                        {r.commission_type === 'slab' && r.slabs.length > 0 && (
                          <SlabPreview slabs={r.slabs} />
                        )}
                      </div>
                    </td>

                    {/* Total quoted */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#6B7280' }}>
                      {fmtINR(r.total_quoted)}
                      <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 10, color: '#CBD5E1', marginTop: 1 }}>{r.total_quotes} quotes</div>
                    </td>

                    {/* Accepted revenue */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: '#0E7490' }}>
                      {fmtINR(r.accepted_revenue)}
                      <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 10, color: '#CBD5E1', marginTop: 1 }}>{r.accepted_quotes} accepted</div>
                    </td>

                    {/* Commission earned */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {!r.has_structure ? (
                        <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: '#CBD5E1' }}>—</span>
                      ) : (
                        <div>
                          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 16, color: r.commission_earned > 0 ? '#059669' : '#9CA3AF' }}>
                            {fmtINR(r.commission_earned)}
                          </div>
                          {r.accepted_revenue > 0 && r.commission_type === 'flat' && (
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{r.flat_rate}% of {fmtL(r.accepted_revenue)}</div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Quote count */}
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#374151' }}>
                      <div style={{ fontWeight: 700 }}>{r.accepted_quotes}</div>
                      <div style={{ fontSize: 10, color: '#CBD5E1' }}>accepted</div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setConfigRow(r)}
                        style={{
                          background: r.has_structure ? '#F1F5F9' : '#0891B2',
                          color: r.has_structure ? '#374151' : '#fff',
                          border: 0, borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
                          fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 11.5,
                        }}>
                        {r.has_structure ? '✏ Edit' : '+ Set Rate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals footer */}
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E5E7EB' }}>
                  <td colSpan={2} style={{ padding: '12px 14px', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, color: '#164E63' }}>
                    Team Total
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
                    {fmtINR(rows.reduce((s, r) => s + r.total_quoted, 0))}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#0E7490', fontWeight: 700 }}>
                    {fmtINR(totalRevenue)}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 18, color: '#059669' }}>
                    {fmtINR(totalCommission)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Modals ── */}
      {configRow && (
        <SetCommissionModal
          row={configRow}
          onClose={() => setConfigRow(null)}
          onSaved={load}
        />
      )}
      {drillRow && (
        <DrillDownModal
          row={drillRow}
          year={year} month={month}
          onClose={() => setDrillRow(null)}
        />
      )}
    </div>
  );
}
