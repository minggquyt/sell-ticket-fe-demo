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
import { CATEGORIES, CITIES } from '../data/events';

export default function EventsPage({ events, onSelectEvent }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [selectedCity, setSelectedCity] = useState('Tất cả địa điểm');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'ongoing' | 'upcoming'
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
    if (statusFilter !== 'all') count++;
    if (typeFilter !== 'all') count++;
    return count;
  }, [minPriceFilter, selectedCategory, selectedCity, statusFilter, typeFilter]);

  // Filtered & Sorted events
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      // Search
      const matchSearch = ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      // Category
      if (selectedCategory !== 'Tất cả' && ev.category !== selectedCategory) return false;

      // City
      if (selectedCity !== 'Tất cả địa điểm' && !ev.venue.includes(selectedCity)) return false;

      // Status
      if (statusFilter !== 'all' && ev.status !== statusFilter) return false;

      // Type (Seated / Zone)
      if (typeFilter !== 'all' && ev.type !== typeFilter) return false;

      // Min Price Filter
      if (minPriceFilter > 0 && ev.minPrice < minPriceFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price-asc') return a.minPrice - b.minPrice;
      if (sortBy === 'price-desc') return b.minPrice - a.minPrice;
      return 0;
    });
  }, [events, searchQuery, selectedCategory, selectedCity, statusFilter, typeFilter, minPriceFilter, sortBy]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Tất cả');
    setSelectedCity('Tất cả địa điểm');
    setStatusFilter('all');
    setTypeFilter('all');
    setMinPriceFilter(0);
    setSortBy('default');
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
      
      {/* Hero Banner Section */}
      <div style={{
        position: 'relative',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        marginBottom: '36px',
        padding: '48px 36px',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(236, 72, 153, 0.15) 100%), #101623',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-subtle)'
      }}>
        <div style={{ maxWidth: '640px', position: 'relative', zIndex: 2 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(236, 72, 153, 0.18)',
            color: '#f472b6',
            fontSize: '13px',
            fontWeight: 700,
            marginBottom: '16px',
            border: '1px solid rgba(236, 72, 153, 0.3)'
          }}>
            <Sparkles size={16} /> Vé Chính Hãng - Chọn Chỗ Thời Gian Thực
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1.2, marginBottom: '14px', color: '#fff' }}>
            Đắm chìm vào các sự kiện âm nhạc & giải trí đỉnh cao
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginBottom: '24px' }}>
            Đặt vé giữ chỗ theo sơ đồ ghế hoặc chọn vé khu vực đứng tự do siêu nhanh chóng, an toàn và tiện lợi.
          </p>

          {/* Quick Search Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid var(--border-glow)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
          }}>
            <Search size={20} color="var(--primary-light)" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên sự kiện, nghệ sĩ, địa điểm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '15px'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', color: 'var(--text-dim)', fontSize: '13px' }}
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
        gap: '16px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px'
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

            {/* 3. Trạng thái diễn ra: Đang mở bán vs Sắp có */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
                Thời gian mở bán
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { id: 'all', label: 'Tất cả trạng thái' },
                  { id: 'ongoing', label: 'Đang mở bán vé' },
                  { id: 'upcoming', label: 'Sắp diễn ra' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setStatusFilter(item.id)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: statusFilter === item.id ? 600 : 400,
                      backgroundColor: statusFilter === item.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      color: statusFilter === item.id ? 'var(--primary-light)' : 'var(--text-muted)',
                      border: statusFilter === item.id ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                      textAlign: 'left'
                    }}
                  >
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
      {filteredEvents.length === 0 ? (
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px'
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
              <div style={{ position: 'relative', width: '100%', height: '200px', overflow: 'hidden' }}>
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

                {/* Status Badge */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  display: 'flex',
                  gap: '8px'
                }}>
                  <span className={event.status === 'ongoing' ? 'badge-status-ongoing' : 'badge-status-upcoming'} style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {event.status === 'ongoing' ? '● Đang mở bán' : 'Sắp diễn ra'}
                  </span>
                </div>

                {/* Type Badge */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px'
                }}>
                  <span className={event.type === 'seated' ? 'badge-type-seated' : 'badge-type-zone'} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    {event.type === 'seated' ? <Armchair size={12} /> : <Layers size={12} />}
                    {event.type === 'seated' ? 'Seated-based' : 'Zone-based'}
                  </span>
                </div>

                {/* Category */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: 'var(--text-muted)'
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
                      <span>{event.date} • {event.time}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={15} color="var(--accent-pink)" />
                      <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>{event.venue}</span>
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
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Giá chỉ từ</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-pink)' }}>
                      {formatVND(event.minPrice)}
                    </div>
                  </div>

                  <button
                    className={event.type === 'seated' ? 'glow-btn-primary' : 'glow-btn-pink'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    Đặt vé ngay
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
