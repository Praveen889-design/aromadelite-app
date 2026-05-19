import React from 'react';

export const Skeleton = ({ className = '', ...rest }) => (
  <div className={`animate-pulse bg-slate-200/80 rounded ${className}`} {...rest} />
);

export const SkeletonTable = ({ rows = 5, cols = 6 }) => (
  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
    <div className="px-3 py-2 bg-slate-50 flex gap-3">
      {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
    </div>
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-3 py-3 flex gap-3 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={c === 0 ? 'h-4 w-24' : 'h-4 flex-1'} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonCards = ({ count = 4, height = 96 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} style={{ height }} className="rounded-xl" />
    ))}
  </div>
);
