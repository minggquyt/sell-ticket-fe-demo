import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  SlidersHorizontal,
  ArrowUpDown,
  Sparkles,
  RotateCcw,
  Armchair,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { CATEGORIES, CITIES, isSeatedEvent, getEventVenue, getMinPrice } from '../data/events';
import { formatVND } from '../utils/format.js';
import EventCard from '../components/EventCard.jsx';
import './EventsPage.css';

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
    return events
      .filter((ev) => {
        const isSeated = isSeatedEvent(ev);
        const evVenue = getEventVenue(ev);
        const evMinPrice = getMinPrice(ev);

        // Search
        const matchSearch =
          ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      })
      .sort((a, b) => {
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
    <div className="events-page">
      {/* Hero Banner Section */}
      <div className="events-hero">
        <div className="events-hero-inner">
          <div className="events-hero-badge">
            <Sparkles size={15} /> Vé Chính Hãng - Chọn Chỗ Thời Gian Thực
          </div>
          <h1 className="events-hero-title">
            Đắm chìm vào các sự kiện âm nhạc & giải trí đỉnh cao
          </h1>
          <p className="events-hero-sub">
            Đặt vé giữ chỗ theo sơ đồ ghế hoặc chọn vé khu vực đứng tự do siêu nhanh chóng, an toàn
            và tiện lợi.
          </p>

          {/* Quick Search Bar */}
          <div className="events-searchbar">
            <Search size={18} color="var(--primary-light)" className="events-search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm sự kiện, nghệ sĩ, địa điểm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="events-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="events-search-clear">
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TOP CONTROLS: BẤM NÚT BỘ LỌC ĐỂ DROPDOWN XUỐNG & SẮP XẾP */}
      <div className="events-controls">
        {/* Nút Trigger Dropdown Bộ lọc */}
        <div className="events-controls-left">
          <button
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            className={`events-filter-btn${isFilterDropdownOpen ? ' open' : ''}`}
          >
            <Filter size={16} />
            <span>Bộ lọc tìm kiếm</span>
            {activeFiltersCount > 0 && (
              <span className="events-filter-count">{activeFiltersCount}</span>
            )}
            {isFilterDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {activeFiltersCount > 0 && (
            <button onClick={handleResetFilters} className="events-reset-btn">
              <RotateCcw size={14} /> Xóa bộ lọc ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Thông tin số lượng & Sắp xếp */}
        <div className="events-controls-right">
          <span className="events-result-count">
            Tìm thấy <strong className="events-result-num">{filteredEvents.length}</strong> sự kiện
          </span>

          <div className="events-sort-wrap">
            <ArrowUpDown size={15} color="var(--text-dim)" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="events-sort-select"
            >
              <option value="default" className="events-select-option">
                Sắp xếp: Mặc định
              </option>
              <option value="price-asc" className="events-select-option">
                Giá vé: Thấp đến cao
              </option>
              <option value="price-desc" className="events-select-option">
                Giá vé: Cao đến thấp
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* DROPDOWN FILTER PANEL (ẨN/HIỆN KHI BẤM NÚT) */}
      {isFilterDropdownOpen && (
        <div className="glass-panel animate-fade-in events-filter-panel">
          <div className="events-filter-head">
            <div className="events-filter-title">
              <SlidersHorizontal size={18} color="var(--primary-light)" />
              <span>Tùy chỉnh tiêu chí lọc sự kiện</span>
            </div>
            <button
              onClick={() => setIsFilterDropdownOpen(false)}
              className="events-filter-close"
              title="Đóng bộ lọc"
            >
              <X size={18} />
            </button>
          </div>

          <div className="events-filter-grid">
            {/* 1. Bộ lọc Giá vé tối thiểu (Slider + Pills) */}
            <div>
              <div className="events-price-head">
                <label className="events-label">Giá vé tối thiểu:</label>
                <span className="events-price-value">
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
                className="events-price-range"
              />

              <div className="events-pills">
                {[0, 500000, 1000000, 2000000].map((p) => (
                  <button
                    key={p}
                    onClick={() => setMinPriceFilter(p)}
                    className={`events-pill${minPriceFilter === p ? ' active' : ''}`}
                  >
                    {p === 0 ? 'Mọi giá' : `≥ ${p / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Loại hình đặt vé: Seated-based vs Zone-based */}
            <div>
              <label className="events-label events-label-block">Loại hình vé</label>
              <div className="events-type-list">
                {[
                  { id: 'all', label: 'Tất cả hình thức', icon: null },
                  {
                    id: 'seated',
                    label: 'Ghế ngồi (Seated-based, max 5 ghế)',
                    icon: <Armchair size={14} />,
                  },
                  {
                    id: 'zone',
                    label: 'Khu vực (Zone-based, max 5 vé)',
                    icon: <Layers size={14} />,
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTypeFilter(item.id)}
                    className={`events-type-btn${typeFilter === item.id ? ' active' : ''}`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Thể loại & Địa điểm */}
            <div>
              <label className="events-label events-label-block">Thể loại & Địa điểm</label>
              <div className="events-chips">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`events-chip${selectedCategory === cat ? ' active' : ''}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="events-city-select"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c} className="events-select-option">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* EVENT LISTING GRID */}
      {isLoading ? (
        <div className="events-loading">
          <div className="events-spinner" />
          <div className="events-loading-text">Đang tải danh sách sự kiện...</div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-panel events-empty">
          <Calendar size={48} color="var(--text-dim)" className="events-empty-icon" />
          <h3 className="events-empty-title">Không tìm thấy sự kiện phù hợp</h3>
          <p className="events-empty-text">
            Hãy thử điều chỉnh mức giá vé tối thiểu hoặc từ khóa tìm kiếm của bạn.
          </p>
          <button onClick={handleResetFilters} className="glow-btn-primary events-empty-btn">
            Xem tất cả sự kiện
          </button>
        </div>
      ) : (
        <div className="events-grid">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} onSelect={onSelectEvent} />
          ))}{' '}
        </div>
      )}
    </div>
  );
}
