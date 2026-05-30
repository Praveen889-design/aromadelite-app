import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

/* ─── constants ─────────────────────────────────────────────── */
const REGIONS = ['Hyderabad', 'Nizamabad', 'Warangal', 'Karimnagar', 'Vijayawada', 'Guntur', 'Medak'];

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const formatQty = (n) => {
  const v = Number(n) || 0;
  return v % 1 === 0 ? v.toLocaleString('en-IN') : v.toFixed(2);
};

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const REGION_COLORS = {
  Hyderabad:  { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  Nizamabad:  { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
  Warangal:   { bg: '#fdf4ff', border: '#a855f7', text: '#7e22ce' },
  Karimnagar: { bg: '#fff7ed', border: '#f97316', text: '#c2410c' },
  Vijayawada: { bg: '#fefce8', border: '#eab308', text: '#854d0e' },
  Guntur:     { bg: '#fff1f2', border: '#f43f5e', text: '#be123c' },
  Medak:      { bg: '#f0fdfa', border: '#14b8a6', text: '#0f766e' },
};

/* ─── small shared components ───────────────────────────────── */
const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
    <div style={{ width: 28, height: 28, border: '3px solid #e2e8f0',
      borderTop: '3px solid #0891b2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  </div>
);

const Pill = ({ label, color }) => (
  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99,
    background: color.bg, border: `1px solid ${color.border}`,
    color: color.text, fontSize: 11, fontWeight: 600 }}>
    {label}
  </span>
);

const KpiChip = ({ label, value, sub, color = '#0891b2' }) => (
  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '10px 14px', minWidth: 110 }}>
    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{sub}</div>}
  </div>
);

