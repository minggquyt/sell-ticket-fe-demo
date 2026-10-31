import React, { useState } from 'react';
import './CustomerInfoModal.css'; 

export default function CustomerInfoModal({ isOpen, onClose, onSubmit }) {
  const [phone, setPhone] = useState('');
  const [citizenId, setCitizenId] = useState('');

  if (!isOpen) return null;

  const normalizePhone = (value) => value.replace(/\s+/g, '').trim();
  const normalizeCitizenId = (value) => value.replace(/\D/g, '').slice(0, 12);

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanPhone = normalizePhone(phone);
    const cleanCitizenId = normalizeCitizenId(citizenId);

    if (!cleanPhone || !cleanCitizenId) {
      alert('⚠️ Vui lòng nhập đầy đủ số điện thoại và số CCCD!');
      return;
    }

    if (!/^(0|\+84)\d{9,10}$/.test(cleanPhone)) {
      alert('⚠️ Số điện thoại không hợp lệ. Ví dụ: 0901234567 hoặc +84901234567');
      return;
    }

    if (!/^\d{12}$/.test(cleanCitizenId)) {
      alert('⚠️ CCCD không hợp lệ. Vui lòng nhập đúng 12 chữ số.');
      return;
    }

    onSubmit({ phone: cleanPhone, citizenId: cleanCitizenId });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h3 className="modal-title">📋 Thông tin nhận vé</h3>
        <p className="modal-desc">
          Vui lòng nhập số điện thoại và số CCCD của người sử dụng vé để hoàn tất hóa đơn thanh toán.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label">Số điện thoại liên hệ *</label>
            <input
              type="tel"
              required
              placeholder="Ví dụ: 0912345678"
              value={phone}
              onChange={(e) => setPhone(normalizePhone(e.target.value))}
              className="modal-input"
              inputMode="tel"
              maxLength={12}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">Số CCCD / CMND *</label>
            <input
              type="text"
              required
              placeholder="Nhập 12 chữ số CCCD"
              value={citizenId}
              onChange={(e) => setCitizenId(normalizeCitizenId(e.target.value))}
              className="modal-input"
              inputMode="numeric"
              maxLength={12}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="modal-btn modal-btn-cancel"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn-submit"
            >
              Tiếp tục thanh toán
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}