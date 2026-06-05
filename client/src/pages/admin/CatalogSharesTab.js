import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function CatalogSharesTab() {
  const [shares,  setShares]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(null);

  useEffect(() => {
    api.get('/api/catalog/shares')
      .then(({ data }) => setShares(data.shares || []))
      .finally(() => setLoading(false));
  }, []);

  const copyLink = (token) => {
    const url = `${window.location.origin}/catalog/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2500);
    });
  };

  const openLink = (token) => window.open(`/catalog/${token}`, '_blank');

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0D2B6B', margin: 0 }}>📋 Product Catalogue Shared</h2>
          <div style={{ fontSize: 13, color: '#607D8B', marginTop: 4 }}>
            All personalised catalogue links generated for clients
          </div>
        </div>
        <div style={{ background: '#E3F2FD', border: '1px solid #90CAF9', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 700, color: '#0D47A1' }}>
          {shares.length} Catalogue{shares.length !== 1 ? 's' : ''} Shared
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#90A4AE', fontSize: 14 }}>Loading…</div>
      ) : shares.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 14, border: '1.5px dashed #C5CAE9' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 700, color: '#0D2B6B', fontSize: 15 }}>No catalogues shared yet</div>
          <div style={{ color: '#90A4AE', fontSize: 13, marginTop: 6 }}>
            Go to <strong>/catalog</strong> while logged in and click "Share Catalogue" to generate a personalised link.
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #C5CAE9', overflow: 'hidden', boxShadow: '0 2px 12px rgba(13,43,107,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #0D2B6B, #1565C0)' }}>
                {['Business Name', 'POC Name', 'Contact', 'Location', 'Associate', 'Date Shared', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', color: '#fff', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shares.map((s, idx) => (
                <tr key={s.id} style={{ background: idx % 2 === 0 ? '#fff' : '#F8FAFF', borderBottom: '1px solid #E8EEF8' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0D2B6B' }}>
                    {s.business_name || <span style={{ color: '#B0BEC5' }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#37474F' }}>
                    {s.poc_name || <span style={{ color: '#B0BEC5' }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#1565C0', fontWeight: 600 }}>
                    {s.contact || <span style={{ color: '#B0BEC5', fontWeight: 400 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#607D8B' }}>
                    {s.location || <span style={{ color: '#B0BEC5' }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontWeight: 700, color: '#0D2B6B', fontSize: 12 }}>{s.associate_name || '—'}</div>
                    {s.associate_phone && <div style={{ fontSize: 11, color: '#607D8B' }}>{s.associate_phone}</div>}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#78909C', fontSize: 12 }}>
                    {fmtDate(s.created_at)}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => openLink(s.token)}
                        style={{ padding: '5px 12px', background: '#E3F2FD', border: '1px solid #90CAF9', borderRadius: 7, color: '#0D47A1', fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        👁️ View
                      </button>
                      <button
                        onClick={() => copyLink(s.token)}
                        style={{ padding: '5px 12px', background: copied === s.token ? '#E8F5E9' : '#F0F4FF', border: `1px solid ${copied === s.token ? '#A5D6A7' : '#C5CAE9'}`, borderRadius: 7, color: copied === s.token ? '#2E7D32' : '#3F51B5', fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {copied === s.token ? '✓ Copied!' : '🔗 Copy Link'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
