import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getNotifications, markNotificationRead } from '../../services/notificationService';
import './NotificationCenter.css';

export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    try {
      setNotifications(await getNotifications());
    } catch (error) {
      console.error('Unable to refresh notifications:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
    if (!user?.id) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 20000);
    const handleFocus = () => void refresh();
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh, user?.id, location.pathname]);

  if (!user) return null;
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const openNotification = async (notification) => {
    setNotifications((current) => current.map((item) => (
      item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
    )));
    try {
      await markNotificationRead(notification.id);
    } catch (error) {
      console.error('Unable to mark notification as read:', error);
    }
    setOpen(false);
    navigate(`/doubt-forum/${notification.room_id}?doubtId=${encodeURIComponent(notification.doubt_id)}`);
  };

  return (
    <aside className="sp-notification-center" aria-label="Notifications">
      <button
        type="button"
        className="sp-notification-toggle"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={19} />
        {unreadCount > 0 ? <span className="sp-notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>
      {open ? (
        <section className="sp-notification-popover" aria-label="Recent notifications">
          <header>
            <strong>Notifications</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={16} /></button>
          </header>
          {notifications.length ? notifications.map((notification) => (
            <button
              type="button"
              key={notification.id}
              className={`sp-notification-item ${notification.read_at ? '' : 'is-unread'}`}
              onClick={() => void openNotification(notification)}
            >
              <span>{notification.message}</span>
              <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time>
            </button>
          )) : <p className="sp-notification-empty">You’re all caught up.</p>}
        </section>
      ) : null}
    </aside>
  );
}
