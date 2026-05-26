import React, { useState } from 'react';
import api from '../../utils/api';

const STATUS_STYLE = {
  good:     { bg: '#f0fdf4', border: '#86efac', dot: '#22c55e', badge: '#dcfce7', badgeText: '#15803d', label: 'Healthy' },
  warning:  { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', badge: '#fef3c7', badgeText: '#92400e', label: 'Attention' },
  critical: { bg: '#fff1f2', border: '#fca5a5', dot: '#ef4444', badge: '#fef2f2', badgeText: '#991b1b', label: 'Critical' },
};

const InsightCard = ({ insight }) => {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_STYLE[insight.status] || STATUS_STYLE.good;
  return (
    <div style={{
      background: s.bg, border: `1.5px solid ${s.border}`,
      borderRadius: 14, padding: '16px 18px',
      transition: 'box-shadow 0.15s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: 22 }}>{insight.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{insight.title}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: s.badge, color: s.badgeText, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                               background: s.dot, marginRight: 4, verticalAlign: 'middle' }} />
                {s.label}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 4, lineHeight: 1.4 }}>
              {insight.headline}
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded((p) => !p)}
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                   fontSize: 18, color: '#94a3b8', padding: '0 2px', lineHeight: 1 }}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${s.border}` }}>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.65, margin: '0 0 12px' }}>
            {insight.detail}
          </p>
          {insight.actions?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b',
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Recommended Actions
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {insight.actions.map((a, i) => (
                  <li key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    fontSize: 12, color: '#1e293b', lineHeight: 1.5,
                  }}>
                    <span style={{ flexShrink: 0, fontWeight: 800, color: s.dot }}>→</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function AiInsightsTab() {
  const [state,       setState]       = useState('idle'); // idle | loading | done | error | no_key
  const [data,        setData]        = useState(null);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [generatedAt, setGeneratedAt] = useState(null);

  const generate = async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const { data: resp } = await api.post('/api/ai-insights');
      setData(resp.insights);
      setGeneratedAt(resp.generated_at);
      setState('done');
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to generate insights';
      const isNoKey = msg.includes('GEMINI_API_KEY');
      setState(isNoKey ? 'no_key' : 'error');
      setErrorMsg(msg);
    }
  };

  /* ── Idle state ─────────────────────────────────────────────── */
  if (state === 'idle') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🤖</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
          AI Business Insights
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', maxWidth: 460, lineHeight: 1.6, margin: '0 0 28px' }}>
          Powered by <strong>Google Gemini 1.5 Flash</strong>. Analyzes your last 30 days of
          revenue, quotes, associate performance, payments and client activity — then gives
          you actionable recommendations in seconds.
        </p>
        <button onClick={generate} style={{
          padding: '12px 28px', borderRadius: 12, fontSize: 15, fontWeight: 700,
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff',
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <span>✨</span> Generate AI Insights
        </button>
        <div style={{ marginTop: 20, fontSize: 11, color: '#94a3b8' }}>
          Uses Gemini 1.5 Flash (free tier) · No client PII sent to AI · ~5 seconds
        </div>
      </div>
    );
  }

  /* ── Loading state ──────────────────────────────────────────── */
  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: 'spin 1.5s linear infinite' }}>⚙️</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>
          Analysing your business data…
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 340, lineHeight: 1.6 }}>
          Pulling metrics from quotes, bills, clients and payments · Sending to Gemini AI ·
          Generating personalised insights
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          {['Revenue', 'Pipeline', 'Associates', 'Payments', 'Clients', 'Products'].map((s, i) => (
            <div key={s} style={{
              padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
              background: '#f3e8ff', color: '#7c3aed',
              animation: `fadeIn 0.4s ease ${i * 0.15}s both`,
            }}>
              <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
              {s}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── No API key ─────────────────────────────────────────────── */
  if (state === 'no_key') {
    return (
      <div style={{ padding: '40px 24px', maxWidth: 580, margin: '0 auto' }}>
        <div style={{ background: '#fffbeb', border: '2px solid #fde68a', borderRadius: 14, padding: '24px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#92400e', marginBottom: 8 }}>
            Gemini API Key Required
          </div>
          <p style={{ fontSize: 13, color: '#78350f', lineHeight: 1.7, marginBottom: 20 }}>
            To use AI Insights, add your free Google Gemini API key to the server environment.
          </p>
          <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>3-step setup (free):</div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#374151', lineHeight: 2 }}>
              <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                  style={{ color: '#7c3aed', fontWeight: 700 }}>aistudio.google.com/app/apikey</a></li>
              <li>Click <strong>"Create API Key"</strong> → Copy it</li>
              <li>Add to your Vercel project: Settings → Environment Variables →
                  <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 12, marginLeft: 4 }}>
                    GEMINI_API_KEY = your_key_here
                  </code>
                  then redeploy</li>
            </ol>
          </div>
          <button onClick={() => setState('idle')}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                     background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer' }}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  /* ── Error state ────────────────────────────────────────────── */
  if (state === 'error') {
    return (
      <div style={{ padding: '40px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Failed to generate insights</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{errorMsg}</div>
        <button onClick={generate}
          style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                   background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer' }}>
          🔄 Try Again
        </button>
      </div>
    );
  }

  /* ── Done — show results ────────────────────────────────────── */
  const fmtTime = (iso) => {
    try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
        borderRadius: 14, padding: '16px 20px',
      }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🤖</span> AI Business Insights
          </div>
          <div style={{ fontSize: 12, color: '#ddd6fe', marginTop: 2 }}>
            Generated at {fmtTime(generatedAt)} · Powered by Gemini 1.5 Flash · Last 30 days data
          </div>
        </div>
        <button onClick={generate} style={{
          padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700,
          background: 'rgba(255,255,255,0.15)', color: '#fff',
          border: '1.5px solid rgba(255,255,255,0.3)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          🔄 Regenerate
        </button>
      </div>

      {/* Executive summary */}
      {data?.summary && (
        <div style={{
          background: '#f5f3ff', border: '1.5px solid #ddd6fe',
          borderRadius: 14, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9',
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            📊 Executive Summary
          </div>
          <p style={{ fontSize: 14, color: '#1e1b4b', lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
            {data.summary}
          </p>
        </div>
      )}

      {/* Priority actions */}
      {data?.priority_actions?.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626',
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            🚨 Top Priority Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.priority_actions.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                  background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 13, color: '#7f1d1d', fontWeight: 600, lineHeight: 1.5 }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight cards — 2-column grid */}
      {data?.insights?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {data.insights.map((ins) => <InsightCard key={ins.id} insight={ins} />)}
        </div>
      )}

      {/* Forecast */}
      {data?.forecast && (
        <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8',
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            🔮 2-Week Forecast
          </div>
          <p style={{ fontSize: 13, color: '#1e3a5f', lineHeight: 1.7, margin: 0 }}>
            {data.forecast}
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', paddingBottom: 8 }}>
        AI analysis is based on aggregated business metrics only — no client PII is shared with Google.
        Always verify recommendations with your team before acting.
      </div>
    </div>
  );
}
