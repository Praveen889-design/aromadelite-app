import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import useIdleLogout from '../hooks/useIdleLogout';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  useIdleLogout();

  return (
    <div className="min-h-screen lg:flex bg-slate-50">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header onOpenMenu={() => setMenuOpen(true)} />
        {/* pb-20 leaves space for the mobile bottom nav bar */}
        <main className="flex-1 px-4 lg:px-6 py-6 pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav onOpenMenu={() => setMenuOpen(true)} />
    </div>
  );
}
