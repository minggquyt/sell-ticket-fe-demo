import { Mail, User, Phone, Info } from 'lucide-react';
import './GuestCheckoutForm.css';

// Form thông tin nhận vé cho khách mua vé KHÔNG cần đăng nhập (guest checkout).
// Chỉ thu thập email + họ tên (+ SĐT tuỳ chọn) để BE gắn hoá đơn và gửi vé.
// Không tạo tài khoản ở đây: BE sẽ khớp/tạo user (password null) SAU KHI
// thanh toán thành công. Form do EventDetailPage giữ state, truyền xuống.
export default function GuestCheckoutForm({ guest, onGuestChange, disabled, errors = {} }) {
  const update = (field, value) => {
    if (onGuestChange) onGuestChange({ ...guest, [field]: value });
  };

  if (disabled) {
    return (
      <div className="guest-form guest-form-locked">
        <div className="guest-form-title">
          <Mail size={15} className="guest-form-title-icon" />
          <span>Thông tin nhận vé</span>
        </div>
        <p className="guest-form-note">
          Vé điện tử sẽ gửi về <strong>{guest.email}</strong>
          {guest.fullName ? ` (${guest.fullName})` : ''}. Muốn đổi email thì hủy giữ chỗ rồi
          chọn lại.
        </p>
      </div>
    );
  }

  return (
    <div className="guest-form">
      <div className="guest-form-title">
        <Mail size={15} className="guest-form-title-icon" />
        <span>Thông tin nhận vé — không cần đăng nhập</span>
      </div>

      <div className="guest-field">
        <label className="guest-label" htmlFor="guest-email">
          Email nhận vé *
        </label>
        <div className={`guest-input-wrap${errors.email ? ' has-error' : ''}`}>
          <Mail size={16} className="guest-input-icon" />
          <input
            id="guest-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={guest.email || ''}
            onChange={(e) => update('email', e.target.value)}
            className="guest-input"
          />
        </div>
        {errors.email && <p className="guest-error">{errors.email}</p>}
      </div>

      <div className="guest-field">
        <label className="guest-label" htmlFor="guest-fullname">
          Họ và tên *
        </label>
        <div className={`guest-input-wrap${errors.fullName ? ' has-error' : ''}`}>
          <User size={16} className="guest-input-icon" />
          <input
            id="guest-fullname"
            type="text"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            value={guest.fullName || ''}
            onChange={(e) => update('fullName', e.target.value)}
            className="guest-input"
          />
        </div>
        {errors.fullName && <p className="guest-error">{errors.fullName}</p>}
      </div>

      <div className="guest-field guest-field-last">
        <label className="guest-label" htmlFor="guest-phone">
          Số điện thoại <span className="guest-optional">(tuỳ chọn)</span>
        </label>
        <div className="guest-input-wrap">
          <Phone size={16} className="guest-input-icon" />
          <input
            id="guest-phone"
            type="tel"
            autoComplete="tel"
            placeholder="0900 000 000"
            value={guest.phone || ''}
            onChange={(e) => update('phone', e.target.value)}
            className="guest-input"
          />
        </div>
      </div>

      <p className="guest-form-note">
        <Info size={13} className="guest-note-icon" />
        Vé điện tử gửi về email trên. Sau này đăng ký bằng đúng email này để xem lại vé đã mua.
      </p>
    </div>
  );
}
