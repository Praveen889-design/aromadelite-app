// Minimal CSV exporter — handles quotes, commas, newlines via RFC-4180 escaping.
const escape = (val) => {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export const toCSV = (rows, columns) =>
  [columns.map((c) => escape(c.header)).join(','),
   ...rows.map((r) => columns.map((c) => escape(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','))
  ].join('\r\n');

export const downloadCSV = (rows, columns, filename) => {
  const csv = toCSV(rows, columns);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
