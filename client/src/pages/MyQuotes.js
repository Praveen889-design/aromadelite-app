import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { SkeletonCards } from '../components/Skeleton';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(String(iso).length === 10 ? String(iso) + 'T00:00:00' : String(iso));
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CLIENT_EMOJI = {
  Hospital: '🏥', FMC: '🏢', Apartment: '🏙️',
  Restaurant: '🍽️', School: '🏫', Contractor: '🔧', Other: '📦',
};

const STATUS_CONFIG = {
  sent:                  { bg: '#CFFAFE', fg: '#155E75',  border: '#0891B2', label: 'Sent' },
  draft:                 { bg: '#E5E7EB', fg: '#374151',  border: '#9CA3AF', label: 'Draft' },
  accepted:              { bg: '#D1FAE5', fg: '#065F46',  border: '#059669', label: '✓ Accepted' },
  modifications_required:{ bg: '#FEF3C7', fg: '#92400E',  border: '#F59E0B', label: '✏️ Modifications' },
  hold:                  { bg: '#EDE9FE', fg: '#4C1D95',  border: '#7C3AED', label: '⏸ Hold' },
  rejected:              { bg: '#FEE2E2', fg: '#991B1B',  border: '#EF4444', label: 'Rejected' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span style={{
      background: cfg.bg, color: cfg.fg,
      fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 10,
      padding: '3px 8px', borderRadius: 999,
      letterSpacing: '.08em', textTransform: 'uppercase',
      display: 'inline-flex', alignItems: 'center', gap: 3,
      whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  );
};

const FilterTab = ({ children, active, onClick }) => (
  <button onClick={onClick} style={{
    flex: '0 0 auto',
    height: 32, padding: '0 14px',
    borderRadius: 999,
    background: active ? '#0E7490' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#0E7490',
    border: active ? '1.5px solid #0E7490' : '1.5px solid #A5F3FC',
    fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 12.5,
    display: 'inline-flex', alignItems: 'center',
    boxShadow: active ? '0 4px 10px rgba(14,116,144,.20)' : 'none',
    whiteSpace: 'nowrap', cursor: 'pointer',
  }}>{children}</button>
);

const QuoteCard = ({ quote, onClick, onGenerateBill }) => {
  const status = (quote.status || 'draft').toLowerCase();
  const isDraft = status === 'draft';
  const isRejected = status === 'rejected';
  const isAccepted = status === 'accepted';
  const emoji = CLIENT_EMOJI[quote.client_type] || '📦';

  return (
    <div onClick={onClick} style={{
      background: isDraft ? '#F8FAFC' : '#FFFFFF',
      border: '1px solid',
      borderColor: isAccepted ? '#6EE7B7' : isRejected ? '#FECACA' : '#A5F3FC',
      borderLeft: isAccepted ? '4px solid #059669' : isRejected ? '4px solid #EF4444' : '1px solid #A5F3FC',
      borderRadius: 14,
      padding: 14,
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(8,42,56,.04)',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 12,
            color: '#0E7490', letterSpacing: '.04em',
          }}>{quote.quote_number || `ARO-${String(quote.id).padStart(4, '0')}`}</div>
          <div style={{
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 15,
            color: '#164E63', marginTop: 3, letterSpacing: '-.01em',
          }}>{quote.client_name || '—'}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <StatusBadge status={status} />
          <div style={{
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 18,
            color: isRejected ? '#9CA3AF' : '#0E7490',
            textDecoration: isRejected ? 'line-through' : 'none',
            marginTop: 6, letterSpacing: '-.01em',
          }}>{formatINR(quote.grand_total)}</div>
        </div>
      </div>

      {/* Client type + date row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{
          background: '#EFF6FF', color: '#1F6BC7',
          fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 11,
          padding: '2px 8px', borderRadius: 999, border: '1px solid #BFDBFE',
        }}>{emoji} {quote.client_type || 'Client'}</span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#6B7280' }}>
          {formatDate(quote.created_at)}
        </span>
        {quote.client_city && (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#6B7280' }}>
            · {quote.client_city}
          </span>
        )}
      </div>

      {/* Follow-up / expected order dates */}
      {(quote.next_follow_up_date || quote.expected_order_date) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
          {quote.next_follow_up_date && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: '#EFF6FF', color: '#1F6BC7', border: '1px solid #BFDBFE',
              fontFamily: "'Inter', sans-serif",
            }}>
              📅 {formatDate(quote.next_follow_up_date)}
            </span>
          )}
          {quote.expected_order_date && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D',
              fontFamily: "'Inter', sans-serif",
            }}>
              🛒 {formatDate(quote.expected_order_date)}
            </span>
          )}
        </div>
      )}

      {/* Status-specific footer */}
      {isRejected && quote.rejection_note && (
        <div style={{
          marginTop: 8, padding: '6px 10px',
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 8,
          fontFamily: "'Source Sans 3', sans-serif", fontSize: 11.5, color: '#991B1B',
          fontStyle: 'italic',
        }}>{quote.rejection_note}</div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {isDraft ? (
          <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
            height: 34, padding: '0 14px',
            border: '1.5px solid #F59E0B', borderRadius: 8,
            background: '#FFFBEB', color: '#92400E',
            fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12,
            cursor: 'pointer',
          }}>Continue Editing</button>
        ) : isRejected ? (
          <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
            height: 34, padding: '0 14px',
            border: '1.5px solid #0E7490', borderRadius: 8,
            background: '#FFFFFF', color: '#0E7490',
            fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12,
            cursor: 'pointer',
          }}>Revise Quote</button>
        ) : isAccepted ? (
          <>
            <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={smallActionBtn('#059669')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
              View
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateBill && onGenerateBill(quote.id); }}
              style={{
                height: 30, padding: '0 12px',
                border: 'none', borderRadius: 8,
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#FFFFFF',
                fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700, fontSize: 11.5,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                cursor: 'pointer',
              }}
            >
              📄 Generate Bill
            </button>
          </>
        ) : (
          <>
            <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={smallActionBtn('#0E7490')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
              View
            </button>
            <button onClick={(e) => { e.stopPropagation(); }} style={smallActionBtn('#25D366', '#FFFFFF')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3A10 10 0 1 0 12 2zm5.6 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.6-3-1.3-5-4.4-5.2-4.6-.2-.2-1.3-1.7-1.3-3.2 0-1.5.8-2.3 1.1-2.6.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2c.1.2.1.4 0 .5l-.3.5-.5.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.8 2.1 1.2 1.1 2.3 1.4 2.6 1.6.3.2.5.1.7-.1l.8-.9c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.6.4 0 .1 0 .8-.3 1.5z"/>
              </svg>
              Share
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const smallActionBtn = (borderColor, bg) => ({
  height: 30, padding: '0 10px',
  border: `1.5px solid ${borderColor}`,
  borderRadius: 8,
  background: bg || '#FFFFFF',
  color: bg ? '#FFFFFF' : borderColor,
  fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, fontSize: 11.5,
  display: 'inline-flex', alignItems: 'center', gap: 4,
  cursor: 'pointer',
});

const FILTERS = ['all', 'draft', 'sent', 'accepted', 'modifications_required', 'hold', 'rejected'];
const FILTER_LABELS = {
  all: 'All',
  draft: 'Draft',
  sent: 'Sent',
  accepted: '✓ Accepted',
  modifications_required: '✏️ Modifications',
  hold: '⏸ Hold',
  rejected: 'Rejected',
};

export default function MyQuotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/quotes');
        setQuotes(data.quotes || []);
      } catch (e) {
        setError(e?.response?.data?.error || 'Failed to load quotes');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = quotes.filter(q =>
    activeFilter === 'all' || (q.status || 'draft').toLowerCase() === activeFilter
  );

  const monthTotal = quotes.reduce((s, q) => s + (q.grand_total || 0), 0);

  const countByStatus = (s) => quotes.filter(q => (q.status || 'draft').toLowerCase() === s).length;

  if (loading) return (
    <div className="space-y-4">
      <SkeletonCards n={4} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 22, color: '#164E63', margin: 0, letterSpacing: '-.01em' }}>
          My Quotes
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, fontSize: 13, color: '#0E7490' }}>
            {quotes.length} quotes
          </span>
          <span style={{ color: '#CBD5E1' }}>·</span>
          <span style={{
            fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 13, color: '#059669',
          }}>{formatINR(monthTotal)} this month</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {FILTERS.map(f => (
          <FilterTab key={f} active={activeFilter === f} onClick={() => setActiveFilter(f)}>
            {FILTER_LABELS[f]}{f !== 'all' && countByStatus(f) > 0 ? ` ${countByStatus(f)}` : ''}
          </FilterTab>
        ))}
      </div>

      {/* Sort row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={sortPill}>
          Newest First
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div style={sortPill}>
          {new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#991B1B', fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Quote list */}
      {filtered.length === 0 ? (
        <EmptyQuotesState onGenerate={() => navigate('/quotes/new')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(q => (
            <QuoteCard
              key={q.id}
              quote={q}
              onClick={() => navigate(`/quotes/${q.id}`)}
              onGenerateBill={(qid) => navigate(`/bills/new/${qid}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const sortPill = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, fontSize: 12.5,
  color: '#0E7490', background: '#ECFEFF',
  border: '1px solid #A5F3FC', padding: '6px 10px', borderRadius: 8,
  cursor: 'pointer',
};

function EmptyQuotesState({ onGenerate }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
    }}>
      {/* Illustrated doc icon */}
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: 'linear-gradient(135deg, #ECFEFF, #CFFAFE)',
        border: '2px solid #A5F3FC',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
          <path d="M14 3v6h6M9 13h6M9 17h4"/>
          <circle cx="16" cy="18" r="4" fill="#059669" stroke="none"/>
          <path d="M14.5 18l1 1 2-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h3 style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 20, color: '#164E63', margin: '0 0 8px', letterSpacing: '-.01em' }}>
        No Quotes Yet
      </h3>
      <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, color: '#6B7280', lineHeight: 1.55, maxWidth: 280, margin: '0 0 24px' }}>
        Start by browsing the product catalog and generating your first quote
      </p>
      <button onClick={onGenerate} style={{
        height: 52, padding: '0 28px',
        border: 0, borderRadius: 12,
        background: '#059669', color: '#FFFFFF',
        fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 15,
        display: 'flex', alignItems: 'center', gap: 8,
        cursor: 'pointer',
        boxShadow: '0 6px 18px rgba(5,150,105,.30)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Generate First Quote
      </button>
    </div>
  );
}
