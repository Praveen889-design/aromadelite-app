import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

/* ── Constants ──────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'personnel',  label: 'Personnel',  icon: '🧑‍💼', color: '#7c3aed' },
  { id: 'logistics',  label: 'Logistics',  icon: '🚚', color: '#0ea5e9' },
  { id: 'inventory',  label: 'Inventory',  icon: '📦', color: '#f59e0b' },
  { id: 'marketing',  label: 'Marketing',  icon: '📣', color: '#ec4899' },
  { id: 'technology', label: 'Technology', icon: '💻', color: '#10b981' },
];

const SUBCATEGORIES = {
  personnel:  ['Salary', 'Commission', 'Bonus / Incentive', 'PF Contribution', 'ESI', 'Travel Allowance (TA/DA)', 'Mobile Reimbursement', 'Other'],
  logistics:  ['Transportation / Courier', 'Fuel', 'Vehicle Hire / Maintenance', 'Last-Mile Delivery', 'Loading / Unloading', 'Other'],
  inventory:  ['Product Purchase Cost', 'Warehouse / Godown Rent', 'Packaging Materials', 'Stock Damage / Wastage', 'Quality Testing', 'Other'],
  marketing:  ['Promotional Materials', 'Product Samples', 'Digital Ads', 'Exhibition / Trade Fair', 'Client Entertainment', 'Other'],
  technology: ['App Hosting (Vercel)', 'Domain Renewal', 'Software Subscriptions', 'API Costs', 'Other'],
};

const PARTNER_COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981'];

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const currentMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel   = (m) => { try { return new Date(m + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' }); } catch { return m; } };

/* ── Partner Card ───────────────────────────────────────────── */
function PartnerCard({ partner, onEdit, onDelete, profitShare, totalShares }) {
  const pct = totalShares > 0 ? ((partner.share_percent / totalShares) * 100).toFixed(1) : partner.share_percent;
  return (
    <div style={{ background: '#fff', border: `2px solid ${partner.color}22`, borderRadius: 14,
                  padding: '18px 20px', position: 'relative', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: partner.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
          {partner.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>{partner.name}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Partner</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onEdit(partner)}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, padding: '5px 9px',
                     cursor: 'pointer', fontSize: 13 }}>✏️</button>
          <button onClick={() => onDelete(partner.id)}
            style={{ background: '#fef2f2', border: 'none', borderRadius: 7, padding: '5px 9px',
                     cursor: 'pointer', fontSize: 13 }}>🗑️</button>
        </div>
      </div>
      {/* Share bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#64748b', fontWeight: 600 }}>Share %</span>
          <span style={{ fontWeight: 800, color: partner.color }}>{partner.share_percent}%</span>
        </div>
        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`,
                        background: partner.color, borderRadius: 99, transition: 'width 0.4s' }} />
        </div>
      </div>
      <div style={{ background: `${partner.color}11`, borderRadius: 9, padding: '8px 12px',
                    textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>This Month Profit Share</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: profitShare >= 0 ? '#16a34a' : '#dc2626' }}>
          {profitShare >= 0 ? '+' : ''}{fmt(profitShare)}
        </div>
      </div>
    </div>
  );
}

/* ── Partner Modal ──────────────────────────────────────────── */
function PartnerModal({ partner, onClose, onSave, existingCount }) {
  const [form, setForm] = useState({
    name: partner?.name || '',
    share_percent: partner?.share_percent || '',
    color: partner?.color || PARTNER_COLORS[existingCount % PARTNER_COLORS.length],
    notes: partner?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!form.name.trim()) return setErr('Name is required');
    if (!form.share_percent || isNaN(form.share_percent) || +form.share_percent <= 0 || +form.share_percent > 100)
      return setErr('Share % must be between 1 and 100');
    setSaving(true); setErr('');
    try {
      if (partner?.id) {
        const { data } = await api.put(`/api/partners/${partner.id}`, form);
        onSave(data);
      } else {
        const { data } = await api.post('/api/partners', form);
        onSave(data);
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>
          {partner?.id ? '✏️ Edit Partner' : '➕ Add Partner'}
        </div>

        {err && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
                               padding: '8px 12px', fontSize: 13, color: '#dc2626', marginBottom: 12 }}>{err}</div>}

        {[['name','Partner Name','text'], ['share_percent','Share % (e.g. 33.33)','number']].map(([key, label, type]) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>{label}</label>
            <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                       fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}

        {/* Color picker */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Color</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {PARTNER_COLORS.map(c => (
              <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                style={{ width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                         border: form.color === c ? '3px solid #0f172a' : '3px solid transparent',
                         transition: 'border 0.15s' }} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                              fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                                             background: '#f8fafc', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none',
                     background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff',
                     cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save Partner'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Cost Entry Modal ───────────────────────────────────────── */
function CostModal({ entry, onClose, onSave, defaultCategory, defaultType }) {
  const [form, setForm] = useState({
    category:         entry?.category         || defaultCategory || 'personnel',
    subcategory:      entry?.subcategory      || '',
    description:      entry?.description      || '',
    amount:           entry?.amount           || '',
    entry_type:       entry?.entry_type       || defaultType || 'monthly',
    cost_month:       entry?.cost_month       || currentMonth(),
    transaction_date: entry?.transaction_date ? entry.transaction_date.slice(0,10) : new Date().toISOString().slice(0,10),
    notes:            entry?.notes            || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!form.description.trim()) return setErr('Description is required');
    if (!form.amount || isNaN(form.amount) || +form.amount < 0) return setErr('Valid amount required');
    setSaving(true); setErr('');
    try {
      if (entry?.id) {
        const { data } = await api.put(`/api/business-costs/${entry.id}`, form);
        onSave(data, 'update');
      } else {
        const { data } = await api.post('/api/business-costs', form);
        onSave(data, 'create');
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const cat = CATEGORIES.find(c => c.id === form.category) || CATEGORIES[0];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, margin: 'auto' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>
          {entry?.id ? '✏️ Edit Cost Entry' : '➕ Add Cost Entry'}
        </div>

        {err && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
                               padding: '8px 12px', fontSize: 13, color: '#dc2626', marginBottom: 12 }}>{err}</div>}

        {/* Entry Type Toggle */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Entry Type</label>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3, gap: 3 }}>
            {[['monthly','📅 Monthly'],['transaction','🧾 Per Transaction']].map(([val, lbl]) => (
              <button key={val} onClick={() => setForm(f => ({ ...f, entry_type: val }))}
                style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700,
                         cursor: 'pointer', transition: 'all 0.15s',
                         background: form.entry_type === val ? '#fff' : 'transparent',
                         color: form.entry_type === val ? '#7c3aed' : '#64748b',
                         boxShadow: form.entry_type === val ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Category</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setForm(f => ({ ...f, category: c.id, subcategory: '' }))}
                style={{ padding: '6px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700,
                         cursor: 'pointer', background: form.category === c.id ? c.color : '#f1f5f9',
                         color: form.category === c.id ? '#fff' : '#475569' }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Subcategory */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Sub-category</label>
          <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13,
                     outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
            <option value="">-- Select sub-category --</option>
            {(SUBCATEGORIES[form.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="e.g. March salary - Ravi Kumar"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                     fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Amount (₹)</label>
          <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="0.00" min="0"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                     fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Date/Month */}
        {form.entry_type === 'monthly' ? (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Month</label>
            <input type="month" value={form.cost_month} onChange={e => setForm(f => ({ ...f, cost_month: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                       fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Transaction Date</label>
            <input type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                       fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                              fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                                             background: '#f8fafc', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none',
                     background: `linear-gradient(135deg,${cat.color},${cat.color}cc)`, color: '#fff',
                     cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Tab ───────────────────────────────────────────────── */
export default function PartnersCostsTab() {
  const [section, setSection] = useState('partners'); // partners | costs | summary
  const [partners, setPartners]   = useState([]);
  const [costs, setCosts]         = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);

  // Filters
  const [selMonth,    setSelMonth]    = useState(currentMonth());
  const [selCategory, setSelCategory] = useState('all');
  const [entryType,   setEntryType]   = useState('all'); // all | monthly | transaction

  // Modals
  const [partnerModal, setPartnerModal] = useState(null); // null | 'new' | partner obj
  const [costModal,    setCostModal]    = useState(null); // null | 'new' | cost obj

  /* Fetch all data */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selCategory !== 'all') params.append('category', selCategory);
      if (entryType   !== 'all') params.append('entry_type', entryType);
      params.append('month', selMonth);

      const [pRes, cRes, sRes] = await Promise.all([
        api.get('/api/partners'),
        api.get(`/api/business-costs?${params}`),
        api.get(`/api/business-costs/summary?month=${selMonth}`),
      ]);
      setPartners(pRes.data);
      setCosts(cRes.data);
      setSummary(sRes.data);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }, [selMonth, selCategory, entryType]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const deletePartner = async (id) => {
    if (!window.confirm('Remove this partner?')) return;
    await api.delete(`/api/partners/${id}`);
    fetchAll();
  };

  const deleteCost = async (id) => {
    if (!window.confirm('Delete this cost entry?')) return;
    await api.delete(`/api/business-costs/${id}`);
    fetchAll();
  };

  const totalSharePct = partners.reduce((s, p) => s + parseFloat(p.share_percent), 0);
  const shareWarning  = Math.abs(totalSharePct - 100) > 0.01 && partners.length > 0;

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['partners','👥 Partners'],['costs','💸 Cost Entries'],['summary','📊 P&L Summary']].map(([id, lbl]) => (
          <button key={id} onClick={() => setSection(id)}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                     cursor: 'pointer', transition: 'all 0.15s',
                     background: section === id ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : '#f1f5f9',
                     color: section === id ? '#fff' : '#475569',
                     boxShadow: section === id ? '0 2px 8px rgba(124,58,237,0.3)' : 'none' }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>Loading…</div>}

      {/* ── PARTNERS SECTION ─────────────────────────────── */}
      {!loading && section === 'partners' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>👥 Partners</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Up to 4 partners · Profit sharing based on % ratio</div>
            </div>
            {partners.length < 4 && (
              <button onClick={() => setPartnerModal('new')}
                style={{ padding: '9px 18px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                         background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', cursor: 'pointer' }}>
                ➕ Add Partner
              </button>
            )}
          </div>

          {/* Share % warning */}
          {shareWarning && (
            <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10,
                          padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 14, fontWeight: 600 }}>
              ⚠️ Total share = {totalSharePct.toFixed(2)}% — should equal 100% for correct profit split.
            </div>
          )}

          {partners.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>No partners yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Add up to 4 partners with their profit share %</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
              {partners.map(p => (
                <PartnerCard key={p.id} partner={p}
                  onEdit={(pt) => setPartnerModal(pt)}
                  onDelete={deletePartner}
                  profitShare={summary?.partner_split?.find(s => s.id === p.id)?.profit_share || 0}
                  totalShares={totalSharePct} />
              ))}
              {/* Empty slots */}
              {Array.from({ length: 4 - partners.length }).map((_, i) => (
                <div key={i} onClick={() => setPartnerModal('new')}
                  style={{ border: '2px dashed #e2e8f0', borderRadius: 14, padding: '18px 20px',
                           display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                           minHeight: 140, cursor: 'pointer', color: '#94a3b8', gap: 8,
                           transition: 'border-color 0.15s' }}>
                  <div style={{ fontSize: 28 }}>＋</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Add Partner</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── COSTS SECTION ────────────────────────────────── */}
      {!loading && section === 'costs' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>💸 Cost Entries</div>
            <button onClick={() => setCostModal('new')}
              style={{ padding: '9px 18px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                       background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', cursor: 'pointer' }}>
              ➕ Add Cost
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none' }} />

            {/* Entry type toggle */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 9, padding: 3, gap: 2 }}>
              {[['all','All'],['monthly','📅 Monthly'],['transaction','🧾 Transactions']].map(([v,l]) => (
                <button key={v} onClick={() => setEntryType(v)}
                  style={{ padding: '6px 12px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 700,
                           cursor: 'pointer', background: entryType === v ? '#fff' : 'transparent',
                           color: entryType === v ? '#7c3aed' : '#64748b',
                           boxShadow: entryType === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <select value={selCategory} onChange={e => setSelCategory(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13,
                       outline: 'none', background: '#fff' }}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>

          {/* Cost entries list */}
          {costs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💸</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>No cost entries for {monthLabel(selMonth)}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Click "Add Cost" to record expenses</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {costs.map(c => {
                const cat = CATEGORIES.find(x => x.id === c.category) || CATEGORIES[0];
                return (
                  <div key={c.id} style={{ background: '#fff', border: '1.5px solid #f1f5f9',
                                           borderRadius: 12, padding: '12px 16px',
                                           display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cat.color}18`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 16, flexShrink: 0 }}>{cat.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.description}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ background: `${cat.color}18`, color: cat.color, padding: '1px 7px',
                                       borderRadius: 99, fontWeight: 700 }}>{cat.icon} {cat.label}</span>
                        {c.subcategory && <span>{c.subcategory}</span>}
                        <span style={{ background: c.entry_type === 'monthly' ? '#f0fdf4' : '#eff6ff',
                                       color: c.entry_type === 'monthly' ? '#16a34a' : '#2563eb',
                                       padding: '1px 7px', borderRadius: 99, fontWeight: 700 }}>
                          {c.entry_type === 'monthly' ? `📅 ${monthLabel(c.cost_month)}` : `🧾 ${c.transaction_date?.slice(0,10)}`}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#dc2626', flexShrink: 0 }}>
                      −{fmt(c.amount)}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => setCostModal(c)}
                        style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                      <button onClick={() => deleteCost(c.id)}
                        style={{ background: '#fef2f2', border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                    </div>
                  </div>
                );
              })}
              {/* Total row */}
              <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12,
                            padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', fontWeight: 800 }}>
                <span style={{ color: '#475569' }}>Total ({costs.length} entries)</span>
                <span style={{ color: '#dc2626', fontSize: 16 }}>
                  −{fmt(costs.reduce((s, c) => s + parseFloat(c.amount), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY SECTION ──────────────────────────────── */}
      {!loading && section === 'summary' && summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Month selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              📊 P&L Summary — {monthLabel(selMonth)}
            </div>
            <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none' }} />
          </div>

          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {[
              { label: 'Total Revenue',    value: fmt(summary.revenue),     bg: '#f0fdf4', color: '#16a34a', icon: '📈' },
              { label: 'Cash Collected',   value: fmt(summary.collected),   bg: '#eff6ff', color: '#2563eb', icon: '💵' },
              { label: 'Operating Costs',  value: fmt(summary.total_costs), bg: '#fff1f2', color: '#dc2626', icon: '💸' },
              { label: 'Net Profit',       value: fmt(summary.net_profit),
                subtitle: 'Revenue − Costs',
                bg: summary.net_profit >= 0 ? '#f0fdf4' : '#fff1f2',
                color: summary.net_profit >= 0 ? '#16a34a' : '#dc2626', icon: summary.net_profit >= 0 ? '✅' : '⚠️' },
            ].map(k => (
              <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{k.icon}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 3 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                {k.subtitle && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{k.subtitle}</div>}
              </div>
            ))}
          </div>

          {/* Cost breakdown by category */}
          <div style={{ background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>💸 Cost Breakdown</div>
            {CATEGORIES.map(cat => {
              const amt = summary.cost_by_category?.[cat.id] || 0;
              const pct = summary.total_costs > 0 ? (amt / summary.total_costs) * 100 : 0;
              return (
                <div key={cat.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{cat.icon} {cat.label}</span>
                    <span style={{ fontWeight: 700, color: '#475569' }}>{fmt(amt)} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: cat.color,
                                  borderRadius: 99, transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Partner profit split */}
          {summary.partner_split?.length > 0 && (
            <div style={{ background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>
                👥 Partner Profit Split
                {shareWarning && <span style={{ fontSize: 11, color: '#f59e0b', marginLeft: 8 }}>⚠️ Shares ≠ 100%</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
                {summary.partner_split.map(p => (
                  <div key={p.id} style={{ background: `${p.color}11`, border: `1.5px solid ${p.color}33`,
                                           borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.color,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 auto 8px' }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{p.share_percent}% share</div>
                    <div style={{ fontSize: 17, fontWeight: 800,
                                  color: p.profit_share >= 0 ? '#16a34a' : '#dc2626' }}>
                      {p.profit_share >= 0 ? '+' : ''}{fmt(p.profit_share)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────── */}
      {partnerModal !== null && (
        <PartnerModal
          partner={partnerModal === 'new' ? null : partnerModal}
          existingCount={partners.length}
          onClose={() => setPartnerModal(null)}
          onSave={() => { setPartnerModal(null); fetchAll(); }} />
      )}
      {costModal !== null && (
        <CostModal
          entry={costModal === 'new' ? null : costModal}
          defaultCategory={selCategory !== 'all' ? selCategory : 'personnel'}
          defaultType={entryType !== 'all' ? entryType : 'monthly'}
          onClose={() => setCostModal(null)}
          onSave={() => { setCostModal(null); fetchAll(); }} />
      )}
    </div>
  );
}
