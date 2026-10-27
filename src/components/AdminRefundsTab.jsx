import { useState } from 'react';
import {
  Search,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  User,
  Tag,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { formatVND } from '../utils/format.js';
import './AdminTicketsTab.css';

export default function AdminRefundsTab({
  refundOrders = [],
  viewMode,
  setViewMode,
  isLoadingRefunds,
  loadRefunds,
  onConfirmRefund,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'REFUND_PENDING' | 'REFUNDED'
  const [confirmingCode, setConfirmingCode] = useState(null);

  const getStatus = (o) => o?.status || o?.orderStatus || '';
  const pendingCount = refundOrders.filter((o) => getStatus(o) === 'REFUND_PENDING').length;

  const filteredRefunds = refundOrders.filter((ord) => {
    const q = searchQuery.toLowerCase();
    const items = Array.isArray(ord.items) ? ord.items : [];
    const seatsStr = items
      .map((i) => i.seatNumber)
      .filter(Boolean)
      .join(', ')
      .toLowerCase();

    const matchSearch =
      !searchQuery ||
      String(ord.orderCode || '')
        .toLowerCase()
        .includes(q) ||
      (ord.customerName && ord.customerName.toLowerCase().includes(q)) ||
      (ord.customerEmail && ord.customerEmail.toLowerCase().includes(q)) ||
      (ord.eventTitle && ord.eventTitle.toLowerCase().includes(q)) ||
      seatsStr.includes(q);

    const ordStatus = getStatus(ord);
    const matchStatus = statusFilter === 'all' || ordStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleConfirm = async (orderCode) => {
    if (!onConfirmRefund) return;
    setConfirmingCode(orderCode);
    try {
      await onConfirmRefund(orderCode);
    } finally {
      setConfirmingCode(null);
    }
  };

  return (
    <div className="atk-root">
      {/* Header Quản lý hoàn tiền */}
      <div className="atk-header">
        <div>
          <div className="atk-badge">
            <RotateCcw size={14} /> Đối soát giao dịch muộn & Hoàn tiền khách hàng
          </div>
          <h1 className="atk-title">Quản lý Hoàn tiền (Refund)</h1>
          <p className="atk-sub">
            Danh sách các đơn khách chuyển khoản sau khi đã hủy/hết hạn mà vị trí ghế đã có người
            khác chọn. Sau khi chuyển khoản hoàn tiền thủ công cho khách, bấm{' '}
            <strong>Xác nhận đã hoàn tiền</strong> để cập nhật hệ thống.
          </p>
        </div>

        {/* Nút đếm và reload */}
        <div className="atk-head-actions">
          <div className="atk-count-chip">
            <RotateCcw size={15} color="#fbbf24" />
            <span>
              Chờ hoàn tiền: <strong className="atk-count-num">{pendingCount}</strong> / Tổng:{' '}
              <strong className="atk-count-num">{refundOrders.length}</strong>
            </span>
          </div>
          <button
            onClick={loadRefunds}
            disabled={isLoadingRefunds}
            title="Tải lại danh sách hoàn tiền từ Database"
            className="atk-reload-btn"
          >
            <RefreshCw size={13} className={isLoadingRefunds ? 'spin' : ''} />
            {isLoadingRefunds ? 'Đang đồng bộ...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel atk-filter-panel">
        <div className="atk-search-box">
          <Search size={18} color="var(--text-dim)" className="atk-icon-fixed" />
          <input
            type="text"
            placeholder="Tìm theo Mã đơn (#1000000xx), Tên khách, Email, Sự kiện, Ghế..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="atk-search-input"
          />
        </div>

        <div className="atk-tools">
          <div className="atk-filter-wrap">
            <span className="atk-filter-label">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="atk-filter-select"
            >
              <option value="all">Tất cả ({refundOrders.length})</option>
              <option value="REFUND_PENDING">Chờ hoàn tiền ({pendingCount})</option>
              <option value="REFUNDED">
                Đã hoàn tiền ({refundOrders.length - pendingCount})
              </option>
            </select>
          </div>

          <div className="atk-view-toggle">
            <button
              onClick={() => setViewMode(viewMode === 'cards' ? 'auto' : 'cards')}
              className={`atk-toggle-btn${viewMode === 'cards' ? ' active' : ''}`}
            >
              <LayoutGrid size={14} />
              <span>Thẻ</span>
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'auto' : 'table')}
              className={`atk-toggle-btn${viewMode === 'table' ? ' active' : ''}`}
            >
              <TableIcon size={14} />
              <span>Bảng</span>
            </button>
          </div>
        </div>
      </div>

      {/* DẠNG THẺ (CARDS) */}
      {(viewMode === 'cards' || viewMode === 'auto') && (
        <div className={`atk-cards-grid${viewMode === 'auto' ? ' admin-mobile-cards-auto' : ''}`}>
          {isLoadingRefunds ? (
            <div className="glass-panel atk-empty">
              Đang tải danh sách đơn hoàn tiền từ cơ sở dữ liệu...
            </div>
          ) : filteredRefunds.length === 0 ? (
            <div className="glass-panel atk-empty">
              Hiện không có đơn hàng nào thuộc diện chờ hoàn tiền hoặc đã hoàn tiền.
            </div>
          ) : (
            filteredRefunds.map((ord) => {
              const items = Array.isArray(ord.items) ? ord.items : [];
              const seatsDisplay =
                items
                  .map((i) => i.seatNumber)
                  .filter(Boolean)
                  .join(', ') || `${items.length} vé`;
              const createdStr = ord.createdAt
                ? new Date(ord.createdAt).toLocaleString('vi-VN')
                : '';

              return (
                <div key={ord.orderCode} className="glass-panel atk-ticket-card">
                  <div className="atk-card-row1">
                    <span className="atk-code-chip atk-code-chip-card">#{ord.orderCode}</span>
                    {ord.status === 'REFUND_PENDING' ? (
                      <span className="atk-status-badge atk-status-badge-card refund-pending">
                        Chờ hoàn tiền
                      </span>
                    ) : (
                      <span className="atk-status-badge atk-status-badge-card refunded">
                        Đã hoàn tiền
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="atk-card-ev-title">
                      {ord.eventTitle || 'Sự kiện hệ thống'}
                    </div>
                    <div className="atk-card-ev-sub">Đặt lúc: {createdStr}</div>
                  </div>

                  <div className="atk-info-grid">
                    <div>
                      <div className="atk-info-label">
                        <User size={13} /> Khách hàng
                      </div>
                      <div className="atk-info-value">{ord.customerName || 'Khách hàng'}</div>
                      <div className="atk-info-sub">{ord.customerEmail || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="atk-info-label">
                        <Tag size={13} /> Ghế bị trùng
                      </div>
                      <div className="atk-info-value-main">{seatsDisplay}</div>
                      <div className="atk-info-sub">{ord.eventLocation || ''}</div>
                    </div>
                  </div>

                  <div className="atk-card-footer">
                    <div>
                      <div className="atk-total-label">Số tiền cần hoàn</div>
                      <div className="atk-total-value">
                        {formatVND(Number(ord.totalAmount) || 0)}
                      </div>
                    </div>

                    {ord.status === 'REFUND_PENDING' ? (
                      <button
                        onClick={() => handleConfirm(ord.orderCode)}
                        disabled={confirmingCode === ord.orderCode}
                        className="atk-refund-confirm-btn"
                      >
                        <CheckCircle2 size={15} />
                        {confirmingCode === ord.orderCode
                          ? 'Đang lưu...'
                          : 'Xác nhận đã hoàn tiền'}
                      </button>
                    ) : (
                      <span className="atk-done-chip">✓ Đã hoàn tiền xong</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* DẠNG BẢNG (TABLE) */}
      {(viewMode === 'table' || viewMode === 'auto') && (
        <div className={`atk-table-wrap${viewMode === 'auto' ? ' admin-desktop-table-auto' : ''}`}>
          <div className="glass-panel atk-table-panel">
            <div className="atk-table-scroll">
              <table className="atk-table">
                <thead>
                  <tr className="atk-thead-row">
                    <th className="atk-th atk-th-w150">MÃ ĐƠN</th>
                    <th className="atk-th atk-th-w260">SỰ KIỆN</th>
                    <th className="atk-th atk-th-w220">KHÁCH HÀNG</th>
                    <th className="atk-th atk-th-w200">GHẾ / VỊ TRÍ</th>
                    <th className="atk-th atk-th-w140">SỐ TIỀN HOÀN</th>
                    <th className="atk-th atk-th-w150">TRẠNG THÁI</th>
                    <th className="atk-th atk-th-w200 atk-th-right">THAO TÁC ADMIN</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingRefunds ? (
                    <tr>
                      <td colSpan="7" className="atk-empty-cell">
                        Đang tải danh sách đơn hoàn tiền từ cơ sở dữ liệu...
                      </td>
                    </tr>
                  ) : filteredRefunds.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="atk-empty-cell">
                        Hiện không có đơn hàng nào thuộc diện chờ hoàn tiền hoặc đã hoàn tiền.
                      </td>
                    </tr>
                  ) : (
                    filteredRefunds.map((ord) => {
                      const items = Array.isArray(ord.items) ? ord.items : [];
                      const seatsDisplay =
                        items
                          .map((i) => i.seatNumber)
                          .filter(Boolean)
                          .join(', ') || `${items.length} vé`;
                      const createdStr = ord.createdAt
                        ? new Date(ord.createdAt).toLocaleString('vi-VN')
                        : '';

                      return (
                        <tr key={ord.orderCode} className="atk-row">
                          <td className="atk-cell">
                            <span className="atk-code-chip atk-code-chip-table">
                              #{ord.orderCode}
                            </span>
                          </td>
                          <td className="atk-cell">
                            <div className="atk-table-ev-title">
                              {ord.eventTitle || 'Sự kiện hệ thống'}
                            </div>
                            <div className="atk-table-ev-sub">Đặt lúc: {createdStr}</div>
                          </td>
                          <td className="atk-cell">
                            <div className="atk-buyer-name">
                              {ord.customerName || 'Khách hàng'}
                            </div>
                            <div className="atk-buyer-sub">{ord.customerEmail || 'N/A'}</div>
                          </td>
                          <td className="atk-cell">
                            <div className="atk-type-value">{seatsDisplay}</div>
                            <div className="atk-info-sub">{ord.eventLocation || ''}</div>
                          </td>
                          <td className="atk-cell">
                            <div className="atk-price-value">
                              {formatVND(Number(ord.totalAmount) || 0)}
                            </div>
                          </td>
                          <td className="atk-cell">
                            {ord.status === 'REFUND_PENDING' ? (
                              <span className="atk-status-badge atk-status-badge-table refund-pending">
                                Chờ hoàn tiền
                              </span>
                            ) : (
                              <span className="atk-status-badge atk-status-badge-table refunded">
                                Đã hoàn tiền
                              </span>
                            )}
                          </td>
                          <td className="atk-cell atk-cell-right">
                            {ord.status === 'REFUND_PENDING' ? (
                              <button
                                onClick={() => handleConfirm(ord.orderCode)}
                                disabled={confirmingCode === ord.orderCode}
                                className="atk-refund-confirm-btn"
                              >
                                <CheckCircle2 size={14} />
                                {confirmingCode === ord.orderCode
                                  ? 'Đang lưu...'
                                  : 'Xác nhận đã hoàn tiền'}
                              </button>
                            ) : (
                              <span className="atk-done-text">✓ Đã hoàn tất</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
