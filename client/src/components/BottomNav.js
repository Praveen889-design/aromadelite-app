import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { colors, gradients, radii, shadow, tint } from '../theme/tokens';

const ico = (d) => (props) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{d}</svg>
);
const HomeIcon    = ico(<><path d="M3 11 12 4l9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></>);
const QuoteIcon   = ico(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></>);
const LeadsIcon   = ico(<><circle cx="9" cy="9" r="3.5"/><path d="M2.5 19c.6-3.2 3.4-5.5 6.5-5.5s5.9 2.3 6.5 5.5"/><path d="M16 4a3 3 0 0 1 0 6M22 18c-.4-2.4-2.2-4-4.5-4.4"/></>);
const ClientsIcon = ico(<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9M15 21V9"/></>);
const MenuDotsIcon = ico(<><circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="19" cy="5" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/></>);
const BoxIcon     = ico(<><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></>);

const ITEMS = [
  { to: '/',        label: 'Home',    Icon: HomeIcon,    accent: colors.primary, end: true },
  { to: '/quotes',  label: 'Quotes',  Icon: QuoteIcon,   accent: colors.primary },
  { to: '/leads',   label: 'Leads',   Icon: LeadsIcon,   accent: colors.orange },
  { to: '/clients', label: 'Clients', Icon: ClientsIcon, accent: colors.purple },
];

// Quick-create options opened by the center FAB
const CREATE = [
  { label: 'New Quote',    sub: 'Build a quotation',        to: '/quotes/new', grad: gradients.blue,   icon: QuoteIcon },
  { label: 'New Customer', sub: 'Onboard a client',         to: '/clients',    grad: gradients.purple, icon: ClientsIcon },
  { label: 'New Lead',     sub: 'Track a fresh opportunity', to: '/leads',     grad: gradients.orange, icon: LeadsIcon },
  { label: 'Browse Products', sub: 'Open the catalogue',    to: '/products',   grad: gradients.green,  icon: BoxIcon },
];

export default function BottomNav({ onOpenMenu }) {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(false);

  const go = (to) => { setSheet(false); navigate(to); };

  return (
    <>
      {/* ── Quick-create bottom sheet ── */}
      {sheet && (
        <div className="lg:hidden" style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <div onClick={() => setSheet(false)}
               style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(2px)', animation: 'fadeIn .18s ease' }} />
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: '10px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
            boxShadow: '0 -10px 40px rgba(15,23,42,.2)', animation: 'sheetUp .22s cubic-bezier(.2,.8,.2,1)',
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E2E8F0', margin: '4px auto 12px' }} />
            <div style={{ fontWeight: 800, fontSize: 15, color: colors.ink, padding: '0 4px 8px' }}>Create new</div>
            {CREATE.map((c) => (
              <button key={c.label} onClick={() => go(c.to)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 13,
                padding: '11px 10px', border: 'none', background: 'transparent', cursor: 'pointer',
                borderRadius: 14, textAlign: 'left',
              }}>
                <span style={{ width: 44, height: 44, borderRadius: 13, background: c.grad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: shadow.sm }}>
                  <c.icon />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: colors.ink }}>{c.label}</span>
                  <span style={{ display: 'block', fontSize: 12, color: colors.sub }}>{c.sub}</span>
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.faint} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Center create FAB (floats above the bar) ── */}
      <button type="button" onClick={() => setSheet(true)} aria-label="Create new"
        className="lg:hidden"
        style={{
          position: 'fixed', left: '50%', transform: sheet ? 'translateX(-50%) rotate(45deg)' : 'translateX(-50%)',
          bottom: 'calc(58px + env(safe-area-inset-bottom, 4px))',
          zIndex: 35, width: 56, height: 56, borderRadius: '50%', border: '3px solid #fff',
          background: gradients.blue, color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 22px rgba(37,99,235,.45)', transition: 'transform .2s ease',
        }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>

      {/* ── Bottom navigation bar ── */}
      <nav
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
          borderTop: `1px solid ${colors.border}`,
          boxShadow: '0 -6px 20px rgba(8,42,56,.07)',
          gridTemplateColumns: 'repeat(5, 1fr)',
          paddingBottom: 'env(safe-area-inset-bottom, 4px)',
        }}
        className="grid lg:hidden"
        aria-label="Primary navigation"
      >
        {ITEMS.map(({ to, label, Icon, accent, end }) => (
          <NavLink key={to} to={to} end={!!end}
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              padding: '8px 0 7px', textDecoration: 'none',
              color: isActive ? accent : colors.faint,
              fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700, fontSize: 10,
            })}>
            {({ isActive }) => (
              <>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 26, borderRadius: radii.pill,
                  background: isActive ? tint(accent, .14) : 'transparent',
                  transition: 'background .18s ease',
                }}>
                  <Icon width={21} height={21} />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button type="button" onClick={onOpenMenu}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            padding: '8px 0 7px', color: colors.faint,
            fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700, fontSize: 10,
            border: 0, background: 'transparent', cursor: 'pointer',
          }}
          aria-label="Open menu">
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 26 }}>
            <MenuDotsIcon width={21} height={21} />
          </span>
          <span>Menu</span>
        </button>
      </nav>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sheetUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  );
}
