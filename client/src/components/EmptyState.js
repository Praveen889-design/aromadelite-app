import React from 'react';

const Quote = (p) => (
  <svg viewBox="0 0 96 96" width="80" height="80" fill="none" stroke="#0891B2" strokeWidth="2" {...p}>
    <rect x="20" y="14" width="56" height="68" rx="6" fill="#ECFEFF" />
    <line x1="30" y1="32" x2="66" y2="32" />
    <line x1="30" y1="44" x2="66" y2="44" />
    <line x1="30" y1="56" x2="52" y2="56" />
    <circle cx="68" cy="70" r="10" fill="#fff" />
    <path d="M64 70l3 3 5-6" />
  </svg>
);

const People = (p) => (
  <svg viewBox="0 0 96 96" width="80" height="80" fill="none" stroke="#0891B2" strokeWidth="2" {...p}>
    <circle cx="34" cy="38" r="10" fill="#ECFEFF" />
    <path d="M16 76c2-12 10-18 18-18s16 6 18 18" fill="#ECFEFF" />
    <circle cx="64" cy="34" r="8" fill="#fff" />
    <path d="M50 70c2-10 8-14 14-14s12 4 14 14" />
  </svg>
);

const Search = (p) => (
  <svg viewBox="0 0 96 96" width="80" height="80" fill="none" stroke="#0891B2" strokeWidth="2" {...p}>
    <circle cx="42" cy="42" r="22" fill="#ECFEFF" />
    <line x1="58" y1="58" x2="76" y2="76" strokeLinecap="round" strokeWidth="4" />
    <line x1="32" y1="42" x2="52" y2="42" />
  </svg>
);

const Filter = (p) => (
  <svg viewBox="0 0 96 96" width="80" height="80" fill="none" stroke="#0891B2" strokeWidth="2" {...p}>
    <path d="M18 22h60l-22 28v22l-16 8V50z" fill="#ECFEFF" />
  </svg>
);

const ICONS = { quote: Quote, people: People, search: Search, filter: Filter };

export default function EmptyState({ icon = 'search', title, hint, action }) {
  const Icon = ICONS[icon] || Search;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
      <div className="flex justify-center"><Icon /></div>
      <h3 className="mt-3 font-semibold text-slate-800">{title}</h3>
      {hint && <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
