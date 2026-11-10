import { useState, useEffect } from 'react';
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
  ShieldCheck,
  Armchair,
  Layers,
  RotateCcw,
  Search,
  KeyRound,
} from 'lucide-react';
import { formatVND } from '../utils/format.js';
import ETicketModal from '../components/ETicketModal.jsx';
import {
  fetchGuestOrder,
  getLastGuestOrder,
  getSavedGuest,
  isValidGuestEmail,
} from '../services/guestService.js';
import './OrderHistoryPage.css';

export default function OrderHistoryPage({
  user,
  orders = [],
  events = [],
  isLoading = false,
  onRefresh,
  onSelectEvent,
  onBack,
  onRequireLogin,
  onClaimAccount,
}) {
  // 'paid' | 'refund' | 'all' | 'cancelled'
  const [filterTab, setFilterTab] = useState('paid');
  const [selectedETicketOrder, setSelectedETicketOrder] = useState(null);

  // Tra cứu vé cho khách mua vé không cần đăng nhập (mã đơn + email).
  const [lookupCode, setLookupCode] = useState(() => getLastGuestOrder()?.orderCode || '');
  const [lookupEmail, setLookupEmail] = useState(
    () => getLastGuestOrder()?.email || getSavedGuest()?.email || '',
  );
  const [lookupOrder, setLookupOrder] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const guestStatusLabel = (status) =>
    ({
      SUCCESS: 'Đã thanh toán (Có hiệu lực)',
      REFUND_PENDING: 'Chờ hoàn tiền',
      REFUNDED: 'Đã hoàn tiền',
      PAYMENT_PROCESSING: 'Đang chờ thanh toán',
      CANCELLED: 'Đã hủy giao dịch',
      EXPIRED: 'Hết hạn thanh toán',
    })[status] || status;

  const runGuestLookup = async (code, email) => {
    const cleanCode = String(code || '').trim();
    if (!cleanCode) {
      setLookupError('Vui lòng nhập mã đơn hàng.');
      return;
    }
    if (!isValidGuestEmail(email)) {
      setLookupError('Vui lòng nhập đúng email đã dùng khi mua vé.');
      return;
    }
    setLookupError('');
    setLookupLoading(true);
    try {
      const order = await fetchGuestOrder(cleanCode, email);
      setLookupOrder(order);
    } catch (err) {
      setLookupOrder(null);
      setLookupError(err.message || 'Không tìm thấy đơn hàng.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Vừa thanh toán xong ở trang sự kiện thì tự tra cứu lại đơn đó cho khách.
  // Chạy sau khi mount xong (queueMicrotask) để không setState đồng bộ trong effect.
  useEffect(() => {
    const last = getLastGuestOrder();
    if (!user && last) {
      queueMicrotask(() => runGuestLookup(last.orderCode, last.email));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return (
      <div className="order-history-page">
        <div className="glass-panel order-history-guest">
          <div className="order-history-guest-icon">
            <Ticket size={34} color="var(--primary-light)" />
          </div>
          <h2 className="order-history-guest-title">Lịch sử đặt vé của bạn</h2>
          <p className="order-history-guest-text">
            Mua vé mà không cần đăng nhập? Nhập mã đơn hàng và email đã dùng khi mua vé để xem vé
            điện tử. Muốn xem toàn bộ lịch sử thì đăng nhập, hoặc đặt mật khẩu cho email đó.
          </p>

          <form
            className="oh-lookup-form"
            onSubmit={(e) => {
              e.preventDefault();
              runGuestLookup(lookupCode, lookupEmail);
            }}
          >
            <div className="oh-lookup-row">
              <input
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value)}
                placeholder="Mã đơn hàng"
                className="oh-lookup-input"
              />
              <input
                type="email"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                placeholder="Email đã dùng khi mua vé"
                className="oh-lookup-input"
              />
            </div>
            {lookupError && <p className="oh-lookup-error">{lookupError}</p>}
            <button
              type="submit"
              disabled={lookupLoading}
              className="glow-btn-primary order-history-btn-primary oh-lookup-submit"
            >
              <Search size={16} /> {lookupLoading ? 'Đang tra cứu...' : 'Tra cứu vé'}
            </button>
          </form>

          {lookupOrder && (
            <div className="oh-lookup-result">
              <div className="oh-lookup-result-head">
                <CheckCircle2 size={18} className="oh-lookup-result-icon" />
                <div>
                  <div className="oh-lookup-result-title">
                    Đơn #{lookupOrder.orderCode} —{' '}
                    {guestStatusLabel(lookupOrder.status || lookupOrder.orderStatus)}
                  </div>
                  <div className="oh-lookup-result-sub">
                    {lookupOrder.eventTitle || ''}
                    {lookupOrder.createdAt
                      ? ` • ${new Date(lookupOrder.createdAt).toLocaleString('vi-VN')}`
                      : ''}
                  </div>
                </div>
              </div>
              <div className="oh-lookup-result-actions">
                <button
                  onClick={() => setSelectedETicketOrder(lookupOrder)}
                  className="glow-btn-primary oh-lookup-btn"
                >
                  <Ticket size={15} /> Xem vé điện tử
                </button>
                <button
                  onClick={() =>
                    onClaimAccount ? onClaimAccount(lookupEmail) : onRequireLogin && onRequireLogin()
                  }
                  className="order-history-btn-secondary"
                >
                  <KeyRound size={15} /> Đặt mật khẩu để xem lại sau này
                </button>
              </div>
            </div>
          )}

          <div className="order-history-guest-actions">
            <button onClick={onBack} className="order-history-btn-secondary">
              <ArrowLeft size={16} /> Về trang sự kiện
            </button>
            <button onClick={onRequireLogin} className="glow-btn-primary order-history-btn-primary">
              Đăng nhập ngay
            </button>
          </div>
        </div>

        <ETicketModal
          isOpen={Boolean(selectedETicketOrder)}
          onClose={() => setSelectedETicketOrder(null)}
          order={selectedETicketOrder}
          event={
            selectedETicketOrder
              ? events.find(
                  (e) =>
                    (selectedETicketOrder.eventId &&
                      String(e.id) === String(selectedETicketOrder.eventId)) ||
                    (selectedETicketOrder.eventTitle && e.title === selectedETicketOrder.eventTitle),
                )
              : null
          }
          user={user}
          onSelectEvent={onSelectEvent}
        />
      </div>
    );
  }

  const getStatus = (o) => o?.status || o?.orderStatus || '';

  const paidOrders = orders.filter((o) => getStatus(o) === 'SUCCESS');
  const refundOrders = orders.filter(
    (o) => getStatus(o) === 'REFUND_PENDING' || getStatus(o) === 'REFUNDED',
  );
  const cancelledOrExpiredOrders = orders.filter(
    (o) =>
      getStatus(o) === 'CANCELLED' ||
      getStatus(o) === 'EXPIRED' ||
      getStatus(o) === 'FAILED',
  );

  const displayedOrders =
    filterTab === 'paid'
      ? paidOrders
      : filterTab === 'refund'
        ? refundOrders
        : filterTab === 'cancelled'
          ? cancelledOrExpiredOrders
          : orders;

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
          {refundOrders.length > 0 && (
            <div className="oh-stat-box oh-stat-amber">
              <span className="oh-stat-num">{refundOrders.length}</span>
              <span className="oh-stat-label">Đơn hoàn tiền</span>
            </div>
          )}
          <div className="oh-stat-box">
            <span className="oh-stat-num">{orders.length}</span>
            <span className="oh-stat-label">Tổng giao dịch</span>
          </div>
        </div>
      </div>

      {/* Tabs lọc trạng thái */}
      <div className="oh-tabs-bar">
        <button
          onClick={() => setFilterTab('paid')}
          className={`oh-tab-btn${filterTab === 'paid' ? ' active' : ''}`}
        >
          <CheckCircle2 size={15} />
          <span>Vé đã mua ({paidOrders.length})</span>
        </button>
        <button
          onClick={() => setFilterTab('refund')}
          className={`oh-tab-btn${filterTab === 'refund' ? ' active' : ''}`}
        >
          <RotateCcw size={15} />
          <span>Hoàn tiền ({refundOrders.length})</span>
        </button>
        <button
          onClick={() => setFilterTab('all')}
          className={`oh-tab-btn${filterTab === 'all' ? ' active' : ''}`}
        >
          <Ticket size={15} />
          <span>Tất cả đơn ({orders.length})</span>
        </button>
        <button
          onClick={() => setFilterTab('cancelled')}
          className={`oh-tab-btn${filterTab === 'cancelled' ? ' active' : ''}`}
        >
          <XCircle size={15} />
          <span>Đã hủy / Hết hạn ({cancelledOrExpiredOrders.length})</span>
        </button>
      </div>

      {/* Danh sách đơn hàng */}
      {isLoading && orders.length === 0 ? (
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
            {filterTab === 'paid'
              ? 'Bạn chưa có vé sự kiện nào đã thanh toán'
              : filterTab === 'refund'
                ? 'Không có đơn hàng nào đang chờ hoàn tiền hoặc đã hoàn tiền'
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

            return (
              <div
                key={order.orderCode}
                className={`glass-panel oh-order-card ${
                  currentStatus === 'SUCCESS'
                    ? 'is-paid'
                    : currentStatus === 'REFUND_PENDING'
                      ? 'is-refund-pending'
                      : currentStatus === 'REFUNDED'
                        ? 'is-refunded'
                        : 'is-inactive'
                }`}
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
                          Giao dịch chuyển khoản của bạn được thực hiện sau khi đơn đã hủy hoặc hết
                          hạn, và vị trí ghế này hiện đã có người khác giữ/mua. Khoản tiền{' '}
                          <strong>{formatVND(Number(order.totalAmount) || 0)}</strong> của bạn đã
                          được hệ thống ghi nhận an toàn và đang chờ Quản trị viên hoàn trả lại về
                          tài khoản ngân hàng.
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStatus === 'REFUNDED' && (
                    <div className="oh-refund-alert completed">
                      <CheckCircle2 size={18} className="oh-refund-alert-icon" />
                      <div>
                        <div className="oh-refund-alert-title">
                          Đã hoàn tiền thành công (Refunded)
                        </div>
                        <div className="oh-refund-alert-desc">
                          Quản trị viên đã hoàn trả khoản tiền{' '}
                          <strong>{formatVND(Number(order.totalAmount) || 0)}</strong> của đơn hàng
                          này về tài khoản ngân hàng của bạn.
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
        isOpen={Boolean(selectedETicketOrder)}
        onClose={() => setSelectedETicketOrder(null)}
        order={selectedETicketOrder}
        event={
          selectedETicketOrder
            ? events.find(
                (e) =>
                  (selectedETicketOrder.eventId && String(e.id) === String(selectedETicketOrder.eventId)) ||
                  (selectedETicketOrder.eventTitle && e.title === selectedETicketOrder.eventTitle),
              )
            : null
        }
        user={user}
        onSelectEvent={onSelectEvent}
      />
    </div>
  );
}
