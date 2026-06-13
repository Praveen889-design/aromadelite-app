import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import ProductModal from '../../components/admin/ProductModal';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// Pricing: fill manufacturing_cost + margin_percent (markup on cost) and leave
// base_price blank — the system computes base_price = cost x (1 + margin/100).
// Or set base_price directly to override (it wins when provided).
const CSV_TEMPLATE = [
  'name,category_name,description,unit,manufacturing_cost,margin_percent,base_price,gst_percent,hsn_code,variants,pack_sizes,is_active',
  'Floor Cleaner,Chemical Cleaners,Multi-surface cleaner,L,18,100,,18,3402,Standard|Concentrated,1L=35|5L=160|20L=580,true',
  'Dish Wash Bar,Chemical Cleaners,Heavy-duty bar,pc,4,100,,18,3402,Standard,,true',
  'Acid,Cleaning Chemicals,Direct base price example,L,10,,22,18,2806,,,true',
].join('\n');

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  }).filter((r) => r.name);
}

export default function ProductsTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [modal, setModal] = useState({ open: false, mode: 'create', product: null });
  const [editing, setEditing] = useState({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/api/products/admin/all'),
        api.get('/api/products/categories'),
      ]);
      setProducts(pRes.data.products || []);
      setCategories((cRes.data.categories || []).filter(c => Number(c.product_count) > 0));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (p) => {
    try {
      const { data } = await api.patch(`/api/products/${p.id}`, { is_active: !p.is_active });
      setProducts((arr) => arr.map((x) => (x.id === p.id ? { ...x, ...data.product } : x)));
      toast(`${p.name} ${data.product.is_active ? 'activated' : 'deactivated'}.`, { kind: 'success' });
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update', { kind: 'error' });
    }
  };

  const deleteProduct = async (p) => {
    if (!window.confirm(`Delete "${p.name}" permanently?\n\nThis cannot be undone. Past quotes & bills keep their own records, so they are unaffected.`)) return;
    try {
      await api.delete(`/api/products/${p.id}`);
      setProducts((arr) => arr.filter((x) => x.id !== p.id));
      toast(`${p.name} deleted.`, { kind: 'success' });
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to delete', { kind: 'error' });
    }
  };

  const savePrice = async (p) => {
    const next = Number(editing[p.id]?.base_price);
    if (!Number.isFinite(next) || next < 0) return;
    try {
      const { data } = await api.patch(`/api/products/${p.id}`, { base_price: next });
      setProducts((arr) => arr.map((x) => (x.id === p.id ? { ...x, ...data.product } : x)));
      setEditing((s) => { const c = { ...s }; delete c[p.id]; return c; });
      toast('Base price updated.', { kind: 'success' });
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update', { kind: 'error' });
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aromadelite_products_template.csv';
    a.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const text = await file.text();
    const csvRows = parseCSV(text);
    if (!csvRows.length) { toast('No valid rows found in CSV', { kind: 'error' }); return; }
    setUploading(true);
    try {
      const { data } = await api.post('/api/products/bulk-upload', { rows: csvRows });
      toast(`Bulk upload done: ${data.created} created, ${data.skipped} skipped.`, { kind: 'success' });
      if (data.errors?.length) {
        data.errors.slice(0, 3).forEach((err) => toast(err, { kind: 'error' }));
      }
      load();
    } catch (err) {
      toast(err?.response?.data?.error || 'Upload failed', { kind: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const visible = products.filter((p) => {
    if (filterCat && p.category_id !== Number(filterCat)) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…"
               className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600" />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.icon_emoji} {c.name}</option>)}
        </select>
        <button onClick={downloadTemplate}
                className="border border-slate-300 text-slate-700 text-sm font-medium rounded-lg px-3 py-2 hover:bg-slate-50 whitespace-nowrap">
          ↓ CSV Template
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="border border-cyan-600 text-cyan-700 text-sm font-semibold rounded-lg px-3 py-2 hover:bg-cyan-50 whitespace-nowrap disabled:opacity-50">
          {uploading ? 'Uploading…' : '↑ Bulk Upload'}
        </button>
        <button onClick={() => setModal({ open: true, mode: 'create', product: null })}
                className="bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg px-3 py-2 whitespace-nowrap">
          + Add product
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? <div className="p-6 text-sm text-slate-500">Loading…</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-right px-3 py-2">Base ₹</th>
                <th className="text-right px-3 py-2">Mfg Cost ₹</th>
                <th className="text-right px-3 py-2">5L</th>
                <th className="text-right px-3 py-2">20L</th>
                <th className="text-right px-3 py-2">200L</th>
                <th className="text-left  px-3 py-2">GST</th>
                <th className="text-left  px-3 py-2">HSN</th>
                <th className="text-left  px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const ed = editing[p.id];
                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-500">{(p.variants || []).slice(0,3).join(' · ')}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{p.category_icon} {p.category_name}</td>
                    <td className="px-3 py-2 text-right">
                      {ed ? (
                        <input type="number" min={0} value={ed.base_price}
                               onChange={(e) => setEditing((s) => ({ ...s, [p.id]: { base_price: e.target.value } }))}
                               className="w-20 border border-slate-300 rounded px-1 py-0.5 text-right text-sm" />
                      ) : <span className="font-medium">{formatINR(p.base_price)}</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-amber-700 font-medium">
                      {p.manufacturing_cost != null && p.manufacturing_cost > 0 ? formatINR(p.manufacturing_cost) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">{p.bulk_price_5L != null ? formatINR(p.bulk_price_5L) : '—'}</td>
                    <td className="px-3 py-2 text-right text-xs">{p.bulk_price_20L != null ? formatINR(p.bulk_price_20L) : '—'}</td>
                    <td className="px-3 py-2 text-right text-xs">{p.bulk_price_200L != null ? formatINR(p.bulk_price_200L) : '—'}</td>
                    <td className="px-3 py-2 text-xs">{p.gst_percent}%</td>
                    <td className="px-3 py-2 text-xs">{p.hsn_code || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                        p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {ed ? (
                        <>
                          <button onClick={() => savePrice(p)}
                                  className="text-xs px-2 py-1 rounded bg-cyan-600 text-white hover:bg-cyan-700 mr-1">Save</button>
                          <button onClick={() => setEditing((s) => { const c = { ...s }; delete c[p.id]; return c; })}
                                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditing((s) => ({ ...s, [p.id]: { base_price: p.base_price } }))}
                                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 mr-1">₹</button>
                          <button onClick={() => setModal({ open: true, mode: 'edit', product: p })}
                                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 mr-1">Edit</button>
                          <button onClick={() => toggleActive(p)}
                                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 mr-1">
                            {p.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button onClick={() => deleteProduct(p)}
                                  title="Permanently delete this product"
                                  className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50">
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ProductModal
        open={modal.open}
        mode={modal.mode}
        product={modal.product}
        categories={categories}
        onClose={() => setModal({ open: false, mode: 'create', product: null })}
        onSaved={load}
      />
    </div>
  );
}