/* ════════════════════════════════════════════════════════════════
   ADD / EDIT UNIT MODAL
════════════════════════════════════════════════════════════════ */
function UnitModal({ open, unit, onClose, onSaved }) {
  const { toast } = useToast();
  const [v, setV] = useState({ name: '', region: REGIONS[0], address: '', contact_person: '', contact_phone: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setV(unit
        ? { name: unit.name, region: unit.region, address: unit.address || '',
            contact_person: unit.contact_person || '', contact_phone: unit.contact_phone || '' }
        : { name: '', region: REGIONS[0], address: '', contact_person: '', contact_phone: '' });
    }
  }, [open, unit]);

  if (!open) return null;

  const upd = (p) => setV((s) => ({ ...s, ...p }));
  const inp = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', fontSize: 13 };

  const save = async () => {
    if (!v.name.trim()) { toast('Unit name is required', { kind: 'error' }); return; }
    setBusy(true);
    try {
      if (unit) {
        await api.patch(`/api/units/${unit.id}`, v);
        toast('Unit updated.', { kind: 'success' });
      } else {
        await api.post('/api/units', v);
        toast('Unit created.', { kind: 'success' });
      }
      onSaved();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.error || 'Save failed', { kind: 'error' });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: 16 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{unit ? 'Edit Unit' : 'Add New Unit'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Unit Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input style={inp} placeholder="e.g. Hyderabad Central Depot"
              value={v.name} onChange={(e) => upd({ name: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Region <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select style={inp} value={v.region} onChange={(e) => upd({ region: e.target.value })}>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Contact Person</label>
            <input style={inp} placeholder="Name" value={v.contact_person} onChange={(e) => upd({ contact_person: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Contact Phone</label>
            <input style={inp} placeholder="+91-9XXXXXXXXX" value={v.contact_phone} onChange={(e) => upd({ contact_phone: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Address</label>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }}
              placeholder="Full address" value={v.address} onChange={(e) => upd({ address: e.target.value })} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1',
              background: '#fff', cursor: 'pointer', color: '#475569' }}>Cancel</button>
          <button onClick={save} disabled={busy}
            style={{ padding: '8px 20px', fontSize: 13, borderRadius: 8, border: 'none',
              background: busy ? '#94a3b8' : '#0891b2', color: '#fff', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'Saving…' : (unit ? 'Save changes' : 'Create unit')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DEPLOY STOCK MODAL  (with CSV bulk import)
════════════════════════════════════════════════════════════════ */
const EMPTY_ITEM = () => ({ product_name: '', quantity: '', unit_price: '', gst_percent: '18' });

/** Parse a simple CSV string → array of objects keyed by header row */
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ['CSV has no data rows.'] };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows    = [];
  const errors  = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const obj  = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
    // Must have a product name and a quantity > 0
    const name = (obj['product_name'] || '').trim();
    const qty  = parseFloat(obj['quantity'] || '');
    if (!name)     { errors.push(`Row ${i}: product_name is empty — skipped`); continue; }
    if (!(qty > 0)){ errors.push(`Row ${i} (${name}): quantity must be > 0 — skipped`); continue; }
    rows.push({
      product_name: name,
      quantity:     String(qty),
      unit_price:   obj['unit_price'] ? String(parseFloat(obj['unit_price'])) : '',
      gst_percent:  obj['gst_percent'] ? String(parseFloat(obj['gst_percent'])) : '18',
    });
  }
  return { rows, errors };
}

function DeployModal({ open, unit, onClose, onDeployed }) {
  const { toast }  = useToast();
  const fileRef    = React.useRef(null);

  const [note, setNote]           = useState('');
  const [rows, setRows]           = useState([EMPTY_ITEM()]);
  const [products, setProducts]   = useState([]);
  const [busy, setBusy]           = useState(false);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvMode, setCsvMode]     = useState(false); // true = uploaded via CSV

  useEffect(() => {
    if (open) {
      setNote('');
      setRows([EMPTY_ITEM()]);
      setCsvErrors([]);
      setCsvMode(false);
      api.get('/api/products?limit=500').then((r) => setProducts(r.data.products || [])).catch(() => {});
    }
  }, [open]);

  if (!open || !unit) return null;

  const updRow = (i, p) => setRows((s) => s.map((r, idx) => idx === i ? { ...r, ...p } : r));
  const addRow = () => setRows((s) => [...s, EMPTY_ITEM()]);
  const delRow = (i) => setRows((s) => s.filter((_, idx) => idx !== i));

  const rowTotal = (r) => {
    const qty = Number(r.quantity)    || 0;
    const pr  = Number(r.unit_price)  || 0;
    const g   = Number(r.gst_percent) || 0;
    return qty * pr * (1 + g / 100);
  };
  const grandTotal = rows.reduce((s, r) => s + rowTotal(r), 0);

  const inp = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 12,
    width: '100%', boxSizing: 'border-box' };

  /* ── Download CSV template pre-filled with catalog ── */
  const downloadTemplate = () => {
    const header = 'product_name,quantity,unit_price,gst_percent';
    const dataRows = products.length
      ? products.map((p) =>
          `"${p.name.replace(/"/g, '""')}","",${p.base_price || ''},${p.gst_percent ?? 18}`
        )
      : [`"Sample Product Name","10","100","18"`];
    const csv = [header, ...dataRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `stock_template_${unit.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Handle CSV file upload ── */
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast('Please upload a .csv file', { kind: 'error' }); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows: parsed, errors } = parseCSV(ev.target.result);
      setCsvErrors(errors);
      if (parsed.length === 0) {
        toast(errors[0] || 'No valid rows found in CSV.', { kind: 'error' });
      } else {
        // Auto-fill unit_price from catalog if blank
        const enriched = parsed.map((r) => {
          if (!r.unit_price) {
            const match = products.find(
              (p) => p.name.toLowerCase() === r.product_name.toLowerCase()
            );
            if (match) return { ...r, unit_price: String(match.base_price || '') };
          }
          return r;
        });
        setRows(enriched);
        setCsvMode(true);
        toast(`${parsed.length} product${parsed.length > 1 ? 's' : ''} loaded from CSV${errors.length ? ` (${errors.length} row${errors.length > 1 ? 's' : ''} skipped)` : ''}.`,
          { kind: errors.length ? 'warning' : 'success' });
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-uploaded
    e.target.value = '';
  };

  /* ── Submit ── */
  const save = async () => {
    const items = rows.filter((r) => r.product_name.trim() && Number(r.quantity) > 0 && Number(r.unit_price) > 0);
    if (!items.length) { toast('Add at least one valid item (name + qty + price)', { kind: 'error' }); return; }
    setBusy(true);
    try {
      const payload = items.map((r) => {
        const prod = products.find((p) => p.name.toLowerCase() === r.product_name.toLowerCase());
        return {
          product_id:   prod?.id || null,
          product_name: r.product_name,
          quantity:     Number(r.quantity),
          unit_price:   Number(r.unit_price),
          gst_percent:  Number(r.gst_percent) || 18,
        };
      });
      await api.post(`/api/units/${unit.id}/deploy`, { note, items: payload });
      toast(`${items.length} product${items.length > 1 ? 's' : ''} deployed to ${unit.name}.`, { kind: 'success' });
      onDeployed();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.error || 'Deploy failed', { kind: 'error' });
    } finally { setBusy(false); }
  };

  const validCount = rows.filter((r) => r.product_name.trim() && Number(r.quantity) > 0 && Number(r.unit_price) > 0).length;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', background: 'rgba(15,23,42,0.5)', padding: '24px 16px', overflowY: 'auto' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 900,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', marginBottom: 24 }}>

        {/* ── Header ── */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>📦 Deploy Stock</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{unit.name} · {unit.region}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22,
            cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>

        {/* ── Note + CSV toolbar ── */}
        <div style={{ padding: '14px 20px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inp, padding: '8px 12px', fontSize: 13, flex: '1 1 240px' }}
            placeholder="Deployment note (optional, e.g. 'May batch – truck #3')"
            value={note} onChange={(e) => setNote(e.target.value)} />

          {/* CSV actions */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={downloadTemplate}
              title="Download a pre-filled template with all catalog products"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                fontSize: 12, fontWeight: 600, borderRadius: 8, border: '1px solid #bae6fd',
                background: '#f0f9ff', color: '#0369a1', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ⬇ Download Template
            </button>
            <button onClick={() => fileRef.current?.click()}
              title="Upload a filled CSV to bulk-add rows"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                fontSize: 12, fontWeight: 600, borderRadius: 8, border: '1px solid #bbf7d0',
                background: '#f0fdf4', color: '#15803d', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ⬆ Upload CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={handleFile} />
          </div>
        </div>

        {/* ── CSV parse error notices ── */}
        {csvErrors.length > 0 && (
          <div style={{ margin: '10px 20px 0', background: '#fffbeb', border: '1px solid #fcd34d',
            borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontWeight: 600, fontSize: 11, color: '#92400e', marginBottom: 4 }}>
              ⚠ {csvErrors.length} row{csvErrors.length > 1 ? 's' : ''} skipped during import:
            </div>
            {csvErrors.map((e, i) => (
              <div key={i} style={{ fontSize: 11, color: '#b45309' }}>• {e}</div>
            ))}
          </div>
        )}

        {/* ── CSV mode banner ── */}
        {csvMode && (
          <div style={{ margin: '10px 20px 0', background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 8, padding: '7px 12px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
              ✓ {rows.length} product{rows.length > 1 ? 's' : ''} loaded from CSV — review below, then deploy.
            </span>
            <button onClick={() => { setRows([EMPTY_ITEM()]); setCsvMode(false); setCsvErrors([]); }}
              style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline' }}>
              Clear & start over
            </button>
          </div>
        )}

        {/* ── Table ── */}
        <div style={{ padding: 20, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['#', 'Product Name', 'Qty', 'Unit Price (₹)', 'GST %', 'Total (incl. GST)', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600,
                    color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const missingPrice = r.product_name.trim() && Number(r.quantity) > 0 && !Number(r.unit_price);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9',
                    background: missingPrice ? '#fffbeb' : 'transparent' }}>
                    <td style={{ padding: '6px 10px', color: '#94a3b8', width: 28 }}>{i + 1}</td>
                    <td style={{ padding: '6px 6px', minWidth: 200 }}>
                      <input list={`prod-list-${i}`} style={inp} placeholder="Product name"
                        value={r.product_name}
                        onChange={(e) => {
                          const name = e.target.value;
                          const prod = products.find((p) => p.name === name);
                          updRow(i, {
                            product_name: name,
                            ...(prod && !r.unit_price ? { unit_price: String(prod.base_price || ''), gst_percent: String(prod.gst_percent ?? 18) } : {}),
                          });
                        }} />
                      <datalist id={`prod-list-${i}`}>
                        {products.map((p) => <option key={p.id} value={p.name} />)}
                      </datalist>
                    </td>
                    <td style={{ padding: '6px 6px', width: 80 }}>
                      <input style={{ ...inp, borderColor: (!r.quantity || Number(r.quantity) <= 0) && r.product_name ? '#fca5a5' : '#e2e8f0' }}
                        type="number" min="0" placeholder="0"
                        value={r.quantity} onChange={(e) => updRow(i, { quantity: e.target.value })} />
                    </td>
                    <td style={{ padding: '6px 6px', width: 120 }}>
                      <input style={{ ...inp, borderColor: missingPrice ? '#fbbf24' : '#e2e8f0' }}
                        type="number" min="0" placeholder="0.00"
                        value={r.unit_price} onChange={(e) => updRow(i, { unit_price: e.target.value })} />
                    </td>
                    <td style={{ padding: '6px 6px', width: 70 }}>
                      <select style={inp} value={r.gst_percent}
                        onChange={(e) => updRow(i, { gst_percent: e.target.value })}>
                        {[0, 3, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0f172a',
                      textAlign: 'right', whiteSpace: 'nowrap', width: 110 }}>
                      {rowTotal(r) > 0 ? formatINR(rowTotal(r)) : '—'}
                    </td>
                    <td style={{ padding: '6px 6px', width: 32 }}>
                      {rows.length > 1 && (
                        <button onClick={() => delRow(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer',
                            color: '#f43f5e', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button onClick={addRow}
            style={{ marginTop: 10, fontSize: 12, color: '#0891b2', background: 'none',
              border: '1px dashed #bae6fd', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
            + Add row
          </button>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 13 }}>
            <strong style={{ color: '#0891b2', fontSize: 16 }}>{formatINR(grandTotal)}</strong>
            <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 6 }}>grand total (incl. GST)</span>
            {validCount > 0 && (
              <span style={{ marginLeft: 10, fontSize: 11, color: '#64748b' }}>
                · {validCount} product{validCount > 1 ? 's' : ''} ready
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '8px 18px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1',
                background: '#fff', cursor: 'pointer', color: '#475569' }}>Cancel</button>
            <button onClick={save} disabled={busy || validCount === 0}
              style={{ padding: '8px 22px', fontSize: 13, borderRadius: 8, border: 'none',
                background: busy || validCount === 0 ? '#94a3b8' : '#16a34a', color: '#fff', fontWeight: 700,
                cursor: busy || validCount === 0 ? 'default' : 'pointer' }}>
              {busy ? 'Deploying…' : `✓ Deploy ${validCount > 0 ? validCount + ' Products' : 'Stock'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   UNIT DETAIL DRAWER
════════════════════════════════════════════════════════════════ */
function UnitDetail({ unit, onClose, onEdit, onDeploy, refresh }) {
  const [tab, setTab]         = useState('stock');
  const [data, setData]       = useState(null);
  const [deployments, setDeps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [sRes, dRes] = await Promise.all([
        api.get(`/api/units/${unit.id}/stock`),
        api.get(`/api/units/${unit.id}/deployments`),
      ]);
      setData(sRes.data);
      setDeps(dRes.data.deployments || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load');
    } finally { setLoading(false); }
  }, [unit.id]);

  useEffect(() => { load(); }, [load, refresh]);

  const rc = REGION_COLORS[unit.region] || REGION_COLORS.Hyderabad;

  const stockItems = useMemo(() => {
    if (!data?.stock) return [];
    const q = search.toLowerCase();
    return data.stock.filter((s) => !q || s.product_name.toLowerCase().includes(q));
  }, [data, search]);

  const stockValue = (data?.stock || []).reduce((s, r) =>
    s + (Number(r.quantity) * Number(r.unit_price) * (1 + Number(r.gst_percent) / 100)), 0);

  const adjSales = (data?.adjustments || []).filter((a) => a.reason === 'sale');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
      background: 'rgba(15,23,42,0.45)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {/* Drawer */}
      <div style={{ marginLeft: 'auto', width: '100%', maxWidth: 720, background: '#fff',
        height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{unit.name}</span>
                <Pill label={unit.region} color={rc} />
              </div>
              {unit.contact_person && (
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  👤 {unit.contact_person}
                  {unit.contact_phone && <span> · 📞 {unit.contact_phone}</span>}
                </div>
              )}
              {unit.address && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>📍 {unit.address}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
              <button onClick={onEdit}
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#fff', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>✏️ Edit</button>
              <button onClick={onDeploy}
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, border: 'none',
                  background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>📦 Deploy Stock</button>
              <button onClick={onClose}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
                  color: '#94a3b8', lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
          </div>

          {/* KPI chips */}
          {!loading && data && (
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <KpiChip label="Total SKUs"      value={data.stock.length}          color="#0891b2" />
              <KpiChip label="Total Qty"       value={formatQty(data.stock.reduce((s, r) => s + Number(r.quantity), 0))} color="#7c3aed" />
              <KpiChip label="Stock Value"     value={formatINR(stockValue)}       color="#16a34a" sub="incl. GST" />
              <KpiChip label="Sales Deductions" value={adjSales.length}           color="#f59e0b" sub="this month" />
            </div>
          )}

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {[['stock', '📋 Current Stock'], ['deployments', '🚛 Deployments'], ['sales', '💸 Sales Deductions']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontWeight: 600, background: tab === k ? '#0891b2' : '#f1f5f9',
                  color: tab === k ? '#fff' : '#64748b' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '16px 20px' }}>
          {loading && <Spinner />}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
              padding: 16, color: '#b91c1c', fontSize: 13 }}>
              {error}
              <button onClick={load} style={{ marginLeft: 12, color: '#0891b2', background: 'none',
                border: 'none', cursor: 'pointer', fontSize: 12 }}>Retry</button>
            </div>
          )}

          {/* ── STOCK TAB ── */}
          {!loading && !error && tab === 'stock' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <input placeholder="Search product…"
                  style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px',
                    fontSize: 12, width: '100%', boxSizing: 'border-box' }}
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {stockItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
                  {search ? 'No matching products' : 'No stock deployed yet. Click "Deploy Stock" to add inventory.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Product', 'Qty', 'Unit Price', 'GST %', 'Total Value', 'Last Updated'].map((h) => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600,
                            color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stockItems.map((s) => {
                        const totalVal = Number(s.quantity) * Number(s.unit_price) * (1 + Number(s.gst_percent) / 100);
                        const lowStock = Number(s.quantity) <= 5;
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc',
                            background: lowStock ? '#fff7ed' : 'transparent' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0f172a' }}>
                              {s.product_name}
                              {lowStock && <span style={{ marginLeft: 6, fontSize: 10, background: '#fed7aa',
                                color: '#c2410c', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>LOW</span>}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 700,
                              color: lowStock ? '#c2410c' : '#0f172a' }}>{formatQty(s.quantity)}</td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>{formatINR(s.unit_price)}</td>
                            <td style={{ padding: '8px 10px', color: '#64748b' }}>{s.gst_percent}%</td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#16a34a' }}>{formatINR(totalVal)}</td>
                            <td style={{ padding: '8px 10px', color: '#94a3b8', fontSize: 11 }}>{formatDate(s.last_updated)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0f172a' }}>Total</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                          {formatQty(stockItems.reduce((s, r) => s + Number(r.quantity), 0))}
                        </td>
                        <td colSpan={2} />
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#16a34a', fontSize: 13 }}>
                          {formatINR(stockItems.reduce((s, r) =>
                            s + Number(r.quantity) * Number(r.unit_price) * (1 + Number(r.gst_percent) / 100), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── DEPLOYMENTS TAB ── */}
          {!loading && !error && tab === 'deployments' && (
            deployments && deployments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
                No deployments recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(deployments || []).map((d) => (
                  <details key={d.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                    <summary style={{ padding: '10px 14px', cursor: 'pointer', background: '#f8fafc',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      listStyle: 'none', fontWeight: 600, fontSize: 13 }}>
                      <span>
                        🚛 {formatDate(d.deployed_at)}
                        {d.note && <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 8 }}>— {d.note}</span>}
                      </span>
                      <span style={{ color: '#16a34a', fontSize: 13 }}>{formatINR(d.total_amount)}</span>
                    </summary>
                    <div style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                        By: {d.deployed_by_name || '—'} · {d.items?.length || 0} products
                      </div>
                      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            {['Product', 'Qty', 'Price', 'GST%', 'Total'].map((h) => (
                              <th key={h} style={{ padding: '5px 8px', textAlign: 'left',
                                fontWeight: 600, color: '#475569' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(d.items || []).map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '5px 8px' }}>{it.product_name}</td>
                              <td style={{ padding: '5px 8px' }}>{formatQty(it.quantity)}</td>
                              <td style={{ padding: '5px 8px' }}>{formatINR(it.unit_price)}</td>
                              <td style={{ padding: '5px 8px' }}>{it.gst_percent}%</td>
                              <td style={{ padding: '5px 8px', fontWeight: 600, color: '#16a34a' }}>{formatINR(it.total_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            )
          )}

          {/* ── SALES DEDUCTIONS TAB ── */}
          {!loading && !error && tab === 'sales' && (
            adjSales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
                No sales deductions recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Date', 'Product', 'Qty Deducted', 'Quote #', 'Associate'].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600,
                          color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adjSales.map((a) => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '8px 10px', color: '#64748b', fontSize: 11 }}>{formatDate(a.adjusted_at)}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 500 }}>{a.product_name}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#f43f5e' }}>
                          −{formatQty(Math.abs(a.quantity_delta))}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#0891b2', fontSize: 11 }}>{a.quote_number || '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{a.adjusted_by_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN TAB
════════════════════════════════════════════════════════════════ */
export default function UnitsTab() {
  const { toast } = useToast();
  const [units, setUnits]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [regionFilter, setRegion]   = useState('All');

  // Modals
  const [unitModal, setUnitModal]   = useState({ open: false, unit: null });
  const [deployModal, setDeploy]    = useState({ open: false, unit: null });
  const [detailUnit, setDetail]     = useState(null);
  const [detailEdit, setDetailEdit] = useState(false);
  const [detailDeploy, setDetailDeploy] = useState(false);
  const [detailRefresh, setDetailRefresh] = useState(0);

  const loadUnits = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/api/units');
      setUnits(data.units || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load units');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  const deleteUnit = async (unit) => {
    if (!window.confirm(`Delete "${unit.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/units/${unit.id}`);
      toast('Unit removed.', { kind: 'success' });
      loadUnits();
    } catch (e) {
      toast(e?.response?.data?.error || 'Delete failed', { kind: 'error' });
    }
  };

  const filtered = useMemo(() =>
    regionFilter === 'All' ? units : units.filter((u) => u.region === regionFilter),
    [units, regionFilter]
  );

  // Region summary
  const regionSummary = useMemo(() => {
    const m = {};
    for (const u of units) {
      if (!m[u.region]) m[u.region] = { count: 0, value: 0, qty: 0 };
      m[u.region].count++;
      m[u.region].value += Number(u.stock_value) || 0;
      m[u.region].qty   += Number(u.total_quantity) || 0;
    }
    return m;
  }, [units]);

  return (
    <div style={{ padding: '20px 0' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>🏭 Units & Stock</h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            Manage regional depots and track deployed inventory
          </p>
        </div>
        <button onClick={() => setUnitModal({ open: true, unit: null })}
          style={{ padding: '9px 18px', fontSize: 13, borderRadius: 10, border: 'none',
            background: '#0891b2', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          + Add Unit
        </button>
      </div>

      {/* ── Region filter tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {['All', ...REGIONS].map((r) => {
          const active = regionFilter === r;
          const rc = REGION_COLORS[r];
          const has = r !== 'All' && regionSummary[r];
          return (
            <button key={r} onClick={() => setRegion(r)}
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
                fontWeight: 600, border: active ? `2px solid ${rc?.border || '#0891b2'}` : '1px solid #e2e8f0',
                background: active ? (rc?.bg || '#eff6ff') : '#fff',
                color: active ? (rc?.text || '#1d4ed8') : '#64748b' }}>
              {r}{has ? ` (${regionSummary[r].count})` : ''}
            </button>
          );
        })}
      </div>

      {/* ── State: loading / error ── */}
      {loading && <Spinner />}
      {!loading && error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12,
          padding: 20, color: '#b91c1c', fontSize: 13, textAlign: 'center' }}>
          {error}
          <button onClick={loadUnits} style={{ marginLeft: 10, color: '#0891b2',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No units found</div>
          <div style={{ fontSize: 12 }}>
            {regionFilter !== 'All' ? `No units in ${regionFilter} yet.` : 'Click "+ Add Unit" to create the first depot.'}
          </div>
        </div>
      )}

      {/* ── Unit cards ── */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map((u) => {
            const rc = REGION_COLORS[u.region] || REGION_COLORS.Hyderabad;
            return (
              <div key={u.id}
                style={{ border: `1px solid ${rc.border}`, borderRadius: 14, background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
                  cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onClick={() => setDetail(u)}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'}>
                {/* Card top accent */}
                <div style={{ height: 5, background: rc.border }} />
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 3,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                      <Pill label={u.region} color={rc} />
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, marginLeft: 8 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setDetail(u); setDetailEdit(true); }}
                        style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6,
                          border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#475569' }}>✏️</button>
                      <button onClick={() => { setDetail(u); setDetailDeploy(true); }}
                        style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6,
                          border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>📦</button>
                      <button onClick={() => deleteUnit(u)}
                        style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6,
                          border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', color: '#b91c1c' }}>🗑</button>
                    </div>
                  </div>

                  {u.contact_person && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>👤 {u.contact_person}
                      {u.contact_phone && <span> · {u.contact_phone}</span>}
                    </div>
                  )}

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                    {[
                      { label: 'SKUs', val: Number(u.sku_count) || 0, color: '#0891b2' },
                      { label: 'Total Qty', val: formatQty(u.total_quantity), color: '#7c3aed' },
                      { label: 'Stock Value', val: formatINR(u.stock_value), color: '#16a34a' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 8, textAlign: 'right' }}>
                    Last deployed: {formatDate(u.last_deployed)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals & drawers ── */}
      <UnitModal
        open={unitModal.open}
        unit={unitModal.unit}
        onClose={() => setUnitModal({ open: false, unit: null })}
        onSaved={loadUnits}
      />

      <DeployModal
        open={deployModal.open}
        unit={deployModal.unit}
        onClose={() => setDeploy({ open: false, unit: null })}
        onDeployed={() => { loadUnits(); setDetailRefresh((n) => n + 1); }}
      />

      {detailUnit && (
        <UnitDetail
          unit={detailUnit}
          refresh={detailRefresh}
          onClose={() => { setDetail(null); setDetailEdit(false); setDetailDeploy(false); }}
          onEdit={() => { setUnitModal({ open: true, unit: detailUnit }); }}
          onDeploy={() => setDeploy({ open: true, unit: detailUnit })}
        />
      )}

      {/* Trigger edit/deploy from card actions (open drawer then fire modal) */}
      {detailEdit && detailUnit && (
        <UnitModal
          open={true}
          unit={detailUnit}
          onClose={() => { setDetailEdit(false); setDetail(null); }}
          onSaved={() => { loadUnits(); setDetailEdit(false); }}
        />
      )}
      {detailDeploy && detailUnit && (
        <DeployModal
          open={true}
          unit={detailUnit}
          onClose={() => { setDetailDeploy(false); setDetail(null); }}
          onDeployed={() => { loadUnits(); setDetailDeploy(false); }}
        />
      )}
    </div>
  );
}
