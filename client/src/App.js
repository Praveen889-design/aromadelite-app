import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyQuotes from './pages/MyQuotes';
import Products from './pages/Products';
import NewQuote from './pages/NewQuote';
import QuotePreview from './pages/QuotePreview';
import QuoteModificationEditor from './pages/QuoteModificationEditor';
import BillBuilder from './pages/BillBuilder';
import BillPreview from './pages/BillPreview';
import Leads from './pages/Leads';
import AdminPanel from './pages/AdminPanel';
import Clients from './pages/Clients';
import ClientProfile from './pages/ClientProfile';
import QuoteApproval from './pages/QuoteApproval';
import ClientPortal from './pages/ClientPortal';
import LandingPage from './pages/LandingPage';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import { QuoteBuilderProvider } from './context/QuoteBuilderContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Public — no auth required */}
        <Route path="/home" element={<LandingPage />} />
        <Route path="/q/:token" element={<QuoteApproval />} />
        <Route path="/portal/:token" element={<ClientPortal />} />

        <Route
          element={
            <RequireAuth>
              <NotificationsProvider>
                <QuoteBuilderProvider>
                  <Layout />
                </QuoteBuilderProvider>
              </NotificationsProvider>
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="quotes/new"             element={<NewQuote />} />
          <Route path="quotes/:id/modify"      element={<QuoteModificationEditor />} />
          <Route path="quotes/:id"             element={<QuotePreview />} />
          <Route path="quotes"                 element={<MyQuotes />} />
          <Route path="bills/new/:quoteId"     element={<BillBuilder />} />
          <Route path="bills/:id"              element={<BillPreview />} />
          <Route path="products"               element={<Products />} />
          <Route path="leads"                  element={<Leads />} />
          <Route path="clients/:id"            element={<ClientProfile />} />
          <Route path="clients"                element={<Clients />} />
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
