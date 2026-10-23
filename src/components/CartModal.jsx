import { ShoppingCart, X, Ticket, CheckCircle2, Calendar, MapPin } from 'lucide-react';
import './CartModal.css';
import { formatVND } from '../utils/format.js';

export default function CartModal({ isOpen, onClose, cart = [] }) {
  if (!isOpen) return null;

  const totalCartAmount = cart.reduce((acc, item) => acc + (item.totalPrice || 0), 0);

  return (
    <div onClick={onClose} className="cart-overlay">
      {/* Hộp Modal Giỏ hàng */}
      <div onClick={(e) => e.stopPropagation()} className="glass-panel animate-fade-in cart-panel">
        {/* Header Modal */}
        <div className="cart-header">
          <div className="cart-header-left">
            <div className="cart-header-icon">
              <ShoppingCart size={22} />
            </div>
            <div>
              <h3 className="cart-title">Giỏ hàng của bạn</h3>
              <div className="cart-subtitle">
                {cart.length > 0
                  ? `Đang có ${cart.length} đơn vé điện tử đã thanh toán`
                  : 'Chưa có vé nào'}
              </div>
            </div>
          </div>

          <button onClick={onClose} className="cart-close-btn">
            <X size={18} />
          </button>
        </div>

        {/* Nội dung danh sách vé */}
        <div className="cart-body">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty-icon">
                <Ticket size={32} />
              </div>
              <div className="cart-empty-title">Giỏ hàng trống</div>
              <p className="cart-empty-text">
                Bạn chưa có đơn vé nào. Hãy chọn sự kiện yêu thích và hoàn tất thanh toán để vé được
                lưu vào đây!
              </p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="cart-item">
                <div className="cart-item-top">
                  <div className="cart-item-main">
                    <div className="cart-item-title">{item.eventTitle}</div>
                    <div className="cart-item-meta">
                      <span className="cart-item-meta-entry">
                        <Calendar size={12} /> {item.eventDate}
                      </span>
                      <span className="cart-item-meta-entry">
                        <MapPin size={12} /> {item.eventVenue}
                      </span>
                    </div>
                  </div>
                  <span className="cart-paid-badge">
                    <CheckCircle2 size={12} /> Đã thanh toán
                  </span>
                </div>

                <div className="cart-code-box">
                  <div>
                    <span className="cart-code-label">Mã vé điện tử: </span>
                    <strong className="cart-code-value">{item.ticketCode}</strong>
                  </div>
                  <div className="cart-ticket-type">{item.ticketType}</div>
                </div>

                <div className="cart-item-footer">
                  <span className="cart-pay-info">
                    Thanh toán qua {item.paymentMethod?.toUpperCase() || 'VNPAY'} •{' '}
                    {item.purchaseDate}
                  </span>
                  <span className="cart-item-total">{formatVND(item.totalPrice)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Modal */}
        <div className="cart-footer">
          <div>
            <div className="cart-total-label">Tổng chi phí vé:</div>
            <div className="cart-total-value">{formatVND(totalCartAmount)}</div>
          </div>

          <button onClick={onClose} className="glow-btn-primary cart-close-cart-btn">
            Đóng giỏ hàng
          </button>
        </div>
      </div>
    </div>
  );
}
