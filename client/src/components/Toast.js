// Thin wrapper around react-hot-toast so the rest of the app keeps its
// existing `useToast()` API (we added it before installing the library).
import React from 'react';
import toastLib, { Toaster } from 'react-hot-toast';

const baseStyle = {
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  border: '1px solid',
};

const toast = (msg, opts = {}) => {
  const kind = opts.kind || 'success';
  const duration = opts.timeout ?? 3500;
  const fn =
    kind === 'error' ? toastLib.error
    : kind === 'info' ? (m, o) => toastLib(m, { ...o, icon: 'ℹ️' })
    : toastLib.success;
  return fn(msg, { duration });
};

export const ToastProvider = ({ children }) => (
  <>
    {children}
    <Toaster
      position="top-right"
      gutter={8}
      toastOptions={{
        duration: 3500,
        style: { ...baseStyle, background: '#fff', color: '#0f172a', borderColor: '#e2e8f0' },
        success: {
          style: { ...baseStyle, background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' },
          iconTheme: { primary: '#10b981', secondary: '#ecfdf5' },
        },
        error: {
          style: { ...baseStyle, background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca' },
          iconTheme: { primary: '#ef4444', secondary: '#fef2f2' },
        },
      }}
    />
  </>
);

export const useToast = () => ({ toast });
