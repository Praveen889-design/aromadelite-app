import React from 'react';

export default function Placeholder({ title, description }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
      <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{description}</p>
    </div>
  );
}
