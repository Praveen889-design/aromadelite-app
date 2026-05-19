import React, { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../utils/api';
import { downloadCSV } from '../../utils/csv';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const monthStart = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

const Card = ({ title, children }) => (
  <section className="bg-white rounded-xl border border-slate-200">
    <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">{title}</div>
    <div className="p-4">{children}</div>
  </section>
);

const ChartBlock = ({ data, dataKey, labelKey }) => (
  <div style={{ width: '100%', height: 240 }}>
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey={labelKey} width={140} tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v) => formatINR(v)} />
        <Bar dataKey={dataKey} radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((_, i) => <Cell key={i} fill="#0891B2" />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default function ReportsTab() {
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/reports/summary', { params: { from, to } });
      setData(data);
    } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const exportReport = () => {
    if (!data) return;
    const stamp = new Date().toISOString().slice(0,10);
    const rows = [
      { Section: 'TOTALS', Label: 'Quotes',          Value: data.totals.quotes_count, Amount: '' },
      { Section: 'TOTALS', Label: 'Subtotal',        Value: '',                       Amount: data.totals.subtotal },
      { Section: 'TOTALS', Label: 'GST',             Value: '',                       Amount: data.totals.gst_amount },
      { Section: 'TOTALS', Label: 'Total',           Value: '',                       Amount: data.totals.total_amount },
      ...data.by_associate.map((a) => ({ Section: 'ASSOCIATE', Label: `${a.employee_id} ${a.name} (${a.region || '—'})`, Value: a.quotes_count, Amount: a.total_amount })),
      ...data.by_business_type.map((b) => ({ Section: 'BUSINESS TYPE', Label: b.client_type, Value: b.quotes_count, Amount: b.total_amount })),
      ...data.by_category.map((c) => ({ Section: 'CATEGORY', Label: c.category_name, Value: c.units, Amount: c.subtotal })),
    ];
    downloadCSV(rows, [
      { header: 'Section', key: 'Section' },
      { header: 'Label',   key: 'Label' },
      { header: 'Count',   key: 'Value' },
      { header: 'Amount',  key: 'Amount' },
    ], `Aromadelite_Report_${from}_to_${to}_${stamp}.csv`);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
        <div className="flex-1 grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-600">
            <div className="mb-1">From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                   className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" />
          </label>
          <label className="block text-xs text-slate-600">
            <div className="mb-1">To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                   className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" />
          </label>
        </div>
        <button onClick={exportReport}
                className="text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 whitespace-nowrap">
          Download Report
        </button>
      </div>

      {loading || !data ? (
        <div className="text-sm text-slate-500">Loading report…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Quotes"    value={data.totals.quotes_count} />
            <Tile label="Subtotal"  value={formatINR(data.totals.subtotal)} />
            <Tile label="GST"       value={formatINR(data.totals.gst_amount)} />
            <Tile label="Total"     value={formatINR(data.totals.total_amount)} primary />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card title="By Associate">
              {data.by_associate.length === 0 ? <div className="text-sm text-slate-500">No data.</div> :
                <ChartBlock data={data.by_associate.map((a) => ({ ...a, label: `${a.employee_id} ${a.name}` }))} dataKey="total_amount" labelKey="label" />}
            </Card>
            <Card title="By Business Type">
              {data.by_business_type.length === 0 ? <div className="text-sm text-slate-500">No data.</div> :
                <ChartBlock data={data.by_business_type.map((b) => ({ ...b, label: b.client_type }))} dataKey="total_amount" labelKey="label" />}
            </Card>
            <Card title="By Category">
              {data.by_category.length === 0 ? <div className="text-sm text-slate-500">No data.</div> :
                <ChartBlock data={data.by_category.map((c) => ({ ...c, label: c.category_name }))} dataKey="subtotal" labelKey="label" />}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

const Tile = ({ label, value, primary }) => (
  <div className={`rounded-xl border p-4 ${primary ? 'bg-cyan-50 border-cyan-200 text-cyan-800' : 'bg-white border-slate-200 text-slate-800'}`}>
    <div className="text-[11px] uppercase tracking-wide opacity-75">{label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div>
  </div>
);
