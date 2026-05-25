import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext({
  notifications: [],
  unreadCount: 0,
  totalCount: 0,
  refresh: () => {},
  markAllRead: () => {},
});

// localStorage key: timestamp of when the user last "opened" the notification panel
const SEEN_KEY = 'aromadelite_notif_seen_at';

export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const timerRef = useRef(null);

  const computeUnread = useCallback((notifs) => {
    const seenAt = Number(localStorage.getItem(SEEN_KEY) || 0);
    return notifs.filter((n) => new Date(n.created_at).getTime() > seenAt).length;
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/api/notifications');
      const notifs = data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(computeUnread(notifs));
    } catch {
      // silently ignore — network errors shouldn't break the UI
    }
  }, [user, computeUnread]);

  const markAllRead = useCallback(() => {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
    setUnreadCount(0);
  }, []);

  // Poll every 30 s
  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, 30_000);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        totalCount: notifications.length,
        refresh,
        markAllRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
