export const AUTH_USER_STORAGE_KEY = 'sellticket_user';
export const AUTH_EXPIRED_EVENT = 'sellticket:auth-expired';

export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    const segments = token.split('.');
    if (segments.length !== 3) return null;
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getJwtExpiryMs(token) {
  const payload = decodeJwtPayload(token);
  return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
}

export function isJwtExpired(token, skewSeconds = 5) {
  const expiresAt = getJwtExpiryMs(token);
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - skewSeconds * 1000;
}

export function readStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;

    const savedUser = JSON.parse(raw);
    if (!savedUser?.token || isJwtExpired(savedUser.token)) {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      return null;
    }
    return savedUser;
  } catch {
    try {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    } catch {
      // Không làm gián đoạn ứng dụng nếu localStorage bị chặn
    }
    return null;
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  } catch {
    // Không làm gián đoạn ứng dụng nếu localStorage bị chặn
  }
}

export function notifyAuthExpired(reason = 'Phiên đăng nhập đã hết hạn.') {
  clearStoredAuth();
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } }));
}

export function isAuthError(status, payload) {
  if (status === 401) return true;
  if (status !== 403) return false;
  const message = payload?.message || '';
  return /hết hạn|không hợp lệ|chưa đăng nhập|token/i.test(message);
}
