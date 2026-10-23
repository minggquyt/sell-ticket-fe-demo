import { Shield } from 'lucide-react';
import './Footer.css';

// Chân trang toàn cục (tách từ App.jsx ở Phần 3a; toàn bộ style tĩnh nằm ở Footer.css)
export default function Footer({ onNavigate }) {
  return (
    <footer className="app-footer">
      <div className="app-footer-grid">
        <div>
          <h4 className="app-footer-logo">
            Ticket<span className="app-footer-logo-accent">Verse</span>
          </h4>
          <p className="app-footer-desc">
            Nền tảng phân phối vé sự kiện và nhạc hội trực tuyến hàng đầu. Đảm bảo 100% vé chính
            hãng và trải nghiệm đặt vé mượt mà nhất.
          </p>
        </div>

        <div>
          <h5 className="app-footer-heading">Khám phá</h5>
          <ul className="app-footer-list">
            <li className="app-footer-link" onClick={() => onNavigate('events')}>
              Nhạc hội & Concert
            </li>
            <li className="app-footer-link" onClick={() => onNavigate('events')}>
              Lễ hội âm nhạc EDM
            </li>
            <li className="app-footer-link" onClick={() => onNavigate('events')}>
              Fan Meeting
            </li>
            <li className="app-footer-link" onClick={() => onNavigate('events')}>
              Khu vực & Sơ đồ ghế
            </li>
          </ul>
        </div>

        <div>
          <h5 className="app-footer-heading">Dành cho ban tổ chức</h5>
          <ul className="app-footer-list">
            <li>Hợp tác phân phối vé</li>
            <li>Giải pháp Check-in QR bảo mật</li>
            <li>Quản lý phân khu thời gian thực</li>
            <li>Báo cáo doanh thu & đối soát</li>
          </ul>
        </div>

        <div>
          <h5 className="app-footer-heading">Hỗ trợ khách hàng</h5>
          <div className="app-footer-support">
            <div>Hotline: 1900 6868 (8:00 - 22:00)</div>
            <div>Email: support@ticketverse.vn</div>
            <div className="app-footer-secure">
              <Shield size={14} /> Bảo mật giao dịch 100%
            </div>
          </div>
        </div>
      </div>

      <div className="app-footer-bottom">
        <div>© 2026 TicketVerse Inc. All rights reserved.</div>
        <div className="app-footer-bottom-links">
          <span>Điều khoản sử dụng</span>
          <span>Chính sách bảo mật</span>
          <span>Quy định hoàn hủy vé</span>
        </div>
      </div>
    </footer>
  );
}
