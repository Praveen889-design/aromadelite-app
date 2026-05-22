import React, { useState } from 'react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

/* ─── Delete options ────────────────────────────────────────── */
const RESET_OPTIONS = [
  {
    target:  'quotes',
    label:   'All Quotes',
    icon:    '🧾',
    desc:    'Deletes every quote (draft, sent, accepted, rejected). Associated leads are reset to "new" status.',
    color:   '#f59e0b',
    bg:      '#fffbeb',
    border:  '#fcd34d',
  },
  {
    target:  'leads',
    label:   'All Leads',
    icon:    '📋',
    desc:    'Deletes every lead entry across all associates.',
    color:   '#f59e0b',
    bg:      '#fffbeb',
    border:  '#fcd34d',
  },
  {
    target:  'units',
    label:   'All Units & Stock',
    icon:    '🏭',
    desc:    'Removes all depot units, deployed stock, deployment history and adjustment logs.',
    color:   '#f97316',
    bg:      '#fff7ed',
    border:  '#fdba74',
  },
  {
    target:  'products',
    label:   'All Products',
    icon:    '📦',
    desc:    'Clears the entire product catalog.',
    color:   '#f97316',
    bg:      '#fff7ed',
    border:  '#fdba74',
  },
  {
    target:  'employees',
    label:   'All Associates',
    icon:    '👥',
    desc:    'Removes all associate accounts and their commission/target data. Admin accounts are never deleted.',
    color:   '#ef4444',
    bg:      '#fef2f2',
    border:  '#fca5a5',
  },
  {
    target:  'all',
    label:   'Everything (Full Reset)',
    icon:    '⚠️',
    desc:    'Deletes ALL quotes, leads, units, products and associate accounts in one go. Admin accounts are kept.',
    color:   '#dc2626',
    bg:      '#fef2f2',
    border:  '#f87171',
    danger:  true,
  },
];

/* ─── Single reset card ─────────────────────────────────────── */
function ResetCard({ opt, onDone }) {
  const { toast } = useToast();
  const [open,    setOpen]    = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy,    setBusy]    = useState(false);
  const [result,  setResult]  = useState(null);

  const PHRASE = 'DELETE';

  const close = () => { setOpen(false); setConfirm(''); setResult(null); };

  const execute = async () => {
    if (confirm !== PHRASE) return;
    setBusy(true);
    try {
      const { data } = await api.post('/api/settings/reset', { target: opt.target });
      setResult(data.deleted);
      toast(`${opt.label} deleted.`, { kind: 'success' });
      onDone?.();
    } catch (e) {
      toast(e?.response?.data?.error || 'Reset failed', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Card */}
      <div style={{ border: `1px solid ${opt.border}`, borderRadius: 12, background: opt.bg,
        padding: '16px 18px', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>{opt.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: opt.color }}>{opt.label}</span>
            {opt.danger && (
              <span style={{ fontSize: 10, fontWeight: 700, background: '#dc2626',
                color: '#fff', borderRadius: 4, padding: '1px 6px' }}>IRREVERSIBLE</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{opt.desc}</p>
        </div>
        <button onClick={() => setOpen(true)}
          style={{ flexShrink: 0, padding: '7px 16px', fontSize: 12, borderRadius: 8,
            border: `1px solid ${opt.color}`, background: '#fff', color: opt.color,
            cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
          Delete {opt.icon}
        </button>
      </div>

      {/* Confirmation modal */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,23,42,0.55)', padding: 16 }}
          onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ background: opt.danger ? '#dc2626' : opt.color,
              padding: '14px 20px', color: '#fff' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>⚠️ Confirm Deletion</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                This action cannot be undone.
              </div>
            </div>

            <div style={{ padding: 20 }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                You are about to permanently delete <strong>{opt.label}</strong>.
                <br />{opt.desc}
              </p>

              {result ? (
                /* Result summary */
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac',
                  borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 8, fontSize: 13 }}>
                    ✓ Deleted successfully
                  </div>
                  {Object.entries(result).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 12, color: '#374151' }}>
                      • {k}: <strong>{v} row{v !== 1 ? 's' : ''}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
                    color: '#374151', marginBottom: 6 }}>
                    Type <code style={{ background: '#fee2e2', color: '#dc2626',
                      padding: '1px 6px', borderRadius: 4 }}>DELETE</code> to confirm:
                  </label>
                  <input
                    autoFocus
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirm === PHRASE && execute()}
                    placeholder="Type DELETE"
                    style={{ width: '100%', boxSizing: 'border-box', border: '2px solid',
                      borderColor: confirm === PHRASE ? '#16a34a' : '#e2e8f0',
                      borderRadius: 8, padding: '9px 12px', fontSize: 14,
                      outline: 'none', marginBottom: 16,
                      background: confirm === PHRASE ? '#f0fdf4' : '#fff' }}
                  />
                </>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={close}
                  style={{ padding: '8px 18px', fontSize: 13, borderRadius: 8,
                    border: '1px solid #e2e8f0', background: '#fff',
                    cursor: 'pointer', color: '#475569' }}>
                  {result ? 'Close' : 'Cancel'}
                </button>
                {!result && (
                  <button onClick={execute}
                    disabled={confirm !== PHRASE || busy}
                    style={{ padding: '8px 20px', fontSize: 13, borderRadius: 8, border: 'none',
                      background: confirm === PHRASE ? '#dc2626' : '#cbd5e1',
                      color: '#fff', fontWeight: 700,
                      cursor: confirm === PHRASE && !busy ? 'pointer' : 'not-allowed' }}>
                    {busy ? 'Deleting…' : '🗑 Delete now'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN SETTINGS TAB
════════════════════════════════════════════════════════════════ */
export default function SettingsTab() {
  const [, setRefreshKey] = useState(0);

  return (
    <div style={{ padding: '20px 0', maxWidth: 680 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
          ⚙️ Settings
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Manage database records. Use the Danger Zone to clear test data before going live.
        </p>
      </div>

      {/* Danger Zone */}
      <div style={{ border: '2px solid #fca5a5', borderRadius: 14,
        background: '#fff', overflow: 'hidden' }}>
        <div style={{ background: '#fef2f2', padding: '12px 18px',
          borderBottom: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#b91c1c' }}>Danger Zone</div>
            <div style={{ fontSize: 11, color: '#ef4444' }}>
              These actions permanently delete data from the database and cannot be undone.
            </div>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {RESET_OPTIONS.map((opt) => (
            <ResetCard key={opt.target} opt={opt} onDone={() => setRefreshKey((k) => k + 1)} />
          ))}
        </div>
      </div>

      {/* Safe note */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4',
        border: '1px solid #86efac', borderRadius: 10, fontSize: 12, color: '#15803d' }}>
        🛡️ <strong>Admin accounts are never deleted</strong> — only associate employees are removed
        when clearing the employees table.
      </div>
    </div>
  );
}
