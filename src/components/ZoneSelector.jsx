import { Minus, Plus } from 'lucide-react';
import { MAX_TICKETS_PER_ORDER } from '../data/events';
import { formatVND } from '../utils/format.js';
import './ZoneSelector.css';

// Khối chọn khu vực cho sự kiện Zone-based (tách từ EventDetailPage ở Phần 3d):
// danh sách khu vực + nút tăng/giảm số vé từng khu vực.
// CSS responsive của thẻ khu vực (.zone-item-*) nằm ở ZoneSelector.css.
export default function ZoneSelector({
  backendZones,
  zoneQuantities,
  zoneRemaining,
  totalZoneCount,
  isUpcoming,
  handleUpdateZoneQty,
}) {
  return (
    <div className={`zone-root${isUpcoming ? ' zone-root-upcoming' : ''}`}>
      <h3 className="zone-heading">Danh sách khu vực & Hạng vé</h3>
      <div className="zone-list">
        {Object.keys(backendZones).map((zoneName) => {
          const zone = backendZones[zoneName];
          const qty = zoneQuantities[zoneName] || 0;
          const remainingCount = zoneRemaining[zoneName] ?? zone.remaining;
          const isSoldOut = remainingCount === 0;

          return (
            <div key={zoneName} className={`zone-item-card${qty > 0 ? ' selected' : ''}`}>
              <div className="zone-item-info">
                <div className="zone-name-row">
                  <div className="zone-dot" style={{ '--zone-color': zone.color }} />
                  <h4 className="zone-name">{zone.name}</h4>
                </div>
                <p className="zone-desc">Khu vực vé đứng tự do - Sức chứa: {zone.total} vé</p>
                <div className="zone-meta">
                  <span className={`zone-remaining${isSoldOut ? ' sold-out' : ''}`}>
                    {`Còn lại: ${remainingCount} vé`}
                  </span>
                  <span className="zone-meta-dim">•</span>
                  <span className="zone-meta-dim">Tự động phân bổ ghế</span>
                </div>
              </div>

              <div className="zone-item-action">
                <div className="zone-price-wrap">
                  <div className="zone-price">{formatVND(zone.price)}</div>
                  <div className="zone-per">/ 1 vé</div>
                </div>

                <div className="zone-stepper">
                  <button
                    onClick={() => handleUpdateZoneQty(zoneName, -1)}
                    disabled={qty <= 0}
                    className={`zone-step-btn${qty > 0 ? ' active' : ''}`}
                  >
                    <Minus size={15} />
                  </button>

                  <span className="zone-qty">{qty}</span>

                  <button
                    onClick={() => handleUpdateZoneQty(zoneName, 1)}
                    disabled={
                      totalZoneCount >= MAX_TICKETS_PER_ORDER || qty >= remainingCount || isSoldOut
                    }
                    className={`zone-step-btn${totalZoneCount < 5 && qty < remainingCount && !isSoldOut ? ' active-accent' : ''}`}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="zone-footer">
        Tổng số vé đang chọn: <strong className="zone-footer-num">{totalZoneCount}</strong> / 5 vé
        tối đa
      </div>
    </div>
  );
}
