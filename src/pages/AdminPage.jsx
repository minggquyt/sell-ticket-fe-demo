import React, { useState, useEffect } from 'react';
import { fetchAdminTickets } from '../services/eventService';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Armchair,
  Layers,
  Calendar,
  MapPin,
  DollarSign,
  Check,
  X,
  AlertCircle,
  Tag,
  Eye,
  SlidersHorizontal,
  RefreshCw,
  Ticket,
  LayoutDashboard,
  Compass,
  LogOut,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  User,
  Hash,
  Menu
} from 'lucide-react';
import {
  CATEGORIES,
  formatEventDate,
  isSeatedEvent,
  getEventVenue,
  getMinPrice,
  getMaxPrice,
  getSingleSeatTier
} from '../data/events';

// Dữ liệu mẫu danh sách vé đã đặt để quản lý vé (cập nhật theo 1 loại ghế cho Seated-based)
const INITIAL_MOCK_TICKETS = [
  {
    ticketCode: 'TK-VN98231',
    eventId: '22222222-2222-2222-2222-222222222221',
    customerName: 'Nguyễn Văn An',
    customerPhone: '0912 345 678',
    ticketType: 'Ghế tiêu chuẩn (Ghế A-12)',
    purchaseDate: '10/10/2026 14:30',
    price: 900000,
    status: 'paid' // paid | checked-in | cancelled
  },
  {
    ticketCode: 'TK-VN89211',
    eventId: '22222222-2222-2222-2222-222222222221',
    customerName: 'Trần Thị Thu Hà',
    customerPhone: '0988 777 666',
    ticketType: 'Ghế tiêu chuẩn (Ghế C-04)',
    purchaseDate: '09/10/2026 09:15',
    price: 900000,
    status: 'paid'
  },
  {
    ticketCode: 'TK-VN66723',
    eventId: '22222222-2222-2222-2222-222222222222',
    customerName: 'Lê Hoàng Nam',
    customerPhone: '0903 112 233',
    ticketType: 'Khu vực GA Standing (Zone-based)',
    purchaseDate: '08/10/2026 18:20',
    price: 650000,
    status: 'checked-in'
  },
  {
    ticketCode: 'TK-VN77812',
    eventId: '22222222-2222-2222-2222-222222222223',
    customerName: 'Phạm Minh Đức',
    customerPhone: '0977 889 900',
    ticketType: 'Ghế khán phòng Hòa Bình (Ghế B-08)',
    purchaseDate: '07/10/2026 11:00',
    price: 750000,
    status: 'paid'
  },
  {
    ticketCode: 'TK-VN55410',
    eventId: '22222222-2222-2222-2222-222222222224',
    customerName: 'Vũ Thùy Linh',
    customerPhone: '0934 556 778',
    ticketType: 'Khu vực VIP Lounge (Zone-based)',
    purchaseDate: '06/10/2026 20:45',
    price: 2500000,
    status: 'cancelled'
  },
  {
    ticketCode: 'TK-VN99120',
    eventId: '22222222-2222-2222-2222-222222222222',
    customerName: 'Hoàng Anh Tuấn',
    customerPhone: '0918 223 344',
    ticketType: 'Khu vực GA Standing (Zone-based)',
    purchaseDate: '05/10/2026 16:10',
    price: 650000,
    status: 'paid'
  }
];

