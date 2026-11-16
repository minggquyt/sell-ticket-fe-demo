import { useState } from 'react';
import { X, QrCode, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { buildVietQrUrl } from '../services/eventService';
import { formatVND } from '../utils/format.js';
import './RefundQrModal.css';

export default function RefundQrModal({ isOpen, order, onConfirm, onMarkError, onClose }) {
  const [note, setNote] = useState('');
  const [errorReason, setErrorReason] = useState('');
  const [showErrorForm, setShowErrorForm] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [marking, setMarking] = useState(false);

  if (!isOpen || !order) return null;

  const copyText = (text) => {
    navigator.clipboard?.writeText(text);
  };

  // Chế độ xem Bằng chứng đối soát (Snapshot đã đóng băng khi đơn đã REFUNDED)
  if (order.status === 'REFUNDED' && order.refundSnapshot) {
    const snap = order.refundSnapshot;
    const refundedTime = snap.refundedAt
      ? new Date(snap.refundedAt).toLocaleString('vi-VN')
      : '—';

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="rqm-modal" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="rqm-close" title="Đóng">
            <X size={20} />
          </button>

          <div className="rqm-header">
            <CheckCircle2 size={24} color="#22c55e" />
            <div>
              <h2 className="rqm-title">Bằng chứng đối soát đơn #{order.orderCode}</h2>
              <p className="rqm-subtitle">
                Khách: {order.customerName} ({order.customerEmail}) — Đóng băng tại thời điểm hoàn tiền
              </p>
            </div>
          </div>

          <div className="rqm-info-col" style={{ marginTop: 8 }}>
            <div className="rqm-info-row">
              <span className="rqm-info-label">Ngân hàng nhận:</span>
              <span className="rqm-info-value">
                {snap.bankShortName} {snap.bankName ? `(${snap.bankName})` : ''}
              </span>
            </div>
            <div className="rqm-info-row">
              <span className="rqm-info-label">Số tài khoản nhận:</span>
              <span className="rqm-info-value">
                {snap.bankAccountNo}
                <button
                  type="button"
                  onClick={() => copyText(snap.bankAccountNo)}
                  className="rqm-copy-btn"
                  title="Copy"
                >
                  <Copy size={13} />
                </button>
              </span>
            </div>
            <div className="rqm-info-row rqm-info-highlight">
              <span className="rqm-info-label">Tên chủ tài khoản:</span>
              <span className="rqm-info-value rqm-info-name">{snap.bankAccountName}</span>
            </div>
            <div className="rqm-info-row">
              <span className="rqm-info-label">Số tiền đã hoàn:</span>
              <span className="rqm-info-value" style={{ color: '#22c55e', fontWeight: 700 }}>
                {formatVND(Number(snap.amount ?? order.totalAmount) || 0)}
              </span>
            </div>
            <div className="rqm-info-row">
              <span className="rqm-info-label">Mã GD / Ghi chú:</span>
              <span className="rqm-info-value">{snap.note || 'Không có ghi chú'}</span>
            </div>
            <div className="rqm-info-row">
              <span className="rqm-info-label">Admin thực hiện:</span>
              <span className="rqm-info-value">{snap.refundedBy || 'Admin'}</span>
            </div>
            <div className="rqm-info-row">
              <span className="rqm-info-label">Thời gian xác nhận:</span>
              <span className="rqm-info-value">{refundedTime}</span>
            </div>
          </div>

          <div className="rqm-actions">
            <button type="button" onClick={onClose} className="modal-btn modal-btn-cancel">
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bank = order.refundBank;
  if (!bank) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="rqm-modal" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="rqm-close" title="Đóng">
            <X size={20} />
          </button>
          <div className="rqm-error-state">
            <AlertTriangle size={32} color="#fbbf24" />
            <h3>Khách chưa cập nhật TK ngân hàng</h3>
            <p>Không thể hoàn tiền vì khách hàng chưa điền thông tin tài khoản ngân hàng.</p>
          </div>
        </div>
      </div>
    );
  }

  const qrUrl = buildVietQrUrl(
    { bankBin: bank.bankBin, bankAccountNo: bank.bankAccountNo, bankAccountName: bank.bankAccountName },
    order.totalAmount,
    `HOAN TIEN ${order.orderCode}`,
  );

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm({
        bankBin: bank.bankBin,
        bankAccountNo: bank.bankAccountNo,
        bankAccountName: bank.bankAccountName,
        note: note.trim(),
      });
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  const handleMarkError = async () => {
    if (errorReason.trim().length < 3) return;
    setMarking(true);
    try {
      await onMarkError(errorReason.trim());
      onClose();
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="rqm-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="rqm-close" title="Đóng">
          <X size={20} />
        </button>

        <div className="rqm-header">
          <QrCode size={24} color="var(--accent-amber)" />
          <div>
            <h2 className="rqm-title">Quét QR hoàn tiền đơn #{order.orderCode}</h2>
            <p className="rqm-subtitle">
              Khách: {order.customerName} ({order.customerEmail})
            </p>
          </div>
        </div>

        <div className="rqm-body">
          <div className="rqm-qr-col">
            <img src={qrUrl} alt="VietQR" className="rqm-qr-img" />
            <div className="rqm-amount">{formatVND(Number(order.totalAmount) || 0)}</div>
            <div className="rqm-content">Nội dung: HOAN TIEN {order.orderCode}</div>
          </div>

          <div className="rqm-info-col">
            <h3 className="rqm-info-title">
              <CheckCircle2 size={16} /> Thông tin đối chiếu
            </h3>
            <div className="rqm-info-row">
              <span className="rqm-info-label">Ngân hàng:</span>
              <span className="rqm-info-value">
                {bank.bankLogo && <img src={bank.bankLogo} alt="" className="rqm-bank-logo" />}
                {bank.bankShortName}
              </span>
            </div>
            <div className="rqm-info-row">
              <span className="rqm-info-label">Số tài khoản:</span>
              <span className="rqm-info-value">
                {bank.bankAccountNo}
                <button
                  type="button"
                  onClick={() => copyText(bank.bankAccountNo)}
                  className="rqm-copy-btn"
                  title="Copy"
                >
                  <Copy size={13} />
                </button>
              </span>
            </div>
            <div className="rqm-info-row rqm-info-highlight">
              <span className="rqm-info-label">
                Tên chủ TK<br />(kiểm tra trên điện thoại):
              </span>
              <span className="rqm-info-value rqm-info-name">{bank.bankAccountName}</span>
            </div>

            <div className="modal-field" style={{ marginTop: 16 }}>
              <label className="modal-label" htmlFor="rqm-note">
                Mã giao dịch / Ghi chú đối soát (tùy chọn)
              </label>
              <input
                id="rqm-note"
                type="text"
                className="modal-input"
                placeholder="Ví dụ: FT26110923456789"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 255))}
                maxLength={255}
              />
            </div>
          </div>
        </div>

        {showErrorForm ? (
          <div className="rqm-error-form">
            <h3 className="rqm-error-title">
              <AlertTriangle size={16} /> Báo sai thông tin tài khoản
            </h3>
            <p className="rqm-error-hint">
              Quét QR thấy STK không tồn tại hoặc Tên trên điện thoại không khớp? Nhập lý do để
              thông báo khách vào Hồ sơ sửa lại.
            </p>
            <textarea
              className="modal-input rqm-error-textarea"
              placeholder="Ví dụ: Số tài khoản không tồn tại"
              value={errorReason}
              onChange={(e) => setErrorReason(e.target.value.slice(0, 255))}
              rows={2}
              maxLength={255}
            />
            <div className="rqm-error-actions">
              <button
                type="button"
                onClick={() => setShowErrorForm(false)}
                className="modal-btn modal-btn-cancel"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleMarkError}
                disabled={marking || errorReason.trim().length < 3}
                className="modal-btn rqm-btn-error"
              >
                {marking ? 'Đang lưu...' : 'Xác nhận báo sai TK'}
              </button>
            </div>
          </div>
        ) : (
          <div className="rqm-actions">
            <button
              type="button"
              onClick={() => setShowErrorForm(true)}
              className="modal-btn rqm-btn-error-trigger"
            >
              <AlertTriangle size={15} /> Báo sai thông tin TK
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="modal-btn rqm-btn-confirm"
            >
              <CheckCircle2 size={15} />
              {confirming ? 'Đang lưu...' : 'Xác nhận đã hoàn tiền'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
