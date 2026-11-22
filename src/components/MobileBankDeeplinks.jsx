import { useEffect, useState } from 'react';
import {
  Smartphone,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import {
  buildVietQrDeeplinkUrl,
  detectMobileOS,
  fetchVietQrAppsCached,
  isSafeHttpsUrl,
  splitBankApps,
} from '../utils/vietqrDeeplink.js';
import './MobileBankDeeplinks.css';

export default function MobileBankDeeplinks({
  paymentInfo,
  beneficiaryBankCode = '',
  onDownloadQr,
}) {
  const os = detectMobileOS();
  const [apps, setApps] = useState([]);
  const [showOtherBanks, setShowOtherBanks] = useState(false);

  useEffect(() => {
    if (os !== 'ios' && os !== 'android') return undefined;
    let cancelled = false;

    fetchVietQrAppsCached(os)
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          setApps(list);
        }
      })
      .catch(() => {
        // Lỗi API VietQR không được làm gián đoạn hiển thị QR
      });

    return () => {
      cancelled = true;
    };
  }, [os]);

  if ((os !== 'ios' && os !== 'android') || !paymentInfo || apps.length === 0) {
    return null;
  }

  const { autofillApps, otherApps } = splitBankApps(apps);
  if (autofillApps.length === 0 && otherApps.length === 0) {
    return null;
  }

  return (
    <section className="mbd-wrap" aria-label="Mở nhanh ứng dụng ngân hàng">
      <div className="mbd-header">
        <div className="mbd-title-row">
          <Smartphone size={16} color="var(--primary-light)" />
          <h3 className="mbd-title">Mở nhanh ứng dụng ngân hàng</h3>
        </div>
        <p className="mbd-subtitle">
          Chạm để mở app ngân hàng và tự điền sẵn thông tin chuyển khoản.
        </p>
      </div>

      {autofillApps.length > 0 && (
        <div className="mbd-autofill-grid">
          {autofillApps.map((app) => (
            <a
              key={app.appId}
              href={buildVietQrDeeplinkUrl(app, paymentInfo, beneficiaryBankCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="mbd-app-card"
            >
              <div className="mbd-app-top">
                {isSafeHttpsUrl(app.appLogo) ? (
                  <img src={app.appLogo} alt={app.appName} className="mbd-app-logo" loading="lazy" />
                ) : (
                  <div className="mbd-app-logo-fallback">QR</div>
                )}
                <ExternalLink size={12} className="mbd-ext-icon" />
              </div>
              <div className="mbd-app-name">{app.appName}</div>
              <span className="mbd-autofill-badge">
                <Sparkles size={10} /> Tự điền
              </span>
            </a>
          ))}
        </div>
      )}

      <div className="mbd-warning">
        <AlertTriangle size={14} className="mbd-warning-icon" />
        <span>
          Vui lòng <strong>không chỉnh sửa</strong> số tiền hoặc nội dung chuyển khoản.
        </span>
      </div>

      {otherApps.length > 0 && (
        <div className="mbd-other-wrap">
          <button
            type="button"
            onClick={() => setShowOtherBanks((prev) => !prev)}
            className="mbd-other-toggle"
            aria-expanded={showOtherBanks}
          >
            <span>Ngân hàng khác ({otherApps.length} ứng dụng)</span>
            {showOtherBanks ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showOtherBanks && (
            <div className="mbd-other-body">
              <div className="mbd-guide-box">
                <div className="mbd-guide-text">
                  <strong>Hướng dẫn quét QR từ thư viện ảnh:</strong>
                  <ol className="mbd-guide-steps">
                    <li>Bấm <strong>Tải mã QR</strong> để lưu ảnh vào điện thoại.</li>
                    <li>Mở app ngân hàng và chọn <strong>Quét QR từ thư viện</strong>.</li>
                  </ol>
                </div>
                {onDownloadQr && (
                  <button type="button" onClick={onDownloadQr} className="mbd-download-btn">
                    <Download size={14} />
                    <span>Tải mã QR</span>
                  </button>
                )}
              </div>

              <div className="mbd-other-grid">
                {otherApps.map((app) => (
                  <a
                    key={app.appId}
                    href={buildVietQrDeeplinkUrl(app, paymentInfo, beneficiaryBankCode)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mbd-other-item"
                  >
                    {isSafeHttpsUrl(app.appLogo) ? (
                      <img
                        src={app.appLogo}
                        alt={app.appName}
                        className="mbd-other-logo"
                        loading="lazy"
                      />
                    ) : (
                      <div className="mbd-other-logo-fallback">QR</div>
                    )}
                    <span className="mbd-other-name">{app.appName}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