export default function AdminPage({
  events,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onViewEvent,
  onNavigate,
  user,
  onLogout
}) {
  // Tab điều hướng bên aside menu: 'events' (Quản lý sự kiện) | 'tickets' (Quản lý vé)
  const [activeTab, setActiveTab] = useState('events');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // --- QUẢN LÝ SỰ KIỆN STATES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // --- QUẢN LÝ VÉ STATES ---
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketEventFilter, setTicketEventFilter] = useState('all');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [ticketsList, setTicketsList] = useState([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);

  const loadTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const tickets = await fetchAdminTickets(user?.token);
      if (tickets && Array.isArray(tickets)) {
        setTicketsList(tickets);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách vé quản trị:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [user]);

  // Form State Sự kiện
  const initialForm = {
    title: '',
    category: 'Âm nhạc',
    event_type: 'SEAT_BASED', // 'SEAT_BASED' | 'ZONE_BASED'
    type: 'seated', // 'seated' | 'zone'
    status: 'ongoing', // 'ongoing' | 'upcoming'
    date: '',
    start_time: '',
    time: '19:30 - 22:30',
    location: '',
    venue: '',
    // Seated-based: chỉ có duy nhất 1 loại ghế
    seatTierName: 'Ghế tiêu chuẩn',
    seatPrice: 500000,
    seatColor: '#6366f1',
    // Giá tối thiểu & tối đa (cho Zone-based hoặc hiển thị chung)
    min_price: '500000.00',
    max_price: '500000.00',
    minPrice: 500000,
    maxPrice: 500000,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    banner: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    thumbnails: ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'],
    organizer: '',
    description: '',
    seatTiers: [
      { id: 'standard', name: 'Ghế tiêu chuẩn', price: 500000, color: '#6366f1', rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }
    ],
    zones: [
      { id: 'z-ga', name: 'Khu vực GA Standing', price: 500000, description: 'Vé đứng tự do', remaining: 150, color: '#10b981' },
      { id: 'z-vip', name: 'Khu vực VIP Lounge', price: 1800000, description: 'Vé đứng khu vực ưu tiên', remaining: 40, color: '#ec4899' }
    ]
  };

  const [formData, setFormData] = useState(initialForm);

  const formatVND = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  // Lọc sự kiện
  const filteredEvents = events.filter(ev => {
    const isSeated = isSeatedEvent(ev);
    const evVenue = getEventVenue(ev);
    const matchSearch = ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evVenue.toLowerCase().includes(searchTerm.toLowerCase());
    let matchType = true;
    if (filterType === 'seated' || filterType === 'SEAT_BASED') {
      matchType = isSeated;
    } else if (filterType === 'zone' || filterType === 'ZONE_BASED') {
      matchType = !isSeated;
    }
    return matchSearch && matchType;
  });

  // Lọc vé theo tên người mua, mã vé, sự kiện và trạng thái
  const filteredTickets = ticketsList.filter(tk => {
    const ev = events.find(e => e.id === tk.eventId);
    const eventTitle = ev ? ev.title.toLowerCase() : (tk.eventTitle || '').toLowerCase();
    const query = ticketSearch.toLowerCase();

    const matchQuery = !ticketSearch ||
      (tk.ticketCode && tk.ticketCode.toLowerCase().includes(query)) ||
      (tk.customerName && tk.customerName.toLowerCase().includes(query)) ||
      (tk.customerPhone && tk.customerPhone.toLowerCase().includes(query)) ||
      (tk.customerEmail && tk.customerEmail.toLowerCase().includes(query)) ||
      (tk.seatNumber && tk.seatNumber.toLowerCase().includes(query)) ||
      eventTitle.includes(query);

    const matchEvent = ticketEventFilter === 'all' || tk.eventId === ticketEventFilter;
    const matchStatus = ticketStatusFilter === 'all' || tk.status === ticketStatusFilter;

    return matchQuery && matchEvent && matchStatus;
  });

  const handleOpenAddModal = () => {
    setEditingEvent(null);
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    setFormData({
      ...initialForm,
      date: formattedDate,
      start_time: today.toISOString()
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ev) => {
    setEditingEvent(ev);
    const isSeated = isSeatedEvent(ev);
    const singleTier = getSingleSeatTier(ev);
    const evMinPrice = getMinPrice(ev);
    const evMaxPrice = getMaxPrice(ev);
    const evVenue = getEventVenue(ev);
    const evDate = formatEventDate(ev) || ev.date || '';

    setFormData({
      ...ev,
      event_type: isSeated ? 'SEAT_BASED' : 'ZONE_BASED',
      type: isSeated ? 'seated' : 'zone',
      location: evVenue,
      venue: evVenue,
      date: evDate,
      start_time: ev.start_time || new Date().toISOString(),
      minPrice: evMinPrice,
      maxPrice: evMaxPrice,
      min_price: ev.min_price || `${evMinPrice.toFixed(2)}`,
      max_price: ev.max_price || `${evMaxPrice.toFixed(2)}`,
      seatTierName: singleTier.name || 'Ghế tiêu chuẩn',
      seatPrice: singleTier.price || evMinPrice,
      seatColor: singleTier.color || '#6366f1',
      seatTiers: [
        {
          id: 'standard',
          name: singleTier.name || 'Ghế tiêu chuẩn',
          price: singleTier.price || evMinPrice,
          color: singleTier.color || '#6366f1',
          rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        }
      ],
      zones: ev.zones || initialForm.zones
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    const loc = formData.location || formData.venue;
    if (!formData.title || !loc || !formData.date) {
      alert('Vui lòng điền đầy đủ Tên sự kiện, Địa điểm và Ngày diễn ra!');
      return;
    }

    const isSeated = formData.event_type === 'SEAT_BASED' || formData.type === 'seated';
    let payload;

    if (isSeated) {
      // Seated-based CHỈ CÓ 1 LOẠI GHẾ DUY NHẤT
      const price = Number(formData.seatPrice || formData.minPrice || 500000);
      const tierName = formData.seatTierName || 'Ghế tiêu chuẩn';
      const tierColor = formData.seatColor || '#6366f1';
      const singleTier = {
        id: 'standard',
        name: tierName,
        price,
        color: tierColor,
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
      };

      payload = {
        ...formData,
        event_type: 'SEAT_BASED',
        type: 'seated',
        location: loc,
        venue: loc,
        min_price: `${price.toFixed(2)}`,
        max_price: `${price.toFixed(2)}`,
        minPrice: price,
        maxPrice: price,
        seatTiers: [singleTier],
        thumbnails: formData.thumbnails || [formData.image],
        highlights: formData.highlights || [
          'Sơ đồ ghế đồng giá cho toàn bộ vị trí',
          'Trải nghiệm âm thanh và ánh sáng chuẩn quốc tế',
          'Check-in bằng mã vé điện tử QR nhanh chóng'
        ],
        rules: formData.rules || [
          'Không mang thức ăn, nước uống từ bên ngoài.',
          'Vui lòng có mặt trước giờ diễn 30 phút để làm thủ tục check-in.'
        ]
      };
    } else {
      const minP = Number(formData.minPrice || 500000);
      const maxP = Number(formData.maxPrice || minP);

      payload = {
        ...formData,
        event_type: 'ZONE_BASED',
        type: 'zone',
        location: loc,
        venue: loc,
        min_price: `${minP.toFixed(2)}`,
        max_price: `${maxP.toFixed(2)}`,
        minPrice: minP,
        maxPrice: maxP,
        thumbnails: formData.thumbnails || [formData.image],
        highlights: formData.highlights || [
          'Khu vực đứng tự do bùng nổ năng lượng',
          'Hiệu ứng âm thanh và laser hiện đại'
        ],
        rules: formData.rules || [
          'Không mang vật sắc nhọn, chất cấm vào sự kiện.',
          'Vòng tay check-in không tháo rời trong sự kiện.'
        ]
      };
    }

    if (editingEvent) {
      onUpdateEvent({
        ...payload,
        id: editingEvent.id
      });
    } else {
      const newId = `22222222-2222-2222-2222-${Date.now().toString().slice(-12)}`;
      onAddEvent({
        ...payload,
        id: newId,
        created_at: new Date().toISOString()
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    onDeleteEvent(id);
    setDeleteConfirmId(null);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-main)'
    }}>
      {/* Mobile Topbar for screens < 1024px */}
      <header className="admin-mobile-topbar" style={{
        display: 'none',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#0a0d16',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 45
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            style={{
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#fff',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            aria-label="Mở menu quản trị"
          >
            <Menu size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Ticket size={18} color="#ffffff" />
            </div>
            <div>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                Ticket<span style={{ color: '#ec4899' }}>Verse</span>
              </span>
              <span style={{ marginLeft: '6px', fontSize: '10px', color: '#f472b6', fontWeight: 700, backgroundColor: 'rgba(236, 72, 153, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                ADMIN
              </span>
            </div>
          </div>
        </div>

        {/* Quick Tab pills on mobile topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => { setActiveTab('events'); setIsMobileSidebarOpen(false); }}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: activeTab === 'events' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'events' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            Sự kiện
          </button>
          <button
            onClick={() => { setActiveTab('tickets'); setIsMobileSidebarOpen(false); }}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: activeTab === 'tickets' ? 'var(--accent-pink)' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'tickets' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            Vé ({ticketsList.length})
          </button>
        </div>
      </header>

      {/* Main layout row */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Mobile backdrop */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="admin-sidebar-backdrop animate-fade-in"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(5, 7, 12, 0.75)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 90
            }}
          />
        )}

        {/* ================= ASIDE BÊN TRÁI ================= */}
        <aside 
          className={`admin-sidebar ${isMobileSidebarOpen ? 'admin-sidebar-open' : ''}`}
          style={{
            width: '280px',
            minWidth: '280px',
            backgroundColor: '#0a0d16',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            height: '100dvh',
            zIndex: 95
          }}
        >
          {/* Trên cùng: Logo và Tên web + Nút đóng trên mobile */}
          <div
            style={{
              padding: '24px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div
              onClick={() => onNavigate && onNavigate('events')}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
              }}>
                <Ticket size={24} color="#ffffff" />
              </div>
              <div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  letterSpacing: '-0.5px',
                  background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  Ticket<span style={{ color: '#ec4899', WebkitTextFillColor: '#ec4899' }}>Verse</span>
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--accent-pink)',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}>
                  Admin Console
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="admin-sidebar-close-btn"
              style={{
                display: 'none',
                padding: '6px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer'
              }}
              title="Đóng menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* Danh sách các mục điều hướng Sidebar */}
          <div style={{ padding: '20px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              padding: '0 12px 6px'
            }}>
              Hệ thống Quản lý
            </div>

            {/* Mục 1: Quản lý sự kiện (CRUD) */}
            <button
              onClick={() => { setActiveTab('events'); setIsMobileSidebarOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: activeTab === 'events' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                color: activeTab === 'events' ? '#fff' : 'var(--text-muted)',
                border: activeTab === 'events' ? '1px solid var(--border-glow)' : '1px solid transparent',
                fontWeight: 600,
                fontSize: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <LayoutDashboard size={19} color={activeTab === 'events' ? 'var(--primary-light)' : 'var(--text-dim)'} />
                <span>Quản lý sự kiện</span>
              </div>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: activeTab === 'events' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                color: activeTab === 'events' ? 'var(--primary-light)' : 'var(--text-dim)'
              }}>
                {events.length}
              </span>
            </button>

            {/* Mục 2: Quản lý vé */}
            <button
              onClick={() => { setActiveTab('tickets'); setIsMobileSidebarOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: activeTab === 'tickets' ? 'rgba(236, 72, 153, 0.18)' : 'transparent',
                color: activeTab === 'tickets' ? '#fff' : 'var(--text-muted)',
                border: activeTab === 'tickets' ? '1px solid rgba(236, 72, 153, 0.35)' : '1px solid transparent',
                fontWeight: 600,
                fontSize: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Ticket size={19} color={activeTab === 'tickets' ? 'var(--accent-pink)' : 'var(--text-dim)'} />
                <span>Quản lý vé</span>
              </div>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: activeTab === 'tickets' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                color: activeTab === 'tickets' ? '#f472b6' : 'var(--text-dim)'
              }}>
                {ticketsList.length}
              </span>
            </button>
          </div>

        {/* Góc dưới sidebar: Admin profile & Đăng xuất */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: '#07090f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
              alt="avatar"
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-pink)' }}
            />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.name || 'Administrator'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--accent-pink)', fontWeight: 600 }}>
                Quản trị viên
              </div>
            </div>
          </div>

          <button
            onClick={() => onLogout ? onLogout() : (onNavigate && onNavigate('events'))}
            title="Đăng xuất khỏi trang quản trị"
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              cursor: 'pointer'
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ================= NỘI DUNG CHÍNH (MAIN CONTENT) ================= */}
      <main style={{
        flex: 1,
        minWidth: 0, // Cực kỳ quan trọng để bảng trượt ngang không làm vỡ flex container
        overflowX: 'hidden',
        padding: 'clamp(16px, 3.5vw, 32px) clamp(12px, 3vw, 32px)',
        backgroundColor: 'var(--bg-primary)'
      }}>
        {/* ================= TAB 1: QUẢN LÝ SỰ KIỆN ================= */}
        {activeTab === 'events' && (
          <div>
            {/* Header Quản lý sự kiện */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '28px'
            }}>
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary-light)',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '8px'
                }}>
                  <SlidersHorizontal size={14} /> Quản lý danh mục sự kiện & bán vé
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>
                  Danh sách Sự kiện (CRUD)
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Thêm mới, sửa thông tin, cấu hình Seated/Zone và xóa các sự kiện trong hệ thống.
                </p>
              </div>

              <button
                onClick={handleOpenAddModal}
                className="glow-btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 22px',
                  fontSize: '14px',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <Plus size={18} /> Thêm sự kiện mới
              </button>
            </div>

            {/* Bộ lọc & Tìm kiếm sự kiện */}
            <div className="glass-panel" style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              {/* Tìm kiếm */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                width: '320px',
                maxWidth: '100%'
              }}>
                <Search size={18} color="var(--text-dim)" />
                <input
                  type="text"
                  placeholder="Tìm tên sự kiện, địa điểm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    width: '100%'
                  }}
                />
              </div>

              {/* Loại vé Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loại vé:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="all">Tất cả ({events.length})</option>
                  <option value="seated">Seated-based ({events.filter(e => isSeatedEvent(e)).length})</option>
                  <option value="zone">Zone-based ({events.filter(e => !isSeatedEvent(e)).length})</option>
                </select>
              </div>
            </div>

            {/* BẢNG SỰ KIỆN - CHO TRƯỢT THANH NGANG ĐỘC LẬP KHI DÀI (minWidth 960px) */}
            <div className="glass-panel" style={{
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-subtle)'
            }}>
              <div style={{
                overflowX: 'auto',
                width: '100%',
                WebkitOverflowScrolling: 'touch'
              }}>
                <table style={{
                  width: '100%',
                  minWidth: '960px',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '14px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '320px' }}>SỰ KIỆN</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '150px' }}>LOẠI VÉ</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '220px' }}>NGÀY & ĐỊA ĐIỂM</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '180px' }}>GIÁ TỐI THIỂU</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'right', width: '140px' }}>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                          Không có sự kiện nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map(ev => (
                        <tr
                          key={ev.id}
                          style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {/* Tên & ảnh */}
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <img
                                src={ev.image}
                                alt={ev.title}
                                style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover' }}
                              />
                              <div>
                                <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                                  {ev.title}
                                </div>
                                <span style={{
                                  fontSize: '11px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  color: 'var(--text-muted)'
                                }}>
                                  {ev.category}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Loại vé badge */}
                          <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                            {(() => {
                              const isSeated = isSeatedEvent(ev);
                              return (
                                <span className={isSeated ? 'badge-type-seated' : 'badge-type-zone'} style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: 'var(--radius-full)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {isSeated ? <Armchair size={13} /> : <Layers size={13} />}
                                  {isSeated ? 'Seated-based' : 'Zone-based'}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Ngày & Địa điểm */}
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ fontSize: '13px', color: '#fff', marginBottom: '2px' }}>
                              {formatEventDate(ev)}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-dim)', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {getEventVenue(ev)}
                            </div>
                          </td>

                          {/* Giá vé */}
                          <td style={{ padding: '16px 20px' }}>
                            {isSeatedEvent(ev) ? (
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--accent-pink)' }}>
                                  {formatVND(getMinPrice(ev))}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--primary-light)' }}>
                                  Đồng giá
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--accent-pink)' }}>
                                  {formatVND(getMinPrice(ev))}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                  đến {formatVND(getMaxPrice(ev))}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Thao tác CRUD */}
                          <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <button
                                onClick={() => onViewEvent && onViewEvent(ev)}
                                title="Xem trang chi tiết khán giả"
                                style={{
                                  padding: '8px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  color: 'var(--text-muted)'
                                }}
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                onClick={() => handleOpenEditModal(ev)}
                                title="Chỉnh sửa thông tin sự kiện"
                                style={{
                                  padding: '8px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                  color: 'var(--primary-light)'
                                }}
                              >
                                <Edit3 size={16} />
                              </button>

                              <button
                                onClick={() => setDeleteConfirmId(ev.id)}
                                title="Xóa sự kiện"
                                style={{
                                  padding: '8px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  color: '#f87171'
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: QUẢN LÝ VÉ ================= */}
        {activeTab === 'tickets' && (
          <div>
            {/* Header Quản lý vé */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '28px'
            }}>
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(236, 72, 153, 0.15)',
                  color: '#f472b6',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '8px'
                }}>
                  <Ticket size={14} /> Kiểm soát vé & Tra cứu đặt chỗ
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>
                  Quản lý Vé đã phát hành
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Tra cứu người mua theo tên, mã vé và lọc vé theo từng sự kiện hoặc tình trạng thanh toán.
                </p>
              </div>

              {/* Nút đếm và reload vé từ database */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  color: 'var(--text-muted)'
                }}>
                  <CheckCircle2 size={16} color="var(--accent-emerald)" />
                  Tổng vé đã bán: <strong style={{ color: '#fff' }}>{ticketsList.length}</strong>
                </div>
                <button
                  onClick={loadTickets}
                  disabled={isLoadingTickets}
                  title="Tải lại danh sách vé từ Supabase"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(236, 72, 153, 0.15)',
                    color: '#f472b6',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  <RefreshCw size={14} className={isLoadingTickets ? 'spin' : ''} />
                  {isLoadingTickets ? 'Đang đồng bộ...' : 'Làm mới'}
                </button>
              </div>
            </div>

            {/* Filter & Search Bar cho vé */}
            <div className="glass-panel" style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              {/* Search theo tên khách, mã vé */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                width: '360px',
                maxWidth: '100%'
              }}>
                <Search size={18} color="var(--text-dim)" />
                <input
                  type="text"
                  placeholder="Tìm theo Mã vé (TK-...), Tên khách, SĐT..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    width: '100%'
                  }}
                />
              </div>

              {/* Bộ lọc: Theo Sự kiện & Theo Trạng thái */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sự kiện:</span>
                  <select
                    value={ticketEventFilter}
                    onChange={(e) => setTicketEventFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      fontSize: '13px',
                      maxWidth: '220px'
                    }}
                  >
                    <option value="all">Tất cả sự kiện</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Trạng thái:</span>
                  <select
                    value={ticketStatusFilter}
                    onChange={(e) => setTicketStatusFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      fontSize: '13px'
                    }}
                  >
                    <option value="all">Tất cả</option>
                    <option value="paid">Đã thanh toán</option>
                    <option value="checked-in">Đã Check-in</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>
              </div>
            </div>

            {/* BẢNG VÉ - CHO TRƯỢT THANH NGANG ĐỘC LẬP (minWidth 1000px) */}
            <div className="glass-panel" style={{
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-subtle)'
            }}>
              <div style={{
                overflowX: 'auto',
                width: '100%',
                WebkitOverflowScrolling: 'touch'
              }}>
                <table style={{
                  width: '100%',
                  minWidth: '1000px',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '14px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '150px' }}>MÃ VÉ</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '260px' }}>SỰ KIỆN</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '220px' }}>NGƯỜI MUA</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '200px' }}>HẠNG VÉ / VỊ TRÍ</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '140px' }}>GIÁ TIỀN</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '150px' }}>TRẠNG THÁI</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'right', width: '110px' }}>CHECK-IN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingTickets ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                          Đang tải dữ liệu vé từ hệ thống database Supabase...
                        </td>
                      </tr>
                    ) : filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                          Không tìm thấy vé nào phù hợp với điều kiện tìm kiếm.
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map(tk => {
                        const targetEvent = events.find(e => e.id === tk.eventId);
                        return (
                          <tr
                            key={tk.id || tk.ticketCode}
                            style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {/* Mã vé */}
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                color: 'var(--primary-light)',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid rgba(99, 102, 241, 0.2)'
                              }}>
                                {tk.ticketCode}
                              </span>
                            </td>

                            {/* Tên sự kiện */}
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ fontWeight: 600, color: '#fff', marginBottom: '2px' }}>
                                {targetEvent ? targetEvent.title : (tk.eventTitle || 'Sự kiện hệ thống')}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                {targetEvent ? `${targetEvent.date} • ${targetEvent.venue}` : (tk.purchaseDate || '')}
                              </div>
                            </td>

                            {/* Người mua */}
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ fontWeight: 600, color: '#fff' }}>{tk.customerName || 'Khách hàng'}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{tk.customerEmail || tk.customerPhone || 'N/A'}</div>
                            </td>

                            {/* Hạng vé / vị trí */}
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{tk.ticketType}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{tk.purchaseDate}</div>
                            </td>

                            {/* Giá tiền */}
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--accent-pink)' }}>
                                {formatVND(tk.price)}
                              </div>
                            </td>

                            {/* Trạng thái */}
                            <td style={{ padding: '16px 20px' }}>
                              {tk.status === 'paid' && (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  color: 'var(--accent-emerald)',
                                  fontSize: '11px',
                                  fontWeight: 700
                                }}>
                                  Đã thanh toán
                                </span>
                              )}
                              {tk.status === 'checked-in' && (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: 'rgba(6, 182, 212, 0.15)',
                                  color: 'var(--accent-cyan)',
                                  fontSize: '11px',
                                  fontWeight: 700
                                }}>
                                  Đã Check-in
                                </span>
                              )}
                              {tk.status === 'cancelled' && (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  color: '#f87171',
                                  fontSize: '11px',
                                  fontWeight: 700
                                }}>
                                  Đã hủy
                                </span>
                              )}
                            </td>

                            {/* Nút hành động Check-in */}
                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                              {tk.status === 'paid' ? (
                                <button
                                  onClick={() => {
                                    setTicketsList(prev => prev.map(t => t.ticketCode === tk.ticketCode ? { ...t, status: 'checked-in' } : t));
                                    alert(`Đã Check-in thành công cho vé ${tk.ticketCode}!`);
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                    color: 'var(--accent-emerald)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Soát vé
                                </button>
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                                  {tk.status === 'checked-in' ? 'Hoàn tất' : 'Vô hiệu'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* ================= MODAL THÊM / SỬA SỰ KIỆN ================= */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '720px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: 'var(--radius-xl)',
            padding: '32px',
            border: '1px solid var(--border-glow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>
                {editingEvent ? 'Chỉnh sửa sự kiện' : 'Thêm sự kiện mới'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', color: 'var(--text-dim)', padding: '4px', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Tên sự kiện */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Tên sự kiện *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Sky Tour Concert..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Loại vé và Trạng thái */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Loại hình đặt vé *
                  </label>
                  <select
                    value={formData.event_type || (formData.type === 'seated' ? 'SEAT_BASED' : 'ZONE_BASED')}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        event_type: val,
                        type: val === 'SEAT_BASED' ? 'seated' : 'zone'
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  >
                    <option value="SEAT_BASED">Seated-based</option>
                    <option value="ZONE_BASED">Zone-based (Khu vực đứng/vé mở, max 5 vé)</option>
                  </select>
                </div>
              </div>

              {/* Thể loại & Ban tổ chức */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Thể loại
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  >
                    {CATEGORIES.filter(c => c !== 'Tất cả').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Ban tổ chức
                  </label>
                  <input
                    type="text"
                    placeholder="Tên đơn vị tổ chức..."
                    value={formData.organizer}
                    onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Ngày và Địa điểm */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Ngày diễn ra (Date / Start Time) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 15 Tháng 12, 2026"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Địa điểm tổ chức (Location) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: SECC Quận 7, TP.HCM"
                    value={formData.location || formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value, location: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Cấu hình giá: Phân tách Seated-based (1 loại ghế) vs Zone-based */}
              {(formData.event_type === 'SEAT_BASED' || formData.type === 'seated') ? (
                <div style={{
                  padding: '18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Armchair size={18} color="var(--primary-light)" />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                        Cấu hình Ghế ngồi (Seated-based)
                      </span>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(99, 102, 241, 0.35)'
                    }}>
                      Đồng giá toàn bộ khán phòng
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    💡 Sự kiện Seated-based áp dụng cho toàn bộ các hàng ghế (A đến G). Giá vé sẽ áp dụng đồng nhất cho mọi ghế ngồi.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Tên loại ghế *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Ghế tiêu chuẩn"
                        value={formData.seatTierName || 'Ghế tiêu chuẩn'}
                        onChange={(e) => setFormData({ ...formData, seatTierName: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          color: '#fff',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Giá vé ghế ngồi (VNĐ) *
                      </label>
                      <input
                        type="number"
                        required
                        step="10000"
                        placeholder="VD: 900000"
                        value={formData.seatPrice || formData.minPrice || 500000}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormData({
                            ...formData,
                            seatPrice: val,
                            minPrice: val,
                            maxPrice: val,
                            min_price: `${val.toFixed(2)}`,
                            max_price: `${val.toFixed(2)}`
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          color: '#fff',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '12px'
                  }}>
                    <span style={{ color: 'var(--text-dim)' }}>
                      Quy mô: <strong>56 ghế ngồi</strong> (7 hàng A-G, 8 ghế/hàng)
                    </span>
                    <span style={{ color: 'var(--accent-pink)', fontWeight: 700 }}>
                      Giá bán: {formatVND(formData.seatPrice || formData.minPrice || 500000)} / vé
                    </span>
                  </div>
                </div>
              ) : (
                /* Giá vé tối thiểu & tối đa cho Zone-based */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Giá vé tối thiểu (VNĐ) *
                    </label>
                    <input
                      type="number"
                      required
                      step="50000"
                      value={formData.minPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormData({
                          ...formData,
                          minPrice: val,
                          min_price: `${val.toFixed(2)}`
                        });
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: '#fff',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Giá vé cao nhất (VNĐ)
                    </label>
                    <input
                      type="number"
                      step="50000"
                      value={formData.maxPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormData({
                          ...formData,
                          maxPrice: val,
                          max_price: `${val.toFixed(2)}`
                        });
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: '#fff',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Ảnh URL */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Ảnh bìa sự kiện (Image URL)
                </label>
                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value, banner: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Mô tả */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Mô tả chi tiết sự kiện
                </label>
                <textarea
                  rows="3"
                  placeholder="Nội dung tóm tắt sự kiện..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="glow-btn-primary"
                  style={{
                    padding: '10px 24px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Check size={16} /> Lưu sự kiện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL XÁC NHẬN XÓA ================= */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '420px',
            width: '100%',
            borderRadius: 'var(--radius-lg)',
            padding: '28px',
            textAlign: 'center',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertCircle size={28} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px', color: '#fff' }}>
              Xác nhận xóa sự kiện?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              Hành động này không thể hoàn tác và sự kiện sẽ bị gỡ bỏ khỏi toàn bộ danh sách vé.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 1023px) {
          .admin-mobile-topbar {
            display: flex !important;
          }
          .admin-sidebar {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            z-index: 100 !important;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
            box-shadow: 0 0 50px rgba(0, 0, 0, 0.85);
          }
          .admin-sidebar-open {
            transform: translateX(0) !important;
          }
          .admin-sidebar-close-btn {
            display: flex !important;
          }
        }
        @media (min-width: 1024px) {
          .admin-sidebar-close-btn {
            display: none !important;
          }
          .admin-sidebar-backdrop {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
