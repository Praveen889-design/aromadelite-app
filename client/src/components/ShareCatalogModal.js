import React, { useState } from 'react';
import api from '../utils/api';

export default function ShareCatalogModal({ onClose, onCreated }) {
  const [form,   setForm]   = useState({ business_name: '', poc_name: '', contact: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.business_name.trim() && !form.poc_name.trim()) {
      setErr('Enter at least Business Name or POC Name.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const { data } = await api.post('/api/catalog/share', form);
      const url = `${window.location.origin}/catalog/${data.token}`;
      navigator.clipboard.writeText(url).then(() => {});
      onCreated(url, data.token);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to generate link. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: 'business_name', label: 'Business / Hospital Name', placeholder: 'e.g. RICCH Hotels & Banquet Halls', icon: '🏢' },
    { key: 'poc_name',      label: 'Point of Contact (Name)',  placeholder: 'e.g. Prasad Rao',                  icon: '👤' },
    { key: 'contact',       label: 'Contact Number',           placeholder: 'e.g. 9247267529',                  icon: '📞' },
    { key: 'location',      label: 'Location / City',          placeholder: 'e.g. Hyderabad',                   icon: '📍' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(13,43,107,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460, boxShadow: '0 24px 60px rgba(13,43,107,0.22)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0D2B6B, #1565C0)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>📋 Share Product Catalogue</div>
              <div style={{ color: '#90CAF9', fontSize: 12, marginTop: 3 }}>
                Enter client details to generate a personalised catalogue link.
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 18, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {fields.map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#3F51B5', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {f.icon} {f.label}
              </label>
              <input
                type="text"
                value={form[f.key]}
                onChange={set(f.key)}
                placeholder={f.placeholder}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #C5CAE9', borderRadius: 9, padding: '10px 13px', fontSize: 14, outline: 'none', fontFamily: 'inherit', color: '#0D2B6B' }}
                onFocus={e => e.target.style.borderColor = '#1565C0'}
                onBlur={e  => e.target.style.borderColor = '#C5CAE9'}
              />
            </div>
          ))}

          {err && (
            <div style={{ background: '#FFF3E0', border: '1px solid #FFCC02', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#E65100', marginBottom: 12 }}>
              ⚠️ {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', border: '1.5px solid #C5CAE9', borderRadius: 9, background: '#fff', color: '#607D8B', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px', border: 'none', borderRadius: 9, background: saving ? '#90CAF9' : 'linear-gradient(135deg, #0D2B6B, #1565C0)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '⏳ Generating…' : '🔗 Generate Catalogue Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
