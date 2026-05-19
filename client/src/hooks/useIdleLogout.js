import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

// 8 hours of inactivity → auto-logout.
const IDLE_MS = 8 * 60 * 60 * 1000;
const STORAGE_KEY = 'aromadelite_last_activity';

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'visibilitychange'];

export default function useIdleLogout() {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const stamp = () => localStorage.setItem(STORAGE_KEY, String(Date.now()));
    stamp();
    EVENTS.forEach((e) => window.addEventListener(e, stamp, { passive: true }));

    const tick = setInterval(() => {
      const last = Number(localStorage.getItem(STORAGE_KEY)) || Date.now();
      if (Date.now() - last >= IDLE_MS) {
        clearInterval(tick);
        toast('Session expired. Please sign in again.', { kind: 'info', timeout: 5000 });
        logout();
      }
    }, 60_000);

    return () => {
      clearInterval(tick);
      EVENTS.forEach((e) => window.removeEventListener(e, stamp));
    };
  }, [user, logout, toast]);
}
