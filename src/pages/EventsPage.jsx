import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  MapPin, 
  Tag, 
  SlidersHorizontal, 
  ArrowUpDown, 
  Sparkles, 
  Check, 
  RotateCcw,
  Armchair,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { 
  CATEGORIES, 
  CITIES, 
  formatEventDate, 
  formatEventTime,
  isSeatedEvent, 
  getEventVenue, 
  getMinPrice,
  isUpcomingEvent 
} from '../data/events';

export default function EventsPage({ events, onSelectEvent, isLoading = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [selectedCity, setSelectedCity] = useState('Tất cả địa điểm');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'seated' | 'zone'
  const [minPriceFilter, setMinPriceFilter] = useState(0); // Bộ lọc giá tối thiểu
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'price-asc' | 'price-desc'

  // State dropdown ẩn / hiện bộ lọc
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Format currency
  const formatVND = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  // Đếm số lượng bộ lọc đang được kích hoạt
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (minPriceFilter > 0) count++;
    if (selectedCategory !== 'Tất cả') count++;
    if (selectedCity !== 'Tất cả địa điểm') count++;
    if (typeFilter !== 'all') count++;
    return count;
  }, [minPriceFilter, selectedCategory, selectedCity, typeFilter]);

  // Filtered & Sorted events
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const isSeated = isSeatedEvent(ev);
      const evVenue = getEventVenue(ev);
      const evMinPrice = getMinPrice(ev);

      // Search
      const matchSearch = ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evVenue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      // Category
      if (selectedCategory !== 'Tất cả' && ev.category !== selectedCategory) return false;

      // City
      if (selectedCity !== 'Tất cả địa điểm' && !evVenue.includes(selectedCity)) return false;

      // Type (Seated / Zone)
      if (typeFilter === 'seated' && !isSeated) return false;
      if (typeFilter === 'zone' && isSeated) return false;

      // Min Price Filter
      if (minPriceFilter > 0 && evMinPrice < minPriceFilter) return false;

      return true;
    }).sort((a, b) => {
      const aPrice = getMinPrice(a);
      const bPrice = getMinPrice(b);
      if (sortBy === 'price-asc') return aPrice - bPrice;
      if (sortBy === 'price-desc') return bPrice - aPrice;
      return 0;
    });
  }, [events, searchQuery, selectedCategory, selectedCity, typeFilter, minPriceFilter, sortBy]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Tất cả');
    setSelectedCity('Tất cả địa điểm');
    setTypeFilter('all');
    setMinPriceFilter(0);
    setSortBy('default');
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'clamp(16px, 3.5vw, 32px) clamp(12px, 3vw, 24px)' }}>
      
      {/* Hero Banner Section */}
      <div style={{
        position: 'relative',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        marginBottom: 'clamp(20px, 3.5vw, 36px)',
        padding: 'clamp(24px, 5vw, 44px) clamp(16px, 4vw, 36px)',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(236, 72, 153, 0.15) 100%), #101623',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-subtle)'
      }}>
        <div style={{ maxWidth: '640px', position: 'relative', zIndex: 2 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(236, 72, 153, 0.18)',
            color: '#f472b6',
            fontSize: 'clamp(11px, 2.2vw, 13px)',
            fontWeight: 700,
            marginBottom: '14px',
            border: '1px solid rgba(236, 72, 153, 0.3)'
          }}>
            <Sparkles size={15} /> Vé Chính Hãng - Chọn Chỗ Thời Gian Thực
          </div>
          <h1 style={{ fontSize: 'clamp(22px, 4.2vw, 34px)', fontWeight: 800, lineHeight: 1.25, marginBottom: '12px', color: '#fff' }}>
            Đắm chìm vào các sự kiện âm nhạc & giải trí đỉnh cao
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(13px, 2.2vw, 15px)', marginBottom: '20px', lineHeight: 1.6 }}>
            Đặt vé giữ chỗ theo sơ đồ ghế hoặc chọn vé khu vực đứng tự do siêu nhanh chóng, an toàn và tiện lợi.
          </p>

          {/* Quick Search Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid var(--border-glow)',
            padding: '8px clamp(12px, 2.5vw, 16px)',
            borderRadius: 'var(--radius-full)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
          }}>
            <Search size={18} color="var(--primary-light)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Tìm kiếm sự kiện, nghệ sĩ, địa điểm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '14px'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', color: 'var(--text-dim)', fontSize: '13px', padding: '2px 6px' }}
              >
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TOP CONTROLS: BẤM NÚT BỘ LỌC ĐỂ DROPDOWN XUỐNG & SẮP XẾP */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Nút Trigger Dropdown Bộ lọc */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isFilterDropdownOpen ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '14px',
              border: isFilterDropdownOpen ? '1px solid var(--primary-light)' : '1px solid var(--border-color)',
              boxShadow: isFilterDropdownOpen ? '0 4px 15px var(--primary-glow)' : 'none',
              transition: 'var(--transition)'
            }}
          >
            <Filter size={16} />
            <span>Bộ lọc tìm kiếm</span>
            {activeFiltersCount > 0 && (
              <span style={{
                backgroundColor: 'var(--accent-pink)',
                color: '#fff',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800
              }}>
                {activeFiltersCount}
              </span>
            )}
            {isFilterDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                background: 'none'
              }}
            >
              <RotateCcw size={14} /> Xóa bộ lọc ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Thông tin số lượng & Sắp xếp */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Tìm thấy <strong style={{ color: 'var(--primary-light)' }}>{filteredEvents.length}</strong> sự kiện
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpDown size={15} color="var(--text-dim)" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                fontSize: '13px'
              }}
            >
              <option value="default" style={{ background: '#101623' }}>Sắp xếp: Mặc định</option>
              <option value="price-asc" style={{ background: '#101623' }}>Giá vé: Thấp đến cao</option>
              <option value="price-desc" style={{ background: '#101623' }}>Giá vé: Cao đến thấp</option>
            </select>
          </div>
        </div>
      </div>

      {/* DROPDOWN FILTER PANEL (ẨN/HIỆN KHI BẤM NÚT) */}
      {isFilterDropdownOpen && (
        <div className="glass-panel animate-fade-in" style={{
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          marginBottom: '32px',
          border: '1px solid var(--border-glow)',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '16px', color: '#fff' }}>
              <SlidersHorizontal size={18} color="var(--primary-light)" />
              <span>Tùy chỉnh tiêu chí lọc sự kiện</span>
            </div>
            <button
              onClick={() => setIsFilterDropdownOpen(false)}
              style={{ background: 'none', color: 'var(--text-dim)', padding: '4px' }}
              title="Đóng bộ lọc"
            >
              <X size={18} />
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
            gap: 'clamp(16px, 3vw, 24px)'
          }}>
            {/* 1. Bộ lọc Giá vé tối thiểu (Slider + Pills) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                  Giá vé tối thiểu:
                </label>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-pink)' }}>
                  {minPriceFilter === 0 ? 'Tất cả mức giá' : `>= ${formatVND(minPriceFilter)}`}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="3000000"
                step="200000"
                value={minPriceFilter}
                onChange={(e) => setMinPriceFilter(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--accent-pink)',
                  cursor: 'pointer',
                  marginBottom: '8px'
                }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[0, 500000, 1000000, 2000000].map(p => (
                  <button
                    key={p}
                    onClick={() => setMinPriceFilter(p)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: minPriceFilter === p ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                      color: minPriceFilter === p ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {p === 0 ? 'Mọi giá' : `≥ ${p / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Loại hình đặt vé: Seated-based vs Zone-based */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
                Loại hình vé
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { id: 'all', label: 'Tất cả hình thức', icon: null },
                  { id: 'seated', label: 'Ghế ngồi (Seated-based, max 5 ghế)', icon: <Armchair size={14} /> },
                  { id: 'zone', label: 'Khu vực (Zone-based, max 5 vé)', icon: <Layers size={14} /> }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setTypeFilter(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: typeFilter === item.id ? 600 : 400,
                      backgroundColor: typeFilter === item.id ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      color: typeFilter === item.id ? 'var(--accent-pink)' : 'var(--text-muted)',
                      border: typeFilter === item.id ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid transparent',
                      textAlign: 'left'
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>



            {/* 4. Thể loại & Địa điểm */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
                Thể loại & Địa điểm
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '11px',
                      backgroundColor: selectedCategory === cat ? 'var(--bg-tertiary)' : 'rgba(255, 255, 255, 0.04)',
                      color: selectedCategory === cat ? '#fff' : 'var(--text-dim)',
                      border: selectedCategory === cat ? '1px solid var(--border-glow)' : '1px solid var(--border-color)'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  fontSize: '12px'
                }}
              >
                {CITIES.map(c => (
                  <option key={c} value={c} style={{ background: '#101623' }}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* EVENT LISTING GRID */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{
            display: 'inline-block',
            animation: 'spin 1s linear infinite',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--primary-light)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            marginBottom: '16px'
          }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
            Đang tải danh sách sự kiện...
          </div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-panel" style={{
          padding: '60px 20px',
          textAlign: 'center',
          borderRadius: 'var(--radius-lg)'
        }}>
          <Calendar size={48} color="var(--text-dim)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
            Không tìm thấy sự kiện phù hợp
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
            Hãy thử điều chỉnh mức giá vé tối thiểu hoặc từ khóa tìm kiếm của bạn.
          </p>
          <button
            onClick={handleResetFilters}
            className="glow-btn-primary"
            style={{ padding: '8px 18px', fontSize: '13px' }}
          >
            Xem tất cả sự kiện
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          gap: 'clamp(16px, 2.5vw, 24px)'
        }}>
          {filteredEvents.map(event => (
            <div
              key={event.id}
              onClick={() => onSelectEvent(event)}
              className="glass-panel"
              style={{
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'var(--border-glow)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              {/* Thumbnail & Badges */}
              <div style={{ position: 'relative', width: '100%', height: 'clamp(170px, 25vw, 200px)', overflow: 'hidden' }}>
                <img
                  src={event.image}
                  alt={event.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.5s ease'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(10, 13, 20, 0.9) 0%, transparent 60%)'
                }} />



                {/* Status Badge (Upcoming) */}
                {isUpcomingEvent(event) && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px'
                  }}>
                    <span className="badge-status-upcoming" style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '11px',
                      fontWeight: 700
                    }}>
                      Sắp diễn ra
                    </span>
                  </div>
                )}

                {/* Type Badge */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px'
                }}>
                  {(() => {
                    const isSeated = isSeatedEvent(event);
                    return (
                      <span className={isSeated ? 'badge-type-seated' : 'badge-type-zone'} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 12px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.3px'
                      }}>
                        {isSeated ? <Armchair size={13} /> : <Layers size={13} />}
                        {isSeated ? 'Seated-based' : 'Zone-based'}
                      </span>
                    );
                  })()}
                </div>

                {/* Category */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  backgroundColor: 'rgba(10, 13, 20, 0.92)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#fff'
                }}>
                  {event.category}
                </div>
              </div>

              {/* Body Content */}
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    lineHeight: 1.35,
                    marginBottom: '12px',
                    color: '#fff',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {event.title}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={15} color="var(--primary-light)" />
                      <span>{formatEventDate(event)} • {formatEventTime(event) || event.time}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={15} color="var(--accent-pink)" />
                      <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>{getEventVenue(event)}</span>
                    </div>
                  </div>
                </div>

                {/* Price and CTA */}
                <div style={{
                  paddingTop: '14px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                      {isSeatedEvent(event) ? 'Đồng giá' : 'Giá chỉ từ'}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-pink)' }}>
                      {formatVND(getMinPrice(event))}
                    </div>
                  </div>

                  <button
                    className={isSeatedEvent(event) ? 'glow-btn-primary' : 'glow-btn-pink'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    {isUpcomingEvent(event) ? 'Xem chi tiết' : 'Đặt vé ngay'}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
