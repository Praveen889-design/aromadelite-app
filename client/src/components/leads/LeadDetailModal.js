import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../Toast';
import { STATUS_LABEL, ClientTypeBadge, StatusBadge } from './badges';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso : iso + 'Z');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function LeadDetailModal({ leadId, open, onClose, onUpdated }) {
  const { toast } = useToast();
  const [lead, setLead] = useState(null);
  const [quoteItems, setQuoteItems] = useState(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [status, setStatus] = useState('new');
  const [followUp, setFollowUp] = useState('');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !leadId) return;
    setLead(null);
    setQuoteItems(null);
    setItemsOpen(false);
    setNewNote('');
    setError('');
    (async () => {
      try {
        const { data } = await api.get(`/api/leads/${leadId}`);
        setLead(data.lead);
        setStatus(data.lead.status);
        setFollowUp(data.lead.follow_up_date || '');
      } catch (e) {
        setError(e?.response?.data?.error || 'Failed to load lead');
      }
    })();
  }, [open, leadId]);

  if (!open) return null;

  const loadQuoteItems = async () => {
    if (!lead?.quote_id || quoteItems) return setItemsOpen((v) => !v);
    try {
      const { data } = await api.get(`/api/quotes/${lead.quote_id}`);
      setQuoteItems(data.quote.items || []);
      setItemsOpen(true);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to load quote items', { kind: 'error' });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      // Append-only note log: prefix with timestamp and existing notes
      let mergedNotes = lead.notes || '';
      if (newNote.trim()) {
        const stamp = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
        const entry = `[${stamp}] ${newNote.trim()}`;
        mergedNotes = mergedNotes ? `${mergedNotes}\n${entry}` : entry;
      }
      const { data } = await api.patch(`/api/leads/${leadId}`, {
        status,
        notes: mergedNotes,
        follow_up_date: followUp || null,
      });
      setLead(data.lead);
      setNewNote('');
      toast('Lead updated.', { kind: 'success' });
      onUpdated?.(data.lead);
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to update lead', { kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 px-3 py-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Lead #{leadId} {lead?.quote_number && <span className="text-slate-500 font-normal text-sm">· {lead.quote_number}</span>}
            </h2>
            {lead && <div className="text-xs text-slate-500 mt-0.5">Created {formatDate(lead.created_at)}</div>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl" aria-label="Close">×</button>
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-5">
          {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-lg p-3 text-sm">{error}</div>}

          {!lead && !error && <div className="text-sm text-slate-500">Loading…</div>}

          {lead && (
            <>
              <section className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Client</div>
                  <div className="font-semibold text-slate-900">{lead.client_business_name || lead.client_name}</div>
                  <div className="text-xs text-slate-600">{lead.client_name}</div>
                  <div className="text-xs text-slate-600">{lead.client_city || '—'}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    {lead.client_phone}{lead.client_email ? ` · ${lead.client_email}` : ''}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <ClientTypeBadge type={lead.client_type} />
                    {lead.requirement_type && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-cyan-50 text-cyan-700 border-cyan-200">
                        {lead.requirement_type}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Pipeline</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatINR(lead.estimated_monthly_value)}
                  </div>
                  <div className="text-xs text-slate-500">estimated monthly</div>
                  {lead.quote_total != null && (
                    <div className="text-xs text-slate-500 mt-1">
                      Quote total: {formatINR(lead.quote_total)}
                    </div>
                  )}
                  <div className="mt-2 inline-flex"><StatusBadge status={lead.status} /></div>
                  {lead.employee_name && (
                    <div className="text-xs text-slate-500 mt-2">
                      Owner: {lead.employee_name}{lead.region ? ` · ${lead.region}` : ''}
                    </div>
                  )}
                </div>
              </section>

              {/* Quote items collapsible */}
              {lead.quote_id && (
                <section className="border border-slate-200 rounded-lg">
                  <button
                    type="button"
                    onClick={loadQuoteItems}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>Quote items {quoteItems ? `(${quoteItems.length})` : ''}</span>
                    <span className="text-slate-400">{itemsOpen ? '▾' : '▸'}</span>
                  </button>
                  {itemsOpen && quoteItems && (
                    <div className="border-t border-slate-200 divide-y divide-slate-100">
                      {quoteItems.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500">No items.</div>
                      ) : quoteItems.map((it, i) => (
                        <div key={i} className="px-3 py-2 flex items-center justify-between text-xs">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 truncate">{it.product_name}</div>
                            <div className="text-slate-500">
                              {[it.variant, it.pack_size].filter(Boolean).join(' · ')} · GST {it.gst_percent}%
                            </div>
                          </div>
                          <div className="text-right text-slate-700">
                            {it.quantity} × {formatINR(it.unit_price)}
                            <div className="font-semibold text-slate-900">
                              {formatINR((Number(it.quantity)||0) * (Number(it.unit_price)||0))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Update form */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs font-medium text-slate-700 mb-1">Status</div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
                  >
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs font-medium text-slate-700 mb-1">Follow-up date</div>
                  <input
                    type="date"
                    value={followUp || ''}
                    min={todayISO()}
                    onChange={(e) => setFollowUp(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
                  />
                </label>
              </section>

              <section>
                <div className="text-xs font-medium text-slate-700 mb-1">Notes log</div>
                {lead.notes ? (
                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap font-sans text-slate-700 max-h-40 overflow-y-auto">
                    {lead.notes}
                  </pre>
                ) : (
                  <div className="text-xs italic text-slate-400">No notes yet.</div>
                )}
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note — will be timestamped and appended."
                  className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
                />
              </section>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div>
            {lead?.quote_id && (
              <Link
                to={`/quotes/${lead.quote_id}`}
                onClick={onClose}
                className="inline-block text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
              >View quote</Link>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            >Close</button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !lead}
              className="px-4 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold disabled:opacity-60"
            >{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
