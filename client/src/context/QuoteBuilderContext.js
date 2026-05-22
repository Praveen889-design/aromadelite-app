import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'aromadelite_quote_builder';

const emptyClient = {
  client_name: '',
  client_business_name: '',
  client_type: '',
  client_phone: '',
  client_email: '',
  client_city: '',
  requirement_type: '',
  notes: '',
  validity_days: 7,
};

const QuoteBuilderContext = createContext(null);

const lineTotal = (it) => (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);

export const QuoteBuilderProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [client, setClient] = useState(emptyClient);

  // Restore on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.items) setItems(saved.items);
      if (saved.client) setClient({ ...emptyClient, ...saved.client });
    } catch {
      // ignore corrupt storage
    }
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, client }));
  }, [items, client]);

  const addItem = useCallback((item) => {
    setItems((prev) => {
      // Match by product + variant + pack_size
      const idx = prev.findIndex(
        (p) =>
          p.product_id === item.product_id &&
          p.variant === item.variant &&
          p.pack_size === item.pack_size
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: (Number(copy[idx].quantity) || 0) + (Number(item.quantity) || 1) };
        return copy;
      }
      // Preserve system_price (catalog price) separately from unit_price (quoted price)
      const system_price = item.system_price ?? item.unit_price;
      return [...prev, { quantity: 1, ...item, system_price }];
    });
  }, []);

  const updateItem = useCallback((index, patch) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setClient(emptyClient);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const totals = useMemo(() => {
    let subtotal = 0;
    let gst_amount = 0;
    for (const it of items) {
      const line = lineTotal(it);
      subtotal += line;
      gst_amount += (line * (Number(it.gst_percent) || 0)) / 100;
    }
    return {
      subtotal: +subtotal.toFixed(2),
      gst_amount: +gst_amount.toFixed(2),
      total_amount: +(subtotal + gst_amount).toFixed(2),
      line_count: items.length,
      unit_count: items.reduce((a, b) => a + (Number(b.quantity) || 0), 0),
    };
  }, [items]);

  const value = {
    items,
    client,
    totals,
    addItem,
    updateItem,
    removeItem,
    setClient,
    clearCart,
  };

  return <QuoteBuilderContext.Provider value={value}>{children}</QuoteBuilderContext.Provider>;
};

export const useQuoteBuilder = () => {
  const ctx = useContext(QuoteBuilderContext);
  if (!ctx) throw new Error('useQuoteBuilder must be used within QuoteBuilderProvider');
  return ctx;
};
