import { createContext, useContext } from 'react';

// Context của hệ thống toast (H3) — tách riêng khỏi Toast.jsx để mỗi file
// chỉ xuất một loại (component hoặc hook), đúng quy ước của project.
export const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast phải được dùng bên trong <ToastProvider>');
  }
  return ctx;
}
