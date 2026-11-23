import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Landmark,
  Lightbulb,
  Loader2,
  LogIn,
  MapPin,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Ticket,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useOrderCheckout } from '../hooks/useOrderCheckout.js';
import { formatVND } from '../utils/format.js';
import { formatCountdown } from '../utils/paymentSession.js';
import { saveAfterLoginPath } from '../utils/authSession.js';
import {
  fetchVietQrBanksCached,
  findBankByBin,
  isSafeHttpsUrl,
} from '../utils/vietqrDeeplink.js';
import { useToast } from '../components/toastContext.js';
import MobileBankDeeplinks from '../components/MobileBankDeeplinks.jsx';
import ETicketModal from '../components/ETicketModal.jsx';
import './CheckoutPage.css';

const TOTAL_CONFIRM_SECONDS = 30;

function CheckoutPageContent({
  orderCode,
  user,
  events = [],
  onNavigate,
  onRequireLogin,
  onOrderUpdated,
}) {
  const location = useLocation();
  const toast = useToast();
  const initialCheckoutData = location.state?.checkoutData || null;

  const {
    order,
    uiState,
    waitingSecondsLeft,
    confirmingSecondsLeft,
    isReconnecting,
    isCancelling,
    cancelCurrentOrder,
  } = useOrderCheckout({
    orderCode,
    user,
    initialCheckoutData,
    onOrderUpdated,
  });

  const [banks, setBanks] = useState([]);
  const [copiedField, setCopiedField] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isETicketOpen, setIsETicketOpen] = useState(false);

  const qrWrapperRef = useRef(null);
  const copyTimerRef = useRef(null);

  const paymentInfo = order?.paymentInfo || null;
  const bankBin = paymentInfo?.bin || '';

  useEffect(() => {
    if (!bankBin) return undefined;
    let cancelled = false;
    fetchVietQrBanksCached()
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          setBanks(list);
        }
      })
      .catch(() => {
        // Không chặn trang checkout nếu API VietQR bị lỗi
      });
    return () => {
      cancelled = true;
    };
  }, [bankBin]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showCancelModal) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isCancelling) {
        setShowCancelModal(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showCancelModal, isCancelling]);

  const beneficiaryBank = findBankByBin(banks, bankBin);
  const matchedEvent =
    events.find(
      (ev) =>
        (order?.eventId && String(ev.id) === String(order.eventId)) ||
        (order?.eventTitle && ev.title === order.eventTitle),
    ) || null;

  const handleCopy = async (fieldKey, rawValue) => {
    const text = String(rawValue ?? '').trim();
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedField(fieldKey);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedField(null), 1800);
    } catch {
      toast.error('Trình duyệt không cho phép sao chép tự động.');
    }
  };

  const handleDownloadQr = () => {
    const canvas = qrWrapperRef.current?.querySelector('canvas');
    if (!canvas) {
      toast.warning('Mã QR chưa sẵn sàng để tải xuống.');
      return;
    }
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `TicketVerse-QR-${orderCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Đã tải ảnh mã QR về thiết bị.');
    } catch {
      toast.error('Không thể xuất ảnh mã QR.');
    }
  };

  const handleConfirmCancel = async () => {
    const res = await cancelCurrentOrder();
    setShowCancelModal(false);
    if (res.ok) {
      toast.info(`Đã hủy đơn hàng #${orderCode} và mở lại ghế.`);
    } else if (!res.authExpired && res.message) {
      toast.warning(res.message);
    }
  };

  const handleGoToLogin = () => {
    saveAfterLoginPath(`/checkout/${orderCode}`);
    onRequireLogin?.();
  };

  const items = Array.isArray(order?.items) ? order.items : [];
  const seatNumbers = items.map((i) => i.seatNumber || i.seat_number).filter(Boolean);
  const zoneCounts = {};
  items.forEach((i) => {
    const zName = i.zoneName || i.zone_name || 'STANDARD';
    zoneCounts[zName] = (zoneCounts[zName] || 0) + 1;
  });
  const zoneSummary = Object.entries(zoneCounts)
    .map(([z, q]) => `${z} x${q}`)
    .join(', ');
  const isSeated =
    order?.eventType === 'SEAT_BASED' ||
    matchedEvent?.event_type === 'SEAT_BASED' ||
    matchedEvent?.type === 'seated';

  const ticketSummary = isSeated
    ? seatNumbers.length > 0
      ? `Ghế: ${seatNumbers.join(', ')}`
      : `${items.length} vé`
    : zoneSummary || `${items.length} vé`;

  const displayAmount = Number(paymentInfo?.amount ?? order?.totalAmount ?? 0);
  const transferDescription = paymentInfo?.description || `VE SU KIEN ${orderCode}`;

  const timerToneClass =
    waitingSecondsLeft <= 10
      ? 'is-danger'
      : waitingSecondsLeft <= 30
        ? 'is-warning'
        : 'is-normal';

  const confirmProgressPct = Math.min(
    100,
    Math.max(4, ((TOTAL_CONFIRM_SECONDS - confirmingSecondsLeft) / TOTAL_CONFIRM_SECONDS) * 100),
  );

  // 1. Trạng thái cần đăng nhập / hết phiên JWT
  if (uiState === 'AUTH_REQUIRED' || uiState === 'AUTH_EXPIRED') {
    const isExpiredJwt = uiState === 'AUTH_EXPIRED';
    return (
      <div className="co-page animate-fade-in">
        <div className="co-payos-card co-payos-state-card">
          <div className="co-state-icon is-amber">
            <LogIn size={28} />
          </div>
          <h1 className="co-state-title">
            {isExpiredJwt ? 'Phiên đăng nhập đã hết hạn' : 'Vui lòng đăng nhập để thanh toán'}
          </h1>
          <p className="co-state-desc">
            {isExpiredJwt
              ? `Phiên xác thực cho đơn hàng #${orderCode} đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.`
              : `Đơn hàng #${orderCode} yêu cầu tài khoản chủ sở hữu đơn để xem thông tin thanh toán.`}
          </p>
          <div className="co-state-actions">
            <button
              type="button"
              onClick={() => onNavigate?.('events')}
              className="co-btn-outline"
            >
              <ArrowLeft size={15} /> Về trang chủ
            </button>
            <button type="button" onClick={handleGoToLogin} className="co-btn-indigo">
              <LogIn size={15} /> {isExpiredJwt ? 'Đăng nhập lại' : 'Đăng nhập ngay'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Trạng thái không tìm thấy đơn hoặc không đúng quyền sở hữu
  if (uiState === 'NOT_FOUND') {
    return (
      <div className="co-page animate-fade-in">
        <div className="co-payos-card co-payos-state-card">
          <div className="co-state-icon is-red">
            <AlertTriangle size={28} />
          </div>
          <h1 className="co-state-title">Không tìm thấy đơn hàng #{orderCode}</h1>
          <p className="co-state-desc">
            Đơn hàng không tồn tại hoặc không thuộc quyền sở hữu của tài khoản hiện tại.
          </p>
          <div className="co-state-actions">
            <button
              type="button"
              onClick={() => onNavigate?.('my-tickets')}
              className="co-btn-outline"
            >
              <Ticket size={15} /> Lịch sử đặt vé
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('events')}
              className="co-btn-indigo"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Trạng thái Loading Skeleton (khớp form card trắng PayOS)
  if (uiState === 'LOADING') {
    return (
      <div className="co-page">
        <div className="co-payos-card">
          <div className="co-card-header">
            <div className="co-skel co-skel-title" />
            <div className="co-skel co-skel-pill" />
          </div>
          <div className="co-tip-bar">
            <div className="co-skel co-skel-tip" />
          </div>
          <div className="co-card-body">
            <div className="co-qr-panel">
              <div className="co-skel co-skel-qr" />
            </div>
            <div className="co-info-panel">
              <div className="co-skel co-skel-line" />
              <div className="co-skel co-skel-line" />
              <div className="co-skel co-skel-line" />
              <div className="co-skel co-skel-line" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Trạng thái SUCCESS
  if (uiState === 'SUCCESS') {
    return (
      <div className="co-page animate-fade-in">
        <div className="co-payos-card co-payos-state-card">
          <div className="co-state-icon is-emerald co-pop-in">
            <CheckCircle2 size={32} />
          </div>
          <div className="co-verified-pill">
            <ShieldCheck size={14} /> Thanh toán đã được xác nhận tự động
          </div>
          <h1 className="co-state-title">Thanh toán thành công!</h1>
          <p className="co-state-desc">
            Đơn hàng <strong>#{orderCode}</strong> đã được ghi nhận và phát hành vé điện tử vào tài khoản{' '}
            <strong>{user?.email}</strong>.
          </p>

          <div className="co-state-summary">
            <div className="co-state-summary-row">
              <span>Sự kiện</span>
              <strong>{order?.eventTitle || matchedEvent?.title || 'Sự kiện TicketVerse'}</strong>
            </div>
            {(order?.location || matchedEvent?.venue) && (
              <div className="co-state-summary-row">
                <span>Địa điểm</span>
                <strong>{order?.location || matchedEvent?.venue}</strong>
              </div>
            )}
            <div className="co-state-summary-row">
              <span>{isSeated ? 'Ghế ngồi' : 'Khu vực / Số lượng'}</span>
              <strong>{isSeated ? seatNumbers.join(', ') || `${items.length} vé` : zoneSummary || `${items.length} vé`}</strong>
            </div>
            <div className="co-state-summary-row is-total">
              <span>Tổng thanh toán</span>
              <strong className="co-val-emerald">{formatVND(displayAmount)}</strong>
            </div>
          </div>

          <div className="co-state-actions">
            <button
              type="button"
              onClick={() => setIsETicketOpen(true)}
              className="co-btn-indigo"
            >
              <QrCode size={15} /> Xem vé điện tử (E-Ticket)
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('my-tickets')}
              className="co-btn-outline"
            >
              <Ticket size={15} /> Đến Lịch sử đặt vé
            </button>
          </div>
        </div>

        <ETicketModal
          isOpen={isETicketOpen}
          onClose={() => setIsETicketOpen(false)}
          order={order}
          event={matchedEvent}
          user={user}
          onSelectEvent={(evId) => onNavigate?.('detail', evId)}
        />
      </div>
    );
  }

  // 5. Trạng thái REFUND_PENDING
  if (uiState === 'REFUND_PENDING') {
    return (
      <div className="co-page animate-fade-in">
        <div className="co-payos-card co-payos-state-card">
          <div className="co-state-icon is-amber">
            <RotateCcw size={28} />
          </div>
          <h1 className="co-state-title">Đơn hàng #{orderCode} đang chờ hoàn tiền</h1>
          <div className="co-refund-banner">
            <AlertTriangle size={17} className="co-refund-banner-icon" />
            <p>
              Giao dịch được thực hiện sau khi hết hạn 2 phút nên hệ thống không thể giữ ghế. Số tiền{' '}
              <strong>{formatVND(displayAmount)}</strong> sẽ được hoàn lại cho bạn.
            </p>
          </div>

          <div className="co-state-actions">
            <button
              type="button"
              onClick={() => onNavigate?.('profile')}
              className="co-btn-amber"
            >
              <Landmark size={15} /> Cập nhật tài khoản nhận hoàn tiền
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('my-tickets')}
              className="co-btn-outline"
            >
              <Ticket size={15} /> Xem Lịch sử đặt vé
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 6. Trạng thái EXPIRED / CANCELLED
  if (uiState === 'EXPIRED' || uiState === 'CANCELLED') {
    const isCancelled = uiState === 'CANCELLED';
    return (
      <div className="co-page animate-fade-in">
        <div className="co-payos-card co-payos-state-card">
          <div className={`co-state-icon ${isCancelled ? 'is-red' : 'is-amber'}`}>
            {isCancelled ? <XCircle size={28} /> : <Clock size={28} />}
          </div>
          <h1 className="co-state-title">
            {isCancelled ? `Đơn hàng #${orderCode} đã được hủy` : `Đơn hàng #${orderCode} đã hết hạn`}
          </h1>
          <p className="co-state-desc">
            {isCancelled
              ? 'Giao dịch đã bị hủy theo yêu cầu của bạn. Toàn bộ ghế đã chọn đã được mở lại.'
              : 'Đã quá thời gian giữ chỗ và xác nhận thanh toán. Toàn bộ ghế của đơn này đã được mở lại.'}
          </p>

          <div className="co-state-actions">
            {order?.eventId && (
              <button
                type="button"
                onClick={() => onNavigate?.('detail', order.eventId)}
                className="co-btn-indigo"
              >
                Chọn lại ghế
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate?.('events')}
              className="co-btn-outline"
            >
              <ArrowLeft size={15} /> Về trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 7. Trạng thái WAITING (0..120s) và CONFIRMING (120..150s) — Layout gọn chuẩn PayOS
  const isConfirming = uiState === 'CONFIRMING';
  const bankDisplayName = beneficiaryBank
    ? `${beneficiaryBank.shortName || beneficiaryBank.short_name} — ${beneficiaryBank.name}`
    : bankBin
      ? `Ngân hàng (BIN ${bankBin})`
      : 'Ngân hàng thụ hưởng VietQR';
  const bankLogoUrl = isSafeHttpsUrl(beneficiaryBank?.logo) ? beneficiaryBank.logo : null;

  const eventDateText = order?.eventStartTime
    ? new Date(order.eventStartTime).toLocaleString('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : `${matchedEvent?.date || ''} ${matchedEvent?.time || ''}`.trim();
  const eventVenueText = order?.location || matchedEvent?.venue || '';

  return (
    <div className="co-page animate-fade-in">
      {/* Thanh điều hướng tối giản phía trên thẻ PayOS */}
      <div className="co-nav-row">
        <button
          type="button"
          onClick={() =>
            order?.eventId ? onNavigate?.('detail', order.eventId) : onNavigate?.('events')
          }
          className="co-back-link"
        >
          <ArrowLeft size={15} />
          <span>{order?.eventId ? 'Quay lại trang sự kiện' : 'Về trang chủ'}</span>
        </button>

        {isReconnecting && (
          <span className="co-reconnect-pill" role="status">
            <WifiOff size={13} />
            <span>Đang kết nối lại...</span>
          </span>
        )}
      </div>

      {/* Thẻ thanh toán trung tâm kiểu PayOS */}
      <div className="co-payos-card">
        {/* Header: Mã đơn + tóm tắt 1 dòng | Pill đếm ngược */}
        <header className="co-card-header">
          <div className="co-header-left">
            <h1 className="co-order-heading">Thanh toán đơn hàng #{orderCode}</h1>
            <p className="co-order-subline">
              {order?.eventTitle || matchedEvent?.title || 'Sự kiện TicketVerse'}
              {ticketSummary ? ` • ${ticketSummary}` : ''}
            </p>
          </div>

          <div className={`co-timer-pill ${isConfirming ? 'is-warning' : timerToneClass}`}>
            {isConfirming ? (
              <>
                <Loader2 size={14} className="co-spin" />
                <span>Đang xác nhận ({confirmingSecondsLeft}s)</span>
              </>
            ) : (
              <>
                <Clock size={14} />
                <span>{formatCountdown(waitingSecondsLeft)}</span>
              </>
            )}
          </div>
        </header>

        {/* Thanh hướng dẫn lavender đặc trưng PayOS */}
        <div className="co-tip-bar">
          <Lightbulb size={15} className="co-tip-icon" />
          <span>
            {isConfirming
              ? 'Đã hết thời gian quét mã. Hệ thống đang xác nhận giao dịch cuối cùng với ngân hàng...'
              : 'Mở App Ngân hàng bất kỳ để quét mã VietQR hoặc chuyển khoản chính xác số tiền bên dưới'}
          </span>
        </div>

        {/* Thân 2 cột kiểu PayOS: Trái (QR) | Phải (Thông tin chuyển khoản) */}
        <div className="co-card-body">
          {/* Cột trái: VietQR */}
          <div className="co-qr-panel">
            <div className="co-qr-brand-row">
              <span className="co-brand-vietqr">VietQR</span>
              <span className="co-brand-sep">•</span>
              <span className="co-brand-napas">napas 247</span>
            </div>

            <div className="co-qr-stage">
              <div
                ref={qrWrapperRef}
                className={`co-qr-frame${isConfirming ? ' is-blurred' : ''}`}
              >
                <span className="co-corner co-corner-tl" aria-hidden="true" />
                <span className="co-corner co-corner-tr" aria-hidden="true" />
                <span className="co-corner co-corner-bl" aria-hidden="true" />
                <span className="co-corner co-corner-br" aria-hidden="true" />
                {paymentInfo?.qrCode ? (
                  <QRCodeCanvas
                    value={paymentInfo.qrCode}
                    size={216}
                    marginSize={3}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                ) : (
                  <div className="co-qr-missing">Đang tạo mã QR...</div>
                )}
              </div>

              {isConfirming && (
                <div className="co-confirm-overlay" role="status" aria-live="polite">
                  <Loader2 size={28} className="co-spin" color="var(--accent-amber)" />
                  <div className="co-confirm-title">Đang xác nhận giao dịch...</div>
                  <p className="co-confirm-text">Vui lòng chờ giây lát ({confirmingSecondsLeft}s)</p>
                  <div className="co-progress-track">
                    <div
                      className="co-progress-fill"
                      style={{ width: `${confirmProgressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {!isConfirming && paymentInfo?.qrCode && (
              <button type="button" onClick={handleDownloadQr} className="co-download-qr-btn">
                <Download size={14} />
                <span>Tải mã QR</span>
              </button>
            )}

            <div className="co-passive-note">
              <span className="co-green-dot" />
              <span>
                {isConfirming
                  ? 'Đang chờ phản hồi ngân hàng...'
                  : 'Tự động cập nhật khi thanh toán xong'}
              </span>
            </div>
          </div>

          {/* Mobile-only Deeplinks (ẩn trên Desktop và ẩn trong pha CONFIRMING) */}
          {!isConfirming && paymentInfo && (
            <div className="co-mobile-deeplinks-slot">
              <MobileBankDeeplinks
                paymentInfo={paymentInfo}
                beneficiaryBankCode={beneficiaryBank?.code || ''}
                onDownloadQr={handleDownloadQr}
              />
            </div>
          )}

          {/* Cột phải: Thông tin chuyển khoản sạch sẽ kiểu PayOS */}
          <div className="co-info-panel">
            {/* Ngân hàng thụ hưởng */}
            <div className="co-bank-head">
              {bankLogoUrl ? (
                <img src={bankLogoUrl} alt={bankDisplayName} className="co-bank-logo" loading="lazy" />
              ) : (
                <div className="co-bank-logo-fallback">
                  <Landmark size={18} />
                </div>
              )}
              <div className="co-bank-meta">
                <span className="co-field-label">Ngân hàng</span>
                <div className="co-bank-name">{bankDisplayName}</div>
              </div>
            </div>

            {/* Các dòng thông tin phẳng có nút Sao chép gọn */}
            <div className="co-kv-list">
              <div className="co-kv-row">
                <div className="co-kv-main">
                  <span className="co-field-label">Chủ tài khoản</span>
                  <span className="co-field-val">{paymentInfo?.accountName || '—'}</span>
                </div>
              </div>

              <div className="co-kv-row">
                <div className="co-kv-main">
                  <span className="co-field-label">Số tài khoản</span>
                  <span className="co-field-val is-mono">{paymentInfo?.accountNumber || '—'}</span>
                </div>
                {paymentInfo?.accountNumber && (
                  <button
                    type="button"
                    onClick={() => handleCopy('accountNumber', paymentInfo.accountNumber)}
                    className={`co-copy-pill${copiedField === 'accountNumber' ? ' is-copied' : ''}`}
                    aria-label="Sao chép số tài khoản"
                  >
                    {copiedField === 'accountNumber' ? (
                      <>
                        <Check size={13} /> Đã chép
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Sao chép
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="co-kv-row">
                <div className="co-kv-main">
                  <span className="co-field-label">Số tiền</span>
                  <span className="co-field-val is-amount">{formatVND(displayAmount)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('amount', String(Math.round(displayAmount)))}
                  className={`co-copy-pill${copiedField === 'amount' ? ' is-copied' : ''}`}
                  aria-label="Sao chép số tiền"
                >
                  {copiedField === 'amount' ? (
                    <>
                      <Check size={13} /> Đã chép
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> Sao chép
                    </>
                  )}
                </button>
              </div>

              <div className="co-kv-row">
                <div className="co-kv-main">
                  <span className="co-field-label">Nội dung</span>
                  <span className="co-field-val is-mono is-desc">{transferDescription}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('description', transferDescription)}
                  className={`co-copy-pill${copiedField === 'description' ? ' is-copied' : ''}`}
                  aria-label="Sao chép nội dung chuyển khoản"
                >
                  {copiedField === 'description' ? (
                    <>
                      <Check size={13} /> Đã chép
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> Sao chép
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="co-inline-note">
              <strong>Lưu ý:</strong> Nhập chính xác số tiền <strong>{formatVND(displayAmount)}</strong>{' '}
              và nội dung <strong>{transferDescription}</strong> khi chuyển khoản.
            </p>

            {/* Footer thẻ: chi tiết ngắn sự kiện + nút Hủy gọn chuẩn PayOS */}
            <div className="co-card-footer">
              <div className="co-event-meta">
                {eventDateText && (
                  <span className="co-event-meta-item">
                    <Calendar size={13} /> {eventDateText}
                  </span>
                )}
                {eventVenueText && (
                  <span className="co-event-meta-item">
                    <MapPin size={13} /> {eventVenueText}
                  </span>
                )}
              </div>

              {!isConfirming && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  disabled={isCancelling}
                  className="co-cancel-btn"
                >
                  Hủy
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hộp xác nhận hủy đơn gọn sáng */}
      {showCancelModal && (
        <div
          className="co-modal-overlay"
          onClick={() => {
            if (!isCancelling) setShowCancelModal(false);
          }}
        >
          <div
            className="co-modal-card animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="co-cancel-modal-title"
          >
            <div className="co-modal-icon">
              <AlertTriangle size={24} />
            </div>
            <h3 id="co-cancel-modal-title" className="co-modal-title">
              Hủy thanh toán đơn #{orderCode}?
            </h3>
            <p className="co-modal-desc">
              Nếu bạn đã chuyển khoản, vui lòng <strong>không hủy</strong> và chờ hệ thống xác nhận.
              Nếu chưa chuyển, hủy đơn sẽ mở lại ghế ngay lập tức.
            </p>
            <div className="co-modal-actions">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="co-btn-outline"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="co-btn-danger"
              >
                {isCancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage(props) {
  const { orderCode } = useParams();
  return <CheckoutPageContent key={orderCode} orderCode={orderCode} {...props} />;
}
