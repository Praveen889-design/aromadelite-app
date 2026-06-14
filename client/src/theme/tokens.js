/**
 * Aromadelite Design System — tokens
 * Modern Enterprise 2025: bright, colorful, glassy soft-card SaaS.
 * Used to reskin screens without touching any business logic.
 */

export const colors = {
  bg:       '#F5F8FF',
  card:     '#FFFFFF',
  border:   '#E8EEF6',
  ink:      '#0F172A',   // headings
  body:     '#334155',
  sub:      '#64748B',   // captions / muted
  faint:    '#94A3B8',

  // brand palette
  primary:  '#2563EB',
  cyan:     '#06B6D4',
  green:    '#22C55E',
  orange:   '#F59E0B',
  purple:   '#8B5CF6',
  pink:     '#EC4899',
  red:      '#EF4444',
  yellow:   '#FACC15',
  neutral:  '#64748B',
};

// Signature gradients — one per module identity
export const gradients = {
  blue:   'linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)',
  cyan:   'linear-gradient(135deg, #06B6D4 0%, #2563EB 100%)',
  purple: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
  green:  'linear-gradient(135deg, #16A34A 0%, #06B6D4 100%)',
  orange: 'linear-gradient(135deg, #F59E0B 0%, #FACC15 100%)',
  red:    'linear-gradient(135deg, #EF4444 0%, #EC4899 100%)',
  hero:   'linear-gradient(135deg, #2563EB 0%, #4F46E5 45%, #06B6D4 100%)',
};

// Module → color identity
export const moduleColor = {
  dashboard: colors.primary,
  customers: colors.purple,
  products:  colors.green,
  orders:    colors.orange,
  quotes:    colors.primary,
  payments:  colors.red,
  reports:   colors.cyan,
  leads:     colors.orange,
};

export const radii = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 };

export const shadow = {
  sm:  '0 1px 3px rgba(15,23,42,.06)',
  md:  '0 6px 20px rgba(15,23,42,.07)',
  lg:  '0 14px 34px rgba(15,23,42,.10)',
  glow: (hex) => `0 10px 26px ${hex}40`,
};

export const font = {
  family: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  display: { fontWeight: 900, fontSize: 26, letterSpacing: '-.02em', lineHeight: 1.1 },
  h1:      { fontWeight: 800, fontSize: 19, letterSpacing: '-.01em', lineHeight: 1.2 },
  h2:      { fontWeight: 800, fontSize: 15, letterSpacing: '-.01em' },
  body:    { fontWeight: 500, fontSize: 13.5 },
  caption: { fontWeight: 600, fontSize: 11, letterSpacing: '.04em' },
  kpi:     { fontWeight: 900, fontSize: 28, letterSpacing: '-.03em', lineHeight: 1 },
};

// Soft tinted surface for a given brand hex (e.g. icon chips / section accents)
export const tint = (hex, a = 0.12) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};
