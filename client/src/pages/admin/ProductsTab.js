import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import ProductModal from '../../components/admin/ProductModal';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function ProductsTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [modal, setModal] = useState({ open: false, mode: 'create', product: null });
  const [editing, setEditing] = useState({}); // id → { base_price }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/api/products/admin/all'),
        api.get('/api/products/categories'),
      ]);
      setProducts(pRes.data.products || []);
      setCategories(cRes.data.categories || []);
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
                                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">
                            {p.is_active ? 'Disable' : 'Enable'}
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
