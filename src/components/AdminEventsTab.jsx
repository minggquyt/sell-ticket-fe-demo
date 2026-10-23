import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Armchair,
  Layers,
  Eye,
  SlidersHorizontal,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import {
  formatEventDate,
  isSeatedEvent,
  getEventVenue,
  getMinPrice,
  getMaxPrice,
} from '../data/events';
import { formatVND } from '../utils/format.js';
import EventCard from './EventCard.jsx';
import './AdminEventsTab.css';

// Tab Quản lý sự kiện của trang quản trị (tách từ AdminPage ở Phần 3c):
// header + bộ lọc + danh sách sự kiện ở 2 chế độ thẻ / bảng do viewMode quyết định.
export default function AdminEventsTab({
  events,
  filteredEvents,
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  viewMode,
  setViewMode,
  handleOpenAddModal,
  handleOpenEditModal,
  setDeleteConfirmId,
  onViewEvent,
}) {
  return (
    <div className="aev-root">
      {/* Header Quản lý sự kiện */}
      <div className="aev-header">
        <div>
          <div className="aev-badge">
            <SlidersHorizontal size={14} /> Quản lý danh mục sự kiện & bán vé
          </div>
          <h1 className="aev-title">Danh sách Sự kiện (CRUD)</h1>
          <p className="aev-sub">
            Thêm mới, sửa thông tin, cấu hình Seated/Zone và xóa các sự kiện trong hệ thống.
          </p>
        </div>

        <button onClick={handleOpenAddModal} className="glow-btn-primary aev-add-btn">
          <Plus size={17} /> Thêm sự kiện mới
        </button>
      </div>

      {/* Bộ lọc & Tìm kiếm sự kiện */}
      <div className="glass-panel aev-filter-panel">
        {/* Tìm kiếm */}
        <div className="aev-search-box">
          <Search size={18} color="var(--text-dim)" className="aev-icon-fixed" />
          <input
            type="text"
            placeholder="Tìm tên sự kiện, địa điểm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="aev-search-input"
          />
        </div>

        {/* Loại vé Filter & Toggle Chế độ xem */}
        <div className="aev-tools">
          <div className="aev-type-wrap">
            <span className="aev-type-label">Loại vé:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="aev-type-select"
            >
              <option value="all">Tất cả ({events.length})</option>
              <option value="seated">
                Seated-based ({events.filter((e) => isSeatedEvent(e)).length})
              </option>
              <option value="zone">
                Zone-based ({events.filter((e) => !isSeatedEvent(e)).length})
              </option>
            </select>
          </div>

          {/* View Mode Toggle: Cards vs Table */}
          <div className="aev-view-toggle">
            <button
              onClick={() => setViewMode(viewMode === 'cards' ? 'auto' : 'cards')}
              className={`aev-toggle-btn${viewMode === 'cards' ? ' active' : ''}`}
              title="Hiển thị dạng thẻ (tối ưu không bị trượt ngang trên di động)"
            >
              <LayoutGrid size={14} />
              <span>Thẻ</span>
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'auto' : 'table')}
              className={`aev-toggle-btn${viewMode === 'table' ? ' active' : ''}`}
              title="Hiển thị dạng bảng dữ liệu đầy đủ"
            >
              <TableIcon size={14} />
              <span>Bảng</span>
            </button>
          </div>
        </div>
      </div>

      {/* DẠNG THẺ (CARDS) CHO SỰ KIỆN - HOÀN TOÀN KHÔNG CÓ THANH TRƯỢT NGANG TRÊN MOBILE */}
      {(viewMode === 'cards' || viewMode === 'auto') && (
        <div className={`aev-cards-grid${viewMode === 'auto' ? ' admin-mobile-cards-auto' : ''}`}>
          {filteredEvents.length === 0 ? (
            <div className="glass-panel aev-empty">Không có sự kiện nào phù hợp với bộ lọc.</div>
          ) : (
            filteredEvents.map((ev) => (
              <EventCard
                key={ev.id}
                variant="admin"
                event={ev}
                onView={onViewEvent}
                onEdit={handleOpenEditModal}
                onDelete={(e) => setDeleteConfirmId(e.id)}
              />
            ))
          )}
        </div>
      )}

      {/* DẠNG BẢNG (TABLE) CHO SỰ KIỆN - HIỂN THỊ MẶC ĐỊNH TRÊN DESKTOP */}
      {(viewMode === 'table' || viewMode === 'auto') && (
        <div className={`aev-table-wrap${viewMode === 'auto' ? ' admin-desktop-table-auto' : ''}`}>
          <div className="glass-panel aev-table-panel">
            <div className="aev-table-scroll">
              <table className="aev-table">
                <thead>
                  <tr className="aev-thead-row">
                    <th className="aev-th aev-th-w320">SỰ KIỆN</th>
                    <th className="aev-th aev-th-w150">LOẠI VÉ</th>
                    <th className="aev-th aev-th-w220">NGÀY & ĐỊA ĐIỂM</th>
                    <th className="aev-th aev-th-w180">GIÁ TỐI THIỂU</th>
                    <th className="aev-th aev-th-w140 aev-th-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="aev-empty-cell">
                        Không có sự kiện nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((ev) => (
                      <tr key={ev.id} className="aev-row">
                        {/* Tên & ảnh */}
                        <td className="aev-cell">
                          <div className="aev-name-wrap">
                            <img src={ev.image} alt={ev.title} className="aev-thumb" />
                            <div>
                              <div className="aev-ev-title">{ev.title}</div>
                              <span className="aev-category">{ev.category}</span>
                            </div>
                          </div>
                        </td>

                        {/* Loại vé badge */}
                        <td className="aev-cell aev-cell-nowrap">
                          {(() => {
                            const isSeated = isSeatedEvent(ev);
                            return (
                              <span
                                className={`aev-type-badge ${isSeated ? 'badge-type-seated' : 'badge-type-zone'}`}
                              >
                                {isSeated ? <Armchair size={13} /> : <Layers size={13} />}
                                {isSeated ? 'Seated-based' : 'Zone-based'}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Ngày & Địa điểm */}
                        <td className="aev-cell">
                          <div className="aev-date">{formatEventDate(ev)}</div>
                          <div className="aev-venue">{getEventVenue(ev)}</div>
                        </td>

                        {/* Giá vé */}
                        <td className="aev-cell">
                          {isSeatedEvent(ev) ? (
                            <div>
                              <div className="aev-price">{formatVND(getMinPrice(ev))}</div>
                              <div className="aev-price-sub-indigo">Đồng giá</div>
                            </div>
                          ) : (
                            <div>
                              <div className="aev-price">{formatVND(getMinPrice(ev))}</div>
                              <div className="aev-price-sub-dim">
                                đến {formatVND(getMaxPrice(ev))}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Thao tác CRUD */}
                        <td className="aev-cell aev-cell-right">
                          <div className="aev-actions">
                            <button
                              onClick={() => onViewEvent && onViewEvent(ev)}
                              title="Xem trang chi tiết khán giả"
                              className="aev-action-btn aev-action-view"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(ev)}
                              title="Chỉnh sửa thông tin sự kiện"
                              className="aev-action-btn aev-action-edit"
                            >
                              <Edit3 size={16} />
                            </button>

                            <button
                              onClick={() => setDeleteConfirmId(ev.id)}
                              title="Xóa sự kiện"
                              className="aev-action-btn aev-action-delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
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
