import { Plus, Trash2, Armchair, Layers, Check, X } from 'lucide-react';
import { CATEGORIES } from '../data/events';
import { formatVND } from '../utils/format.js';
import { getRowLetter } from '../utils/seatLayout.js';
import './EventFormModal.css';

export default function EventFormModal({
  editingEvent,
  formData,
  setFormData,
  setIsModalOpen,
  handleZoneChange,
  handleAddZone,
  handleRemoveZone,
  handleSubmitForm,
}) {
  return (
    <div className="efm-overlay">
      <div className="glass-panel animate-fade-in efm-panel">
        <div className="efm-head">
          <h2 className="efm-title">{editingEvent ? 'Chỉnh sửa sự kiện' : 'Thêm sự kiện mới'}</h2>
          <button onClick={() => setIsModalOpen(false)} className="efm-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmitForm} className="efm-form">
          {/* Tên sự kiện */}
          <div>
            <label className="efm-label">Tên sự kiện *</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Sky Tour Concert..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="efm-input"
            />
          </div>

          {/* Loại vé và Trạng thái */}
          <div className="efm-grid-2">
            <div>
              <label className="efm-label">Loại hình đặt vé *</label>
              <select
                value={
                  formData.event_type || (formData.type === 'seated' ? 'SEAT_BASED' : 'ZONE_BASED')
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    event_type: val,
                    type: val === 'SEAT_BASED' ? 'seated' : 'zone',
                  });
                }}
                className="efm-input"
              >
                <option value="SEAT_BASED">Seated-based</option>
                <option value="ZONE_BASED">Zone-based (Khu vực đứng/vé mở, max 5 vé)</option>
              </select>
            </div>
          </div>

          {/* Thể loại & Ban tổ chức */}
          <div className="efm-grid-2">
            <div>
              <label className="efm-label">Thể loại</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="efm-input"
              >
                {CATEGORIES.filter((c) => c !== 'Tất cả').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="efm-label">Ban tổ chức</label>
              <input
                type="text"
                placeholder="Tên đơn vị tổ chức..."
                value={formData.organizer}
                onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                className="efm-input"
              />
            </div>
          </div>

          {/* Ngày và Địa điểm */}
          <div className="efm-grid-2">
            <div>
              <label className="efm-label">Ngày diễn ra (Date / Start Time) *</label>
              <input
                type="text"
                required
                placeholder="VD: 15 Tháng 12, 2026"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="efm-input"
              />
            </div>

            <div>
              <label className="efm-label">Địa điểm tổ chức (Location) *</label>
              <input
                type="text"
                required
                placeholder="VD: SECC Quận 7, TP.HCM"
                value={formData.location || formData.venue}
                onChange={(e) =>
                  setFormData({ ...formData, venue: e.target.value, location: e.target.value })
                }
                className="efm-input"
              />
            </div>
          </div>

          {/* Cấu hình giá & Số ghế / Vé: Phân tách Seated-based vs Zone-based */}
          {formData.event_type === 'SEAT_BASED' || formData.type === 'seated' ? (
            <div className="efm-seat-box">
              <div className="efm-section-head">
                <div className="efm-section-head-left">
                  <Armchair size={18} color="var(--primary-light)" />
                  <span className="efm-section-title">Cấu hình Sơ đồ Ghế ngồi (Seated-based)</span>
                </div>
                <span className="efm-seat-badge">Đồng giá toàn bộ khán phòng</span>
              </div>

              <p className="efm-hint">
                💡 Nhập số hàng và số ghế mỗi hàng để tạo sơ đồ ghế ngồi tự động. Chuẩn thiết kế là
                12 ghế/hàng để hiển thị đồng nhất không bị cuộn ngang.
              </p>

              <div className="efm-grid-2">
                <div>
                  <label className="efm-label">Tên loại ghế *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Ghế tiêu chuẩn"
                    value={formData.seatTierName || 'Ghế tiêu chuẩn'}
                    onChange={(e) => setFormData({ ...formData, seatTierName: e.target.value })}
                    className="efm-input"
                  />
                </div>

                <div>
                  <label className="efm-label">Giá vé ghế ngồi (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    step="10000"
                    placeholder="VD: 500000"
                    value={
                      formData.seatPrice !== undefined && formData.seatPrice !== null
                        ? formData.seatPrice
                        : (formData.minPrice ?? 500000)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      const val = raw === '' ? '' : Number(raw);
                      const numVal = val === '' ? 0 : val;
                      setFormData({
                        ...formData,
                        seatPrice: val,
                        minPrice: numVal,
                        maxPrice: numVal,
                        min_price: `${numVal.toFixed(2)}`,
                        max_price: `${numVal.toFixed(2)}`,
                      });
                    }}
                    className="efm-input"
                  />
                </div>
              </div>

              {/* Nhập số ghế / hàng và tổng số ghế */}
              <div className="efm-grid-3">
                <div>
                  <label
                    className={`efm-label${(formData.rowsCount === '' || formData.rowsCount == null ? 0 : Number(formData.rowsCount)) < 1 ? ' efm-label-error' : ''}`}
                  >
                    Số hàng ghế (tối thiểu 1) *
                  </label>
                  <input
                    type="number"
                    placeholder="VD: 7"
                    value={
                      formData.rowsCount !== undefined && formData.rowsCount !== null
                        ? formData.rowsCount
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      const r = val === '' || val == null ? 0 : Number(val);
                      const s =
                        formData.seatsPerRow === '' || formData.seatsPerRow == null
                          ? 0
                          : Number(formData.seatsPerRow);
                      const calcTotal = (isNaN(r) ? 0 : r) * (isNaN(s) ? 0 : s);
                      setFormData({
                        ...formData,
                        rowsCount: val,
                        totalSeats: calcTotal,
                      });
                    }}
                    className={`efm-input efm-input-outline${(formData.rowsCount === '' || formData.rowsCount == null ? 0 : Number(formData.rowsCount)) < 1 ? ' efm-input-error' : ''}`}
                  />
                  {(formData.rowsCount === '' || formData.rowsCount == null
                    ? 0
                    : Number(formData.rowsCount)) < 1 ? (
                    <span className="efm-field-error">
                      ⚠️ Tối thiểu phải có 1 hàng ghế (hiện tại:{' '}
                      {formData.rowsCount === '' || formData.rowsCount == null
                        ? 0
                        : formData.rowsCount}
                      )
                    </span>
                  ) : (
                    <span className="efm-field-hint">
                      Hàng A đến {getRowLetter(Number(formData.rowsCount) - 1)} (
                      {formData.rowsCount} hàng)
                    </span>
                  )}
                </div>

                <div>
                  <label
                    className={`efm-label${(formData.seatsPerRow === '' || formData.seatsPerRow == null ? 0 : Number(formData.seatsPerRow)) < 1 ? ' efm-label-error' : ''}`}
                  >
                    Số ghế mỗi hàng (tối thiểu 1) *
                  </label>
                  <input
                    type="number"
                    placeholder="VD: 12"
                    value={
                      formData.seatsPerRow !== undefined && formData.seatsPerRow !== null
                        ? formData.seatsPerRow
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      const s = val === '' || val == null ? 0 : Number(val);
                      const r =
                        formData.rowsCount === '' || formData.rowsCount == null
                          ? 0
                          : Number(formData.rowsCount);
                      const calcTotal = (isNaN(r) ? 0 : r) * (isNaN(s) ? 0 : s);
                      setFormData({
                        ...formData,
                        seatsPerRow: val,
                        totalSeats: calcTotal,
                      });
                    }}
                    className={`efm-input efm-input-outline${(formData.seatsPerRow === '' || formData.seatsPerRow == null ? 0 : Number(formData.seatsPerRow)) < 1 ? ' efm-input-error' : ''}`}
                  />
                  {(formData.seatsPerRow === '' || formData.seatsPerRow == null
                    ? 0
                    : Number(formData.seatsPerRow)) < 1 ? (
                    <span className="efm-field-error">
                      ⚠️ 1 hàng phải có tối thiểu 1 ghế (hiện tại:{' '}
                      {formData.seatsPerRow === '' || formData.seatsPerRow == null
                        ? 0
                        : formData.seatsPerRow}
                      )
                    </span>
                  ) : (
                    <span className="efm-field-hint">Ghế số 1 đến {formData.seatsPerRow}</span>
                  )}
                </div>

                <div>
                  <label className="efm-label">Tổng số ghế phát hành *</label>
                  <input
                    type="number"
                    placeholder="VD: 84"
                    value={
                      formData.totalSeats !== undefined && formData.totalSeats !== null
                        ? formData.totalSeats
                        : 0
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        totalSeats: val === '' ? 0 : Number(val),
                      });
                    }}
                    className="efm-input efm-input-total"
                  />
                  <span className="efm-field-hint-pink">Tự động tính: (Số hàng × Số ghế)</span>
                </div>
              </div>

              <div className="efm-summary-bar">
                <span className="efm-summary-dim">
                  Quy mô dự kiến:{' '}
                  <strong className="efm-summary-strong">
                    {formData.totalSeats !== undefined && formData.totalSeats !== null
                      ? formData.totalSeats
                      : 0}{' '}
                    ghế ngồi
                  </strong>{' '}
                  (
                  {Number(formData.rowsCount) > 0
                    ? `${formData.rowsCount} hàng A-${getRowLetter(Number(formData.rowsCount) - 1)}`
                    : '0 hàng'}
                  ,{' '}
                  {Number(formData.seatsPerRow) > 0
                    ? `${formData.seatsPerRow} ghế/hàng`
                    : '0 ghế/hàng'}
                  )
                </span>
                <span className="efm-summary-price">
                  Giá bán: {formatVND(formData.seatPrice || formData.minPrice || 500000)} / vé
                </span>
              </div>
            </div>
          ) : (
            /* Cấu hình các khu vực & Số lượng vé cho Zone-based */
            <div className="efm-zone-box">
              <div className="efm-section-head">
                <div className="efm-section-head-left">
                  <Layers size={18} color="var(--accent-emerald)" />
                  <span className="efm-section-title">
                    Cấu hình Khu vực & Số lượng vé (Zone-based)
                  </span>
                </div>
                <button type="button" onClick={handleAddZone} className="efm-add-zone-btn">
                  <Plus size={14} /> Thêm khu vực
                </button>
              </div>

              <p className="efm-hint">
                💡 Nhập tên khu vực, số lượng vé (sức chứa) và giá vé tương ứng. Số lượng vé này sẽ
                đồng bộ trực tiếp lên trang chi tiết sự kiện.
              </p>

              <div className="efm-zones-list">
                {(formData.zones || []).map((z, idx) => (
                  <div key={z.id || idx} className="efm-zone-row">
                    <div>
                      <label className="efm-zone-label">Tên khu vực</label>
                      <input
                        type="text"
                        required
                        value={z.name}
                        onChange={(e) => handleZoneChange(idx, 'name', e.target.value)}
                        className="efm-zone-input"
                      />
                    </div>

                    <div>
                      <label
                        className={`efm-zone-label efm-zone-label-strong${(z.total === '' || z.total == null ? 0 : Number(z.total)) < 50 ? ' efm-label-error' : ''}`}
                      >
                        Số lượng vé (tối thiểu 50) *
                      </label>
                      <input
                        type="number"
                        placeholder="VD: 50"
                        value={z.total !== undefined && z.total !== null ? z.total : ''}
                        onChange={(e) => handleZoneChange(idx, 'total', e.target.value)}
                        className={`efm-zone-input efm-input-outline efm-zone-input-total${(z.total === '' || z.total == null ? 0 : Number(z.total)) < 50 ? ' efm-input-error' : ''}`}
                      />
                      {(z.total === '' || z.total == null ? 0 : Number(z.total)) < 50 ? (
                        <span className="efm-zone-error">
                          ⚠️ Tối thiểu 50 vé (hiện tại:{' '}
                          {z.total === '' || z.total == null ? 0 : z.total})
                        </span>
                      ) : (
                        <span className="efm-zone-hint">Sức chứa: {z.total} vé</span>
                      )}
                    </div>

                    <div>
                      <label className="efm-zone-label">Giá vé (VNĐ) *</label>
                      <input
                        type="number"
                        step="10000"
                        required
                        value={z.price}
                        onChange={(e) => handleZoneChange(idx, 'price', Number(e.target.value))}
                        className="efm-zone-input"
                      />
                    </div>

                    {(formData.zones || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveZone(idx)}
                        title="Xóa khu vực này"
                        className="efm-remove-zone-btn"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="efm-summary-bar">
                <span className="efm-summary-dim">
                  Tổng số vé phát hành:{' '}
                  <strong className="efm-summary-strong-emerald">
                    {(formData.zones || []).reduce(
                      (sum, z) =>
                        sum + (z.total === '' || z.total == null ? 0 : Number(z.total) || 0),
                      0,
                    )}{' '}
                    vé
                  </strong>
                </span>
                <span className="efm-summary-price">{(formData.zones || []).length} khu vực</span>
              </div>
            </div>
          )}

          {/* Ảnh URL */}
          <div>
            <label className="efm-label">Ảnh bìa sự kiện (Image URL)</label>
            <input
              type="text"
              value={formData.image}
              onChange={(e) =>
                setFormData({ ...formData, image: e.target.value, banner: e.target.value })
              }
              className="efm-input"
            />
          </div>

          {/* Mô tả */}
          <div>
            <label className="efm-label">Mô tả chi tiết sự kiện</label>
            <textarea
              rows="3"
              placeholder="Nội dung tóm tắt sự kiện..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="efm-input efm-textarea"
            />
          </div>

          {/* Actions */}
          <div className="efm-actions">
            <button type="button" onClick={() => setIsModalOpen(false)} className="efm-cancel-btn">
              Hủy
            </button>
            <button type="submit" className="glow-btn-primary efm-submit-btn">
              <Check size={16} /> Lưu sự kiện
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
