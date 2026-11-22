import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ticket,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  QrCode,
  ExternalLink,
  Armchair,
  Layers,
  RotateCcw,
  BadgeCheck,
} from 'lucide-react';
import { formatVND, TICKET_TABS, getTicketTabByStatus } from '../utils/format.js';
import ETicketModal from '../components/ETicketModal.jsx';
import './OrderHistoryPage.css';

const getStatus = (o) => o?.status || o?.orderStatus || '';
const VALID_TICKET_TABS = new Set(Object.values(TICKET_TABS));

export default function OrderHistoryPage({
  user,
  orders = [],
  events = [],
  isLoading = false,
  onRefresh,
  onSelectEvent,
  onContinueCheckout,
  onBack,
  onRequireLogin,
  onGoToBankProfile
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedETicketOrder, setSelectedETicketOrder] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const scrolledRef = useRef(null);

  const safeOrders = Array.isArray(orders) ? orders : [];
  const focusCode = searchParams.get('order') || '';
  const focusOrder = focusCode
    ? safeOrders.find((o) => o?.orderCode != null && String(o.orderCode) === focusCode) || null
    : null;

  const hasProcessingOrder = safeOrders.some((o) => getStatus(o) === 'PAYMENT_PROCESSING');

  useEffect(() => {
    if (!hasProcessingOrder) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(timer);
  }, [hasProcessingOrder]);

  useEffect(() => {
    if (!focusCode) {
      scrolledRef.current = null;
      return undefined;
    }
    if (!user || !focusOrder) return undefined;
    if (scrolledRef.current === focusCode) return undefined;

    const rafId = window.requestAnimationFrame(() => {
      const el = document.getElementById(`order-card-${focusOrder.orderCode}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        scrolledRef.current = focusCode;
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [user, focusCode, focusOrder]);

  if (!user) {
    return (
      <div className="order-history-page">
        <div className="glass-panel order-history-guest">
          <div className="order-history-guest-icon">
            <Ticket size={34} color="var(--primary-light)" />
          </div>
          <h2 className="order-history-guest-title">Lịch sử đặt vé của bạn</h2>
          <p className="order-history-guest-text">
            Bạn cần đăng nhập để xem lịch sử đặt vé và vé đã mua. Chức năng tra cứu bằng mã đơn
            hàng đã được tắt để bảo mật và đảm bảo chỉ tài khoản hợp lệ mới xem được thông tin.
          </p>

          <div className="order-history-guest-actions">
            <button onClick={onBack} className="order-history-btn-secondary">
              <ArrowLeft size={16} /> Về trang sự kiện
            </button>
            <button onClick={onRequireLogin} className="glow-btn-primary order-history-btn-primary">
              Đăng nhập ngay
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rawTab = searchParams.get('tab');
  const tabParam = VALID_TICKET_TABS.has(rawTab) ? rawTab : null;
  const filterTab = focusOrder
    ? getTicketTabByStatus(getStatus(focusOrder))
    : tabParam || TICKET_TABS.PAID;

  const handleTabChange = (nextTab) => {
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  const paidOrders = safeOrders.filter((o) => getStatus(o) === 'SUCCESS');
  const refundPendingOrders = safeOrders.filter((o) => getStatus(o) === 'REFUND_PENDING');
  const refundedOrders = safeOrders.filter((o) => getStatus(o) === 'REFUNDED');
  const cancelledOrExpiredOrders = safeOrders.filter(
    (o) =>
      getStatus(o) === 'CANCELLED' ||
      getStatus(o) === 'EXPIRED' ||
      getStatus(o) === 'FAILED',
  );
  const hasRefundBankAlert = refundPendingOrders.some(
    (o) => Boolean(o.refundBankError) || !o.refundBank,
  );

  const displayedOrders =
    filterTab === TICKET_TABS.PAID
      ? paidOrders
      : filterTab === TICKET_TABS.REFUND_PENDING
        ? refundPendingOrders
        : filterTab === TICKET_TABS.REFUNDED
          ? refundedOrders
          : filterTab === TICKET_TABS.CANCELLED
            ? cancelledOrExpiredOrders
            : safeOrders;

  const deepLinkETicketOrder =
    searchParams.get('open') === 'eticket' &&
    focusOrder &&
    getStatus(focusOrder) === 'SUCCESS'
      ? focusOrder
      : null;

  const eticketOrder = selectedETicketOrder || deepLinkETicketOrder;

  const handleCloseETicket = () => {
    setSelectedETicketOrder(null);
    if (searchParams.has('open')) {
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="oh-status-badge oh-status-success">
            <CheckCircle2 size={13} /> Đã thanh toán (Có hiệu lực)
          </span>
        );
      case 'REFUND_PENDING':
        return (
          <span className="oh-status-badge oh-status-refund-pending">
            <RotateCcw size={13} /> Chờ hoàn tiền (Refund)
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="oh-status-badge oh-status-refunded">
            <CheckCircle2 size={13} /> Đã hoàn tiền
          </span>
        );
      case 'PAYMENT_PROCESSING':
        return (
          <span className="oh-status-badge oh-status-processing">
            <Clock size={13} /> Đang chờ thanh toán
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="oh-status-badge oh-status-cancelled">
            <XCircle size={13} /> Đã hủy giao dịch
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="oh-status-badge oh-status-expired">
            <AlertTriangle size={13} /> Hết hạn thanh toán
          </span>
        );
      default:
        return <span className="oh-status-badge oh-status-cancelled">{status}</span>;
    }
  };

  return (
    <div className="order-history-page animate-fade-in">
      {/* Nút quay lại */}
      <div className="oh-top-bar">
        <button onClick={onBack} className="event-back-btn">
          <ArrowLeft size={15} />
          <span>Quay lại khám phá sự kiện</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="oh-refresh-btn"
          title="Đồng bộ dữ liệu vé mới nhất từ hệ thống"
        >
          <RefreshCw size={15} className={isLoading ? 'oh-spin' : ''} />
          <span>{isLoading ? 'Đang tải...' : 'Làm mới dữ liệu'}</span>
        </button>
      </div>

      {/* Header trang */}
      <div className="glass-panel oh-hero-header">
        <div className="oh-hero-left">
          <div className="oh-hero-icon">
            <Ticket size={28} color="#fff" />
          </div>
          <div>
            <h1 className="oh-hero-title">Lịch sử đặt vé & Vé của tôi</h1>
            <p className="oh-hero-sub">
              Quản lý toàn bộ vé điện tử (E-Ticket), theo dõi trạng thái hoàn tiền và lịch sử giao
              dịch của tài khoản <strong>{user.email || user.name}</strong>
            </p>
          </div>
        </div>

        <div className="oh-stats-row">
          <div className="oh-stat-box oh-stat-emerald">
            <span className="oh-stat-num">{paidOrders.length}</span>
            <span className="oh-stat-label">Đơn thành công</span>
          </div>
          {refundPendingOrders.length > 0 && (
            <div className="oh-stat-box oh-stat-amber">
              <span className="oh-stat-num">{refundPendingOrders.length}</span>
              <span className="oh-stat-label">Chờ hoàn tiền</span>
            </div>
          )}
          {refundedOrders.length > 0 && (
            <div className="oh-stat-box oh-stat-cyan">
              <span className="oh-stat-num">{refundedOrders.length}</span>
              <span className="oh-stat-label">Đã hoàn tiền</span>
            </div>
          )}
          <div className="oh-stat-box">
            <span className="oh-stat-num">{safeOrders.length}</span>
            <span className="oh-stat-label">Tổng giao dịch</span>
          </div>
        </div>
      </div>

      {/* Tabs lọc trạng thái */}
      <div className="oh-tabs-bar">
        <button
          type="button"
          onClick={() => handleTabChange(TICKET_TABS.PAID)}
          className={`oh-tab-btn${filterTab === TICKET_TABS.PAID ? ' active' : ''}`}
        >
          <CheckCircle2 size={15} />
          <span>Vé đã mua ({paidOrders.length})</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange(TICKET_TABS.REFUND_PENDING)}
          className={`oh-tab-btn${filterTab === TICKET_TABS.REFUND_PENDING ? ' active' : ''}`}
        >
          <RotateCcw size={15} />
          <span>Chờ hoàn tiền ({refundPendingOrders.length})</span>
          {hasRefundBankAlert && (
            <span
              className="oh-tab-alert-dot"
              title="Có đơn chờ hoàn tiền cần cập nhật hoặc sửa tài khoản ngân hàng"
              aria-label="Cần cập nhật tài khoản ngân hàng"
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleTabChange(TICKET_TABS.REFUNDED)}
          className={`oh-tab-btn${filterTab === TICKET_TABS.REFUNDED ? ' active' : ''}`}
        >
          <BadgeCheck size={15} />
          <span>Đã hoàn tiền ({refundedOrders.length})</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange(TICKET_TABS.ALL)}
          className={`oh-tab-btn${filterTab === TICKET_TABS.ALL ? ' active' : ''}`}
        >
          <Ticket size={15} />
          <span>Tất cả đơn ({safeOrders.length})</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange(TICKET_TABS.CANCELLED)}
          className={`oh-tab-btn${filterTab === TICKET_TABS.CANCELLED ? ' active' : ''}`}
        >
          <XCircle size={15} />
          <span>Đã hủy / Hết hạn ({cancelledOrExpiredOrders.length})</span>
        </button>
      </div>

      {/* Danh sách đơn hàng */}
      {isLoading && safeOrders.length === 0 ? (
        <div className="glass-panel oh-empty-box">
          <div className="app-loading-spinner" />
          <p className="oh-empty-text">Đang đồng bộ lịch sử đặt vé từ cơ sở dữ liệu...</p>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="glass-panel oh-empty-box">
          <div className="oh-empty-icon">
            <Ticket size={32} color="var(--text-dim)" />
          </div>
          <h3 className="oh-empty-title">
            {filterTab === TICKET_TABS.PAID
              ? 'Bạn chưa có vé sự kiện nào đã thanh toán'
              : filterTab === TICKET_TABS.REFUND_PENDING
                ? 'Không có đơn nào đang chờ hoàn tiền'
                : filterTab === TICKET_TABS.REFUNDED
                  ? 'Chưa có đơn nào được hoàn tiền'
                  : 'Không có đơn hàng nào trong danh mục này'}
          </h3>
          <p className="oh-empty-text">
            Hãy khám phá các sự kiện hấp dẫn đang mở bán và đặt chỗ ngay hôm nay!
          </p>
          <button onClick={onBack} className="glow-btn-primary oh-explore-btn">
            Khám phá sự kiện ngay
          </button>
        </div>
      ) : (
        <div className="oh-orders-list">
          {displayedOrders.map((order) => {
            const matchedEvent = events.find(
              (e) =>
                (order.eventId && String(e.id) === String(order.eventId)) ||
                (order.eventTitle && e.title === order.eventTitle),
            );
            const eventId = order.eventId || matchedEvent?.id;
            const isSeated =
              matchedEvent?.type === 'seated' || matchedEvent?.event_type === 'SEAT_BASED';
            const items = Array.isArray(order.items) ? order.items : [];
            const seatNumbers = items.map((i) => i.seatNumber).filter(Boolean);
            const zoneCounts = {};
            items.forEach((i) => {
              const zName = i.zoneName || 'STANDARD';
              zoneCounts[zName] = (zoneCounts[zName] || 0) + 1;
            });
            const zoneSummary = Object.entries(zoneCounts)
              .map(([z, q]) => `${z} (x${q})`)
              .join(', ');

            const currentStatus = getStatus(order);
            const confirmDeadlineMs = order.confirmUntil
              ? new Date(order.confirmUntil).getTime()
              : order.expiresAt
                ? new Date(order.expiresAt).getTime() + 30 * 1000
                : 0;
            const canContinueCheckout =
              currentStatus === 'PAYMENT_PROCESSING' &&
              Boolean(onContinueCheckout) &&
              confirmDeadlineMs > nowMs;
            const createdDate = order.createdAt
              ? new Date(order.createdAt).toLocaleString('vi-VN')
              : '';
            const eventStartDate = order.eventStartTime
              ? new Date(order.eventStartTime).toLocaleDateString('vi-VN')
              : matchedEvent?.date || 'Đang cập nhật';
            const eventStartTimeStr = order.eventStartTime
              ? new Date(order.eventStartTime).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : matchedEvent?.time || '';

            const isHighlighted = Boolean(focusCode) && String(order.orderCode) === focusCode;

            return (
              <div
                key={order.orderCode}
                id={`order-card-${order.orderCode}`}
                className={`glass-panel oh-order-card ${
                  currentStatus === 'SUCCESS'
                    ? 'is-paid'
                    : currentStatus === 'REFUND_PENDING'
                      ? 'is-refund-pending'
                      : currentStatus === 'REFUNDED'
                        ? 'is-refunded'
                        : 'is-inactive'
                }${isHighlighted ? ' is-highlighted' : ''}`}
              >
                {/* Dải màu bên trái */}
                <div
                  className={`oh-order-accent ${
                    currentStatus === 'SUCCESS'
                      ? 'accent-success'
                      : currentStatus === 'REFUND_PENDING'
                        ? 'accent-refund-pending'
                        : currentStatus === 'REFUNDED'
                          ? 'accent-refunded'
                          : 'accent-muted'
                  }`}
                />

                <div className="oh-order-body">
                  {/* Hàng trên: Mã đơn + Ngày tạo + Trạng thái */}
                  <div className="oh-order-top-row">
                    <div className="oh-order-meta-left">
                      <span className="oh-order-code-badge">Mã đơn #{order.orderCode}</span>
                      {createdDate && (
                        <span className="oh-order-created">Đặt lúc: {createdDate}</span>
                      )}
                    </div>
                    {getStatusBadge(currentStatus)}
                  </div>

                  {/* Thông tin sự kiện & ghế */}
                  <div className="oh-order-main-grid">
                    <div className="oh-order-event-info">
                      <h3 className="oh-event-title">
                        {order.eventTitle || matchedEvent?.title || 'Sự kiện TicketVerse'}
                      </h3>

                      <div className="oh-event-details-row">
                        <span className="oh-detail-item">
                          <Calendar size={14} color="var(--primary-light)" />
                          {eventStartDate}
                          {eventStartTimeStr ? ` • ${eventStartTimeStr}` : ''}
                        </span>
                        <span className="oh-detail-item">
                          <MapPin size={14} color="var(--accent-pink)" />
                          {order.eventLocation || matchedEvent?.venue || 'Địa điểm sự kiện'}
                        </span>
                      </div>

                      {/* Vị trí ghế / khu vực */}
                      <div className="oh-seats-summary">
                        {isSeated ? (
                          <div className="oh-seats-chip-row">
                            <span className="oh-seat-type-tag">
                              <Armchair size={13} /> Ghế ngồi:
                            </span>
                            {seatNumbers.map((code) => (
                              <span key={code} className="oh-seat-pill">
                                {code}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="oh-seats-chip-row">
                            <span className="oh-seat-type-tag">
                              <Layers size={13} /> Khu vực / Số lượng:
                            </span>
                            <span className="oh-zone-pill">
                              {zoneSummary || `${items.length} vé`}
                            </span>
                            {seatNumbers.length > 0 && (
                              <span className="oh-zone-codes">({seatNumbers.join(', ')})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cột phải: Tổng tiền + Nút hành động */}
                    <div className="oh-order-right-col">
                      <div className="oh-price-box">
                        <span className="oh-price-label">Tổng thanh toán</span>
                        <span className="oh-price-value">
                          {formatVND(Number(order.totalAmount) || 0)}
                        </span>
                      </div>

                      <div className="oh-card-actions">
                        {canContinueCheckout && (
                          <button
                            onClick={() => onContinueCheckout(order.orderCode)}
                            className="glow-btn-primary oh-btn-eticket"
                          >
                            <QrCode size={15} />
                            <span>Tiếp tục thanh toán</span>
                          </button>
                        )}

                        {currentStatus === 'SUCCESS' && (
                          <button
                            onClick={() => setSelectedETicketOrder(order)}
                            className="glow-btn-primary oh-btn-eticket"
                          >
                            <QrCode size={15} />
                            <span>Xem chi tiết vé (E-Ticket)</span>
                          </button>
                        )}

                        {eventId && (
                          <button
                            onClick={() => onSelectEvent && onSelectEvent(eventId)}
                            className="oh-btn-goto-event"
                          >
                            <span>Đến trang sự kiện</span>
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thông báo giải thích cho đơn Chờ hoàn tiền (REFUND_PENDING) hoặc Đã hoàn tiền (REFUNDED) */}
                  {currentStatus === 'REFUND_PENDING' && (
                    <div className="oh-refund-alert pending">
                      <RotateCcw size={18} className="oh-refund-alert-icon" />
                      <div>
                        <div className="oh-refund-alert-title">
                          Đơn hàng đang chờ hoàn tiền (Refund Pending)
                        </div>
                        <div className="oh-refund-alert-desc">
                          {order.refundBankError ? (
                            <>
                              ⚠️ Admin báo thông tin TK của bạn chưa đúng:{' '}
                              <strong>{order.refundBankError}</strong>.{' '}
                              {onGoToBankProfile && (
                                <button
                                  onClick={onGoToBankProfile}
                                  className="oh-refund-inline-link"
                                >
                                  Vào Hồ sơ sửa lại ngay
                                </button>
                              )}
                            </>
                          ) : order.refundBank ? (
                            <>
                              Đơn đã hủy/quá hạn. Khoản tiền{' '}
                              <strong>{formatVND(Number(order.totalAmount) || 0)}</strong> đã ghi
                              nhận và đang chờ hoàn lại vào TK{' '}
                              <strong>
                                {order.refundBank.bankShortName} - {order.refundBank.bankAccountNo}
                              </strong>
                              .
                            </>
                          ) : (
                            <>
                              Đơn đã hủy/quá hạn. Khoản{' '}
                              <strong>{formatVND(Number(order.totalAmount) || 0)}</strong> đã ghi
                              nhận an toàn, nhưng bạn chưa có TK ngân hàng.{' '}
                              {onGoToBankProfile && (
                                <button
                                  onClick={onGoToBankProfile}
                                  className="oh-refund-inline-link"
                                >
                                  Vào Hồ sơ cập nhật TK ngân hàng
                                </button>
                              )}{' '}
                              để nhận hoàn tiền.
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStatus === 'REFUNDED' && order.refundSnapshot && (
                    <div className="oh-refund-alert completed">
                      <CheckCircle2 size={18} className="oh-refund-alert-icon" />
                      <div>
                        <div className="oh-refund-alert-title">
                          Đã hoàn tiền thành công (Refunded)
                        </div>
                        <div className="oh-refund-alert-desc">
                          Admin đã chuyển khoản{' '}
                          <strong>{formatVND(Number(order.totalAmount) || 0)}</strong> về TK{' '}
                          <strong>
                            {order.refundSnapshot.bankShortName} -{' '}
                            {order.refundSnapshot.bankAccountNo} (
                            {order.refundSnapshot.bankAccountName})
                          </strong>{' '}
                          lúc{' '}
                          {order.refundSnapshot.refundedAt
                            ? new Date(order.refundSnapshot.refundedAt).toLocaleString('vi-VN')
                            : 'đã xong'}
                          .
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal hiển thị vé điện tử E-Ticket toàn màn hình */}
      <ETicketModal
        isOpen={Boolean(eticketOrder)}
        onClose={handleCloseETicket}
        order={eticketOrder}
        event={
          eticketOrder
            ? events.find(
                (e) =>
                  (eticketOrder.eventId && String(e.id) === String(eticketOrder.eventId)) ||
                  (eticketOrder.eventTitle && e.title === eticketOrder.eventTitle),
              )
            : null
        }
        user={user}
        onSelectEvent={onSelectEvent}
      />
    </div>
  );
}
