export const AUTH_USER_STORAGE_KEY = 'sellticket_user';
export const AUTH_EXPIRED_EVENT = 'sellticket:auth-expired';
export const AFTER_LOGIN_PATH_KEY = 'sellticket_after_login_path';
export const DEFAULT_EXPIRY_SKEW_SECONDS = 5;
export const MAX_SETTIMEOUT_DELAY_MS = 2147483647;
export const DEFAULT_AUTH_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

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

export function computeAuthServerOffsetMs(serverTime, token = null) {
  if (serverTime) {
    const srvMs = Date.parse(serverTime);
    if (Number.isFinite(srvMs)) {
      return srvMs - Date.now();
    }
  }
  const iat = decodeJwtPayload(token)?.iat;
  if (typeof iat === 'number' && Number.isFinite(iat)) {
    const delta = iat * 1000 - Date.now();
    if (Math.abs(delta) > 30_000) {
      return delta;
    }
  }
  return 0;
}

function normalizeExpiryOptions(options = {}) {
  if (typeof options === 'number') {
    return {
      skewSeconds: Number.isFinite(options) ? options : DEFAULT_EXPIRY_SKEW_SECONDS,
      serverOffsetMs: 0,
    };
  }
  const rawSkew = Number(options?.skewSeconds);
  const rawOffset = Number(options?.serverOffsetMs);
  return {
    skewSeconds: Number.isFinite(rawSkew) ? rawSkew : DEFAULT_EXPIRY_SKEW_SECONDS,
    serverOffsetMs: Number.isFinite(rawOffset) ? rawOffset : 0,
  };
}

export function getRemainingTokenMs(token, options = {}) {
  const expiresAt = getJwtExpiryMs(token);
  if (!expiresAt) return 0;
  const { skewSeconds, serverOffsetMs } = normalizeExpiryOptions(options);
  const effectiveNow = Date.now() + serverOffsetMs;
  return expiresAt - skewSeconds * 1000 - effectiveNow;
}

export function isJwtExpired(token, options = {}) {
  const expiresAt = getJwtExpiryMs(token);
  if (!expiresAt) return true;
  return getRemainingTokenMs(token, options) <= 0;
}

export function clearStoredAuth() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  } catch {
    // Không làm gián đoạn ứng dụng nếu localStorage bị chặn
  }
}

export function writeStoredUser(userData) {
  if (typeof localStorage === 'undefined') return;
  if (!userData) {
    clearStoredAuth();
    return;
  }
  try {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(userData));
  } catch {
    // Không làm gián đoạn ứng dụng nếu localStorage bị chặn
  }
}

export function readInitialAuthState() {
  if (typeof localStorage === 'undefined') {
    return { user: null, wasExpired: false };
  }
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) {
      return { user: null, wasExpired: false };
    }

    const savedUser = JSON.parse(raw);
    if (!savedUser?.token) {
      clearStoredAuth();
      return { user: null, wasExpired: false };
    }

    if (isJwtExpired(savedUser.token, { serverOffsetMs: savedUser.serverOffsetMs || 0 })) {
      clearStoredAuth();
      return { user: null, wasExpired: true };
    }
    return { user: savedUser, wasExpired: false };
  } catch {
    clearStoredAuth();
    return { user: null, wasExpired: false };
  }
}

export function readStoredUser() {
  return readInitialAuthState().user;
}

export function saveAfterLoginPath(path) {
  if (typeof sessionStorage === 'undefined' || typeof path !== 'string') return;
  const trimmed = path.trim();
  if (!/^\/(?!\/)/.test(trimmed)) return;
  if (/^\/login(?:[/?#]|$)/.test(trimmed) || /^\/admin(?:[/?#]|$)/.test(trimmed)) return;
  try {
    sessionStorage.setItem(AFTER_LOGIN_PATH_KEY, trimmed);
  } catch {
    // Không làm gián đoạn ứng dụng nếu sessionStorage bị chặn
  }
}

export function consumeAfterLoginPath() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AFTER_LOGIN_PATH_KEY);
    if (raw !== null) {
      sessionStorage.removeItem(AFTER_LOGIN_PATH_KEY);
    }
    return typeof raw === 'string' && /^\/(?!\/)/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function isProtectedPathname(pathname) {
  if (typeof pathname !== 'string') return false;
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/my-tickets' ||
    pathname === '/profile' ||
    pathname === '/notifications' ||
    /^\/checkout\/[^/]+/.test(pathname)
  );
}

export function isAuthError(status, payload) {
  if (status === 401) return true;
  const code = payload?.data?.code || payload?.code;
  if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID' || code === 'AUTH_REQUIRED') {
    return true;
  }
  if (status === 403 && /token không hợp lệ hoặc đã hết hạn/i.test(payload?.message || '')) {
    return true;
  }
  return false;
}

export function getFriendlyAuthExpiredMessage(payload) {
  const raw = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (!raw || /token/i.test(raw)) {
    return DEFAULT_AUTH_EXPIRED_MESSAGE;
  }
  return raw;
}

export function notifyAuthExpired(reason = DEFAULT_AUTH_EXPIRED_MESSAGE, meta = {}) {
  clearStoredAuth();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail: {
        reason: reason || DEFAULT_AUTH_EXPIRED_MESSAGE,
        source: meta?.source || 'api',
      },
    }),
  );
}
