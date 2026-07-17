import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  iconId: 'zap' | 'check' | 'shield' | 'clock';
  color: string;
  textColor: string;
}

export interface ActiveToast {
  title: string;
  message: string;
  type: Notification['type'];
}

interface NotificationContextType {
  notifications: Notification[];
  activeToast: ActiveToast | null;
  setActiveToast: (toast: ActiveToast | null) => void;
  addNotification: (title: string, message: string, type?: Notification['type'], iconId?: Notification['iconId']) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  fetchNotifications: () => Promise<void>;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType>({} as NotificationContextType);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeToast, setActiveToast] = useState<ActiveToast | null>(null);
  const { isAuthenticated } = useAuth();
  const [notificationsEnabled, setNotificationsEnabledState] = useState(() => {
    const saved = localStorage.getItem('notificationsEnabled');
    return saved !== 'false';
  });

  const setNotificationsEnabled = (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    localStorage.setItem('notificationsEnabled', enabled ? 'true' : 'false');
  };

  const mapStyles = (type: string) => {
    const styles: any = {
      success: { color: '#E3FCEF', textColor: '#36B37E', icon: 'check' },
      error: { color: '#FFEBE6', textColor: '#BF2600', icon: 'shield' },
      warning: { color: '#FFF0B3', textColor: '#FF8B00', icon: 'zap' },
      info: { color: '#DEEBFF', textColor: '#1F6FEB', icon: 'clock' },
      PROJECT_CREATE: { color: '#DEEBFF', textColor: '#1F6FEB', icon: 'zap' },
      PROJECT_ASSIGN: { color: '#E3FCEF', textColor: '#36B37E', icon: 'check' }
    };
    return styles[type] || styles.info;
  };

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated()) return;
    if (!notificationsEnabled) {
      setNotifications([]);
      return;
    }
    try {
      const res = await api.get('/notifications');
      const mapped = res.data.map((n: any) => {
        const style = mapStyles(n.type);
        return {
          id: n.id.toString(),
          title: n.title,
          message: n.message,
          type: (n.type.startsWith('PROJECT') ? 'info' : n.type) as any,
          timestamp: n.createdAt,
          read: n.read,
          iconId: style.icon,
          color: style.color,
          textColor: style.textColor
        };
      });
      setNotifications(mapped);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }, [isAuthenticated, notificationsEnabled]);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchNotifications]);

  const addNotification = useCallback((
    title: string,
    message: string,
    type: Notification['type'] = 'info',
    iconId: Notification['iconId'] = 'clock'
  ) => {
    if (!notificationsEnabled) return;
    // This is now mainly for instant local UI feedback, the backend will handle persistence
    const style = mapStyles(type);
    const newNotif: Notification = {
      id: 'temp-' + Math.random().toString(36).substr(2, 9),
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false,
      iconId: iconId === 'clock' ? style.icon : iconId,
      color: style.color,
      textColor: style.textColor
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 20));
    setActiveToast({ title, message, type });
  }, [notificationsEnabled]);

  const markAsRead = async (id: string) => {
    if (id.startsWith('temp-')) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      return;
    }
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) { console.error(err); }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) { console.error(err); }
  };

  const clearAll = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
    } catch (err) { console.error(err); }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      activeToast,
      setActiveToast,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearAll,
      fetchNotifications,
      notificationsEnabled,
      setNotificationsEnabled
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
