import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastContext } from './toastContext.js';
import './Toast.css';

// Hệ thống toast (H3): thay cho hộp thoại alert của trình duyệt.
// Dùng: bọc <ToastProvider> ở gốc app, các component con gọi useToast()
// rồi toast.success(...) / toast.error(...) / toast.warning(...) / toast.info(...)

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

// Lỗi để lâu hơn (6s) để kịp đọc, các loại còn lại 4s
const TOAST_DURATIONS = { success: 4000, warning: 4000, info: 4000, error: 6000 };
const MAX_TOASTS = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
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

  const toast = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    warning: (message) => push('warning', message),
    info: (message) => push('info', message),
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
