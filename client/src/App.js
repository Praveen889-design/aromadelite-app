import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyQuotes from './pages/MyQuotes';
import Products from './pages/Products';
import NewQuote from './pages/NewQuote';
import QuotePreview from './pages/QuotePreview';
import Leads from './pages/Leads';
import AdminPanel from './pages/AdminPanel';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import { QuoteBuilderProvider } from './context/QuoteBuilderContext';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <RequireAuth>
              <QuoteBuilderProvider>
                <Layout />
              </QuoteBuilderProvider>
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="quotes/new" element={<NewQuote />} />
          <Route path="quotes/:id" element={<QuotePreview />} />
          <Route path="quotes"     element={<MyQuotes />} />
          <Route path="products"   element={<Products />} />
          <Route path="leads"      element={<Leads />} />
          <Route
            path="admin"
            element={
              <RequireAuth adminOnly>
                <AdminPanel />
              </RequireAuth>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
