// Toast chỉ hiển thị tạm thời, không lưu vào Trung tâm Thông báo. Thông báo nghiệp vụ được dựng từ đơn hàng ở utils/format.js#buildNotifications.
import { useCallback, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastContext } from './toastContext.js';
import './Toast.css';

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

// Lỗi để lâu hơn (6s) để kịp đọc, các loại còn lại 4s
const TOAST_DURATIONS = { success: 4000, warning: 4000, info: 4000, error: 6000 };
const MAX_TOASTS = 3;
const READ_KEY = 'sellticket_notif_read';

const loadJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const initReadIds = () => {
  try {
    localStorage.removeItem('sellticket_toast_history');
  } catch {
    // ignore storage error
  }
  const parsed = loadJson(READ_KEY, []);
  if (!Array.isArray(parsed)) return [];
  const cleaned = parsed.filter((id) => !(typeof id === 'string' && id.startsWith('toast-')));
  if (cleaned.length !== parsed.length) {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(cleaned));
    } catch {
      // ignore storage error
    }
  }
  return cleaned;
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [readIds, setReadIds] = useState(initReadIds);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 250);
  }, []);

  const push = useCallback(
    (type, message) => {
      idRef.current += 1;
      const id = idRef.current;

      setToasts((prev) => {
        const next = [...prev, { id, type, message, leaving: false }];
        // Chồng tối đa MAX_TOASTS: thừa thì bỏ cái cũ nhất
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });

      setTimeout(() => dismiss(id), TOAST_DURATIONS[type] || 4000);
    },
    [dismiss],
  );

  const markRead = useCallback((notifId) => {
    setReadIds((prev) => {
      if (prev.includes(notifId)) return prev;
      const next = [...prev, notifId];
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const markAllRead = useCallback((ids = []) => {
    setReadIds((prev) => {
      const merged = Array.from(new Set([...prev, ...ids]));
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      return merged;
    });
  }, []);

  const toast = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      warning: (message) => push('warning', message),
      info: (message) => push('info', message),
      readIds,
      markRead,
      markAllRead,
    }),
    [push, readIds, markRead, markAllRead],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              className={`toast toast-${t.type}${t.leaving ? ' toast-leaving' : ''}`}
              role="status"
            >
              <Icon size={18} className="toast-icon" />
              <div className="toast-message">{t.message}</div>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Đóng thông báo"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
