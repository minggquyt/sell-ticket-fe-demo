import { useCallback, useRef, useState } from 'react';
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
const MAX_HISTORY = 40;
const HISTORY_KEY = 'sellticket_toast_history';
const READ_KEY = 'sellticket_notif_read';

const loadJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [history, setHistory] = useState(() => loadJson(HISTORY_KEY, []));
  const [readIds, setReadIds] = useState(() => loadJson(READ_KEY, []));
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
      const histItem = {
        id: `toast-${Date.now()}-${id}`,
        type,
        message: String(message || ''),
        createdAt: new Date().toISOString(),
      };

      setToasts((prev) => {
        const next = [...prev, { id, type, message, leaving: false }];
        // Chồng tối đa MAX_TOASTS: thừa thì bỏ cái cũ nhất
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });

      setHistory((prev) => {
        const next = [histItem, ...prev].slice(0, MAX_HISTORY);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota error
        }
        return next;
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

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  }, []);

  const toast = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    warning: (message) => push('warning', message),
    info: (message) => push('info', message),
    history,
    readIds,
    markRead,
    markAllRead,
    clearHistory,
  };

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
