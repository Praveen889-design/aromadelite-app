// Centralized badge color maps for client_type and lead status.

export const CLIENT_TYPE_LABEL = {
  Hospital:   'Hospital',
  FMC:        'FMC',
  Apartment:  'Apartment',
  Restaurant: 'Restaurant',
  School:     'School',
  Contractor: 'Contractor',
  Other:      'Other',
};

export const CLIENT_TYPE_CLS = {
  Hospital:   'bg-blue-100 text-blue-800 border-blue-200',
  FMC:        'bg-purple-100 text-purple-800 border-purple-200',
  Apartment:  'bg-emerald-100 text-emerald-800 border-emerald-200',
  Restaurant: 'bg-orange-100 text-orange-800 border-orange-200',
  School:     'bg-amber-100 text-amber-800 border-amber-200',
  Contractor: 'bg-slate-200 text-slate-700 border-slate-300',
  Other:      'bg-slate-100 text-slate-700 border-slate-200',
};

export const STATUS_LABEL = {
  new:       'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost:      'Lost',
};

export const STATUS_CLS = {
  new:       'bg-cyan-100 text-cyan-800 border-cyan-200',
  contacted: 'bg-amber-100 text-amber-800 border-amber-200',
  qualified: 'bg-teal-100 text-teal-800 border-teal-200',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  lost:      'bg-rose-100 text-rose-700 border-rose-200',
};

export const Badge = ({ children, className = '' }) => (
  <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${className}`}>
    {children}
  </span>
);

export const ClientTypeBadge = ({ type }) => (
  <Badge className={CLIENT_TYPE_CLS[type] || CLIENT_TYPE_CLS.Other}>
    {CLIENT_TYPE_LABEL[type] || type || '—'}
  </Badge>
);

export const StatusBadge = ({ status }) => (
  <Badge className={STATUS_CLS[status] || STATUS_CLS.new}>
    {STATUS_LABEL[status] || status}
  </Badge>
);
