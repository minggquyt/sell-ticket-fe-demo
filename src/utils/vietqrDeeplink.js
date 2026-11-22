const VIETQR_BANKS_URL = 'https://api.vietqr.io/v2/banks';
const VIETQR_ANDROID_APPS_URL = 'https://api.vietqr.io/v2/android-app-deeplinks';
const VIETQR_IOS_APPS_URL = 'https://api.vietqr.io/v2/ios-app-deeplinks';

const BANKS_CACHE_KEY = 'vietqr_banks_v2';
const APPS_CACHE_PREFIX = 'vietqr_apps_v2_';
const CACHE_TTL_MS = 30 * 60 * 1000;

let memoryBanksCache = null;
const memoryAppsCache = { android: null, ios: null };

export function isSafeHttpsUrl(raw) {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function detectMobileOS() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints) > 1)
  ) {
    return 'ios';
  }
  return 'desktop';
}

function readSessionCache(key) {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;
    if (Date.now() - Number(parsed.cachedAt || 0) > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCache(key, data) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    // Bỏ qua nếu trình duyệt chặn sessionStorage
  }
}

export async function fetchVietQrBanksCached() {
  if (memoryBanksCache && Date.now() - memoryBanksCache.cachedAt <= CACHE_TTL_MS) {
    return memoryBanksCache.data;
  }
  const stored = readSessionCache(BANKS_CACHE_KEY);
  if (stored) {
    memoryBanksCache = { cachedAt: Date.now(), data: stored };
    return stored;
  }

  const res = await fetch(VIETQR_BANKS_URL);
  const json = await res.json();
  if (!res.ok || !Array.isArray(json?.data)) {
    throw new Error('Không tải được danh sách ngân hàng VietQR.');
  }
  memoryBanksCache = { cachedAt: Date.now(), data: json.data };
  writeSessionCache(BANKS_CACHE_KEY, json.data);
  return json.data;
}

export async function fetchVietQrAppsCached(os) {
  if (os !== 'ios' && os !== 'android') return [];

  const mem = memoryAppsCache[os];
  if (mem && Date.now() - mem.cachedAt <= CACHE_TTL_MS) {
    return mem.data;
  }

  const cacheKey = `${APPS_CACHE_PREFIX}${os}`;
  const stored = readSessionCache(cacheKey);
  if (stored) {
    memoryAppsCache[os] = { cachedAt: Date.now(), data: stored };
    return stored;
  }

  const endpoint = os === 'ios' ? VIETQR_IOS_APPS_URL : VIETQR_ANDROID_APPS_URL;
  const res = await fetch(endpoint);
  const json = await res.json();
  const apps = Array.isArray(json?.apps)
    ? json.apps
    : Array.isArray(json?.data)
      ? json.data
      : null;

  if (!res.ok || !apps) {
    throw new Error('Không tải được danh sách ứng dụng ngân hàng VietQR.');
  }

  memoryAppsCache[os] = { cachedAt: Date.now(), data: apps };
  writeSessionCache(cacheKey, apps);
  return apps;
}

export function findBankByBin(banks = [], bin) {
  if (!bin || !Array.isArray(banks)) return null;
  const target = String(bin).trim();
  return banks.find((b) => String(b?.bin || '').trim() === target) || null;
}

export function splitBankApps(apps = []) {
  if (!Array.isArray(apps)) return { autofillApps: [], otherApps: [] };

  const sorted = [...apps].sort(
    (a, b) => (Number(b?.monthlyInstall) || 0) - (Number(a?.monthlyInstall) || 0),
  );

  return {
    autofillApps: sorted.filter((app) => Number(app?.autofill) === 1),
    otherApps: sorted.filter((app) => Number(app?.autofill) !== 1),
  };
}

export function buildVietQrDeeplinkUrl(app, paymentInfo, bankCode = '') {
  if (!app?.appId && !app?.deeplink) return '#';

  const base =
    isSafeHttpsUrl(app?.deeplink) && app.deeplink.startsWith('https://dl.vietqr.io/')
      ? app.deeplink
      : `https://dl.vietqr.io/pay?app=${encodeURIComponent(app.appId || '')}`;

  try {
    const url = new URL(base);
    if (!url.searchParams.get('app') && app?.appId) {
      url.searchParams.set('app', String(app.appId));
    }

    if (Number(app?.autofill) === 1 && paymentInfo) {
      const targetBank = String(bankCode || paymentInfo.bin || '').trim();
      const accountNo = String(paymentInfo.accountNumber || '').trim();
      if (accountNo && targetBank) {
        url.searchParams.set('ba', `${accountNo}@${targetBank}`);
      }
      if (Number(paymentInfo.amount) > 0) {
        url.searchParams.set('am', String(Math.round(Number(paymentInfo.amount))));
      }
      if (paymentInfo.description) {
        url.searchParams.set('tn', String(paymentInfo.description));
      }
      if (paymentInfo.accountName) {
        url.searchParams.set('bn', String(paymentInfo.accountName));
      }
    }

    return url.toString();
  } catch {
    return '#';
  }
}
