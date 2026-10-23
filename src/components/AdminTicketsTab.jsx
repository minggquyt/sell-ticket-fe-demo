import {
  Search,
  Tag,
  RefreshCw,
  Ticket,
  CheckCircle2,
  User,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { formatVND } from '../utils/format.js';
import { useToast } from './toastContext.js';
import './AdminTicketsTab.css';

// Tab Quản lý vé của trang quản trị (tách từ AdminPage ở Phần 3c):
// bộ lọc + danh sách vé ở 2 chế độ thẻ / bảng + nút soát vé (check-in tại chỗ).
export default function AdminTicketsTab({
  events,
  ticketsList,
  setTicketsList,
  filteredTickets,
  ticketSearch,
  setTicketSearch,
  ticketEventFilter,
  setTicketEventFilter,
  ticketStatusFilter,
  setTicketStatusFilter,
  viewMode,
  setViewMode,
  isLoadingTickets,
  loadTickets,
}) {
  const toast = useToast();
  return (
    <div className="atk-root">
      {/* Header Quản lý vé */}
      <div className="atk-header">
        <div>
          <div className="atk-badge">
            <Ticket size={14} /> Kiểm soát vé & Tra cứu đặt chỗ
          </div>
          <h1 className="atk-title">Quản lý Vé đã phát hành</h1>
          <p className="atk-sub">
            Tra cứu người mua theo tên, mã vé và lọc vé theo từng sự kiện hoặc tình trạng thanh
            toán.
          </p>
        </div>

        {/* Nút đếm và reload vé từ database */}
        <div className="atk-head-actions">
          <div className="atk-count-chip">
            <CheckCircle2 size={15} color="var(--accent-emerald)" />
            <span>
              Tổng vé: <strong className="atk-count-num">{ticketsList.length}</strong>
            </span>
          </div>
          <button
            onClick={loadTickets}
            disabled={isLoadingTickets}
            title="Tải lại danh sách vé từ Supabase"
            className="atk-reload-btn"
          >
            <RefreshCw size={13} className={isLoadingTickets ? 'spin' : ''} />
            {isLoadingTickets ? 'Đang đồng bộ...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Filter & Search Bar cho vé */}
      <div className="glass-panel atk-filter-panel">
        {/* Search theo tên khách, mã vé */}
        <div className="atk-search-box">
          <Search size={18} color="var(--text-dim)" className="atk-icon-fixed" />
          <input
            type="text"
            placeholder="Tìm theo Mã vé, Tên khách, SĐT..."
            value={ticketSearch}
            onChange={(e) => setTicketSearch(e.target.value)}
            className="atk-search-input"
          />
        </div>

        {/* Bộ lọc & Toggle View */}
        <div className="atk-tools">
          <div className="atk-filter-wrap">
            <span className="atk-filter-label">Sự kiện:</span>
            <select
              value={ticketEventFilter}
              onChange={(e) => setTicketEventFilter(e.target.value)}
              className="atk-filter-select atk-filter-select-event"
            >
              <option value="all">Tất cả sự kiện</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          <div className="atk-filter-wrap">
            <span className="atk-filter-label">Trạng thái:</span>
            <select
              value={ticketStatusFilter}
              onChange={(e) => setTicketStatusFilter(e.target.value)}
              className="atk-filter-select"
            >
              <option value="all">Tất cả</option>
              <option value="paid">Đã thanh toán</option>
              <option value="checked-in">Đã Check-in</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          {/* View Mode Toggle: Cards vs Table */}
          <div className="atk-view-toggle">
            <button
              onClick={() => setViewMode(viewMode === 'cards' ? 'auto' : 'cards')}
              className={`atk-toggle-btn${viewMode === 'cards' ? ' active' : ''}`}
              title="Hiển thị dạng thẻ (tối ưu không bị trượt ngang trên di động)"
            >
              <LayoutGrid size={14} />
              <span>Thẻ</span>
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'auto' : 'table')}
              className={`atk-toggle-btn${viewMode === 'table' ? ' active' : ''}`}
              title="Hiển thị dạng bảng dữ liệu đầy đủ"
            >
              <TableIcon size={14} />
              <span>Bảng</span>
            </button>
          </div>
        </div>
      </div>

      {/* DẠNG THẺ (CARDS) CHO VÉ - HOÀN TOÀN KHÔNG CÓ THANH TRƯỢT NGANG TRÊN MOBILE */}
      {(viewMode === 'cards' || viewMode === 'auto') && (
        <div className={`atk-cards-grid${viewMode === 'auto' ? ' admin-mobile-cards-auto' : ''}`}>
          {isLoadingTickets ? (
            <div className="glass-panel atk-empty">
              Đang tải dữ liệu vé từ hệ thống database Supabase...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="glass-panel atk-empty">
              Không tìm thấy vé nào phù hợp với điều kiện tìm kiếm.
            </div>
          ) : (
            filteredTickets.map((tk) => {
              const targetEvent = events.find((e) => e.id === tk.eventId);
              return (
                <div key={tk.id || tk.ticketCode} className="glass-panel atk-ticket-card">
                  {/* Hàng 1: Mã vé + Trạng thái */}
                  <div className="atk-card-row1">
                    <span className="atk-code-chip atk-code-chip-card">{tk.ticketCode}</span>

                    {tk.status === 'paid' && (
                      <span className="atk-status-badge atk-status-badge-card paid">
                        Đã thanh toán
                      </span>
                    )}
                    {tk.status === 'checked-in' && (
                      <span className="atk-status-badge atk-status-badge-card checked">
                        Đã Check-in
                      </span>
                    )}
                    {tk.status === 'cancelled' && (
                      <span className="atk-status-badge atk-status-badge-card cancelled">
                        Đã hủy
                      </span>
                    )}
                  </div>

                  {/* Tiêu đề Sự kiện */}
                  <div>
                    <div className="atk-card-ev-title">
                      {targetEvent ? targetEvent.title : tk.eventTitle || 'Sự kiện hệ thống'}
                    </div>
                    <div className="atk-card-ev-sub">
                      {targetEvent
                        ? `${targetEvent.date} • ${targetEvent.venue}`
                        : tk.purchaseDate || ''}
                    </div>
                  </div>

                  {/* Thông tin Khách hàng & Vị trí vé */}
                  <div className="atk-info-grid">
                    <div>
                      <div className="atk-info-label">
                        <User size={13} /> Khách hàng
                      </div>
                      <div className="atk-info-value">{tk.customerName || 'Khách hàng'}</div>
                      <div className="atk-info-sub">
                        {tk.customerPhone || tk.customerEmail || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="atk-info-label">
                        <Tag size={13} /> Hạng vé
                      </div>
                      <div className="atk-info-value-main">{tk.ticketType}</div>
                      <div className="atk-info-sub">{tk.purchaseDate}</div>
                    </div>
                  </div>

                  {/* Giá tiền & Nút Soát vé Check-in */}
                  <div className="atk-card-footer">
                    <div>
                      <div className="atk-total-label">Tổng tiền</div>
                      <div className="atk-total-value">{formatVND(tk.price)}</div>
                    </div>

                    {tk.status === 'paid' ? (
                      <button
                        onClick={() => {
                          setTicketsList((prev) =>
                            prev.map((t) =>
                              t.ticketCode === tk.ticketCode ? { ...t, status: 'checked-in' } : t,
                            ),
                          );
                          toast.success(`Đã Check-in thành công cho vé ${tk.ticketCode}!`);
                        }}
                        className="atk-checkin-btn atk-checkin-btn-card"
                      >
                        <CheckCircle2 size={16} /> Soát vé
                      </button>
                    ) : (
                      <span className="atk-done-chip">
                        {tk.status === 'checked-in' ? '✓ Đã hoàn tất' : 'Vô hiệu'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* DẠNG BẢNG (TABLE) CHO VÉ - HIỂN THỊ MẶC ĐỊNH TRÊN DESKTOP */}
      {(viewMode === 'table' || viewMode === 'auto') && (
        <div className={`atk-table-wrap${viewMode === 'auto' ? ' admin-desktop-table-auto' : ''}`}>
          <div className="glass-panel atk-table-panel">
            <div className="atk-table-scroll">
              <table className="atk-table">
                <thead>
                  <tr className="atk-thead-row">
                    <th className="atk-th atk-th-w150">MÃ VÉ</th>
                    <th className="atk-th atk-th-w260">SỰ KIỆN</th>
                    <th className="atk-th atk-th-w220">NGƯỜI MUA</th>
                    <th className="atk-th atk-th-w200">HẠNG VÉ / VỊ TRÍ</th>
                    <th className="atk-th atk-th-w140">GIÁ TIỀN</th>
                    <th className="atk-th atk-th-w150">TRẠNG THÁI</th>
                    <th className="atk-th atk-th-w110 atk-th-right">CHECK-IN</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingTickets ? (
                    <tr>
                      <td colSpan="7" className="atk-empty-cell">
                        Đang tải dữ liệu vé từ hệ thống database Supabase...
                      </td>
                    </tr>
                  ) : filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="atk-empty-cell">
                        Không tìm thấy vé nào phù hợp với điều kiện tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((tk) => {
                      const targetEvent = events.find((e) => e.id === tk.eventId);
                      return (
                        <tr key={tk.id || tk.ticketCode} className="atk-row">
                          {/* Mã vé */}
                          <td className="atk-cell">
                            <span className="atk-code-chip atk-code-chip-table">
                              {tk.ticketCode}
                            </span>
                          </td>

                          {/* Tên sự kiện */}
                          <td className="atk-cell">
                            <div className="atk-table-ev-title">
                              {targetEvent
                                ? targetEvent.title
                                : tk.eventTitle || 'Sự kiện hệ thống'}
                            </div>
                            <div className="atk-table-ev-sub">
                              {targetEvent
                                ? `${targetEvent.date} • ${targetEvent.venue}`
                                : tk.purchaseDate || ''}
                            </div>
                          </td>

                          {/* Người mua */}
                          <td className="atk-cell">
                            <div className="atk-buyer-name">{tk.customerName || 'Khách hàng'}</div>
                            <div className="atk-buyer-sub">
                              {tk.customerEmail || tk.customerPhone || 'N/A'}
                            </div>
                          </td>

                          {/* Hạng vé / vị trí */}
                          <td className="atk-cell">
                            <div className="atk-type-value">{tk.ticketType}</div>
                            <div className="atk-info-sub">{tk.purchaseDate}</div>
                          </td>

                          {/* Giá tiền */}
                          <td className="atk-cell">
                            <div className="atk-price-value">{formatVND(tk.price)}</div>
                          </td>

                          {/* Trạng thái */}
                          <td className="atk-cell">
                            {tk.status === 'paid' && (
                              <span className="atk-status-badge atk-status-badge-table paid">
                                Đã thanh toán
                              </span>
                            )}
                            {tk.status === 'checked-in' && (
                              <span className="atk-status-badge atk-status-badge-table checked">
                                Đã Check-in
                              </span>
                            )}
                            {tk.status === 'cancelled' && (
                              <span className="atk-status-badge atk-status-badge-table cancelled">
                                Đã hủy
                              </span>
                            )}
                          </td>

                          {/* Nút hành động Check-in */}
                          <td className="atk-cell atk-cell-right">
                            {tk.status === 'paid' ? (
                              <button
                                onClick={() => {
                                  setTicketsList((prev) =>
                                    prev.map((t) =>
                                      t.ticketCode === tk.ticketCode
                                        ? { ...t, status: 'checked-in' }
                                        : t,
                                    ),
                                  );
                                  toast.success(`Đã Check-in thành công cho vé ${tk.ticketCode}!`);
                                }}
                                className="atk-checkin-btn atk-checkin-btn-table"
                              >
                                Soát vé
                              </button>
                            ) : (
                              <span className="atk-done-text">
                                {tk.status === 'checked-in' ? 'Hoàn tất' : 'Vô hiệu'}
                              </span>
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
