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
  Menu,
  LayoutGrid,
  Table as TableIcon
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
  // Chế độ xem: 'auto' (Thẻ trên di động, Bảng trên máy tính) | 'cards' | 'table'
  const [viewMode, setViewMode] = useState('auto');

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
    // Số ghế / hàng cho Seated-based
    rowsCount: 7,
    seatsPerRow: 12,
    totalSeats: 84,
    // Giá tối thiểu & tối đa (cho Zone-based hoặc hiển thị chung)
    min_price: '500000.00',
    max_price: '500000.00',
    minPrice: 500000,
    maxPrice: 500000,
    totalTickets: 190,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    banner: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    thumbnails: ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'],
    organizer: '',
    description: '',
    seatTiers: [
      { id: 'standard', name: 'Ghế tiêu chuẩn', price: 500000, color: '#6366f1', rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }
    ],
    zones: [
      { id: 'z-ga', name: 'Khu vực GA Standing', price: 500000, description: 'Vé đứng tự do', total: 150, remaining: 150, color: '#10b981' },
      { id: 'z-vip', name: 'Khu vực VIP Lounge', price: 1800000, description: 'Vé đứng khu vực ưu tiên', total: 40, remaining: 40, color: '#ec4899' }
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

    const rowsCount = ev.rowsCount || ev.seatConfig?.rowsCount || (singleTier.rows?.length) || 7;
    const seatsPerRow = ev.seatsPerRow || ev.seatConfig?.seatsPerRow || 12;
    const totalSeats = ev.totalSeats || ev.seatConfig?.totalSeats || (rowsCount * seatsPerRow);

    const price = evMinPrice > 0 ? evMinPrice : (singleTier.price > 0 ? singleTier.price : (Number(ev.seatPrice) > 0 ? Number(ev.seatPrice) : 500000));
    const maxP = evMaxPrice > 0 ? evMaxPrice : price;

    setFormData({
      ...ev,
      event_type: isSeated ? 'SEAT_BASED' : 'ZONE_BASED',
      type: isSeated ? 'seated' : 'zone',
      location: evVenue,
      venue: evVenue,
      date: evDate,
      start_time: ev.start_time || new Date().toISOString(),
      minPrice: price,
      maxPrice: maxP,
      min_price: `${price.toFixed(2)}`,
      max_price: `${maxP.toFixed(2)}`,
      seatTierName: singleTier.name || 'Ghế tiêu chuẩn',
      seatPrice: price,
      seatColor: singleTier.color || '#6366f1',
      rowsCount,
      seatsPerRow,
      totalSeats,
      seatTiers: [
        {
          id: 'standard',
          name: singleTier.name || 'Ghế tiêu chuẩn',
          price: price,
          color: singleTier.color || '#6366f1',
          rows: singleTier.rows || Array.from({ length: rowsCount }, (_, i) => String.fromCharCode(65 + i))
        }
      ],
      zones: ev.zones || initialForm.zones
    });
    setIsModalOpen(true);
  };

  // Helper quản lý danh sách Zone cho Zone-based
  const handleZoneChange = (index, field, value) => {
    setFormData(prev => {
      const newZones = [...(prev.zones || [])];
      newZones[index] = { ...newZones[index], [field]: value };
      if (field === 'total') {
        newZones[index].remaining = Number(value);
      }
      return { ...prev, zones: newZones };
    });
  };

  const handleAddZone = () => {
    setFormData(prev => ({
      ...prev,
      zones: [
        ...(prev.zones || []),
        {
          id: `z-${Date.now()}`,
          name: `Khu vực mới ${(prev.zones?.length || 0) + 1}`,
          price: prev.minPrice || 500000,
          description: 'Vé đứng tự do',
          total: 50,
          remaining: 50,
          color: '#10b981'
        }
      ]
    }));
  };

  const handleRemoveZone = (index) => {
    setFormData(prev => {
      const newZones = (prev.zones || []).filter((_, i) => i !== index);
      return { ...prev, zones: newZones };
    });
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
      // Seated-based: Cấu hình số ghế theo hàng x cột
      const price = Number(formData.seatPrice !== '' && formData.seatPrice != null ? formData.seatPrice : (formData.minPrice || 500000));
      const tierName = formData.seatTierName || 'Ghế tiêu chuẩn';
      const tierColor = formData.seatColor || '#6366f1';
      const seatsPerRow = Number(formData.seatsPerRow) || 12;
      const rowsCount = Number(formData.rowsCount) || (formData.totalSeats ? Math.ceil(Number(formData.totalSeats) / seatsPerRow) : 7);
      const totalSeats = Number(formData.totalSeats) || (rowsCount * seatsPerRow);
      const rowLetters = Array.from({ length: rowsCount }, (_, i) => String.fromCharCode(65 + i));

      const singleTier = {
        id: 'standard',
        name: tierName,
        price,
        color: tierColor,
        rows: rowLetters
      };

      const seatConfig = {
        totalSeats,
        rowsCount,
        seatsPerRow,
        price
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
        totalSeats,
        rowsCount,
        seatsPerRow,
        seatConfig,
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
      const zoneConfigs = (formData.zones || []).map(z => ({
        zoneName: (z.name || z.zoneName || 'STANDARD').toUpperCase(),
        count: Number(z.total || z.remaining || 50),
        price: Number(z.price || formData.minPrice || 500000)
      }));
      const totalTickets = zoneConfigs.reduce((sum, z) => sum + z.count, 0);
      const minP = zoneConfigs.length > 0 ? Math.min(...zoneConfigs.map(z => z.price)) : Number(formData.minPrice || 500000);
      const maxP = zoneConfigs.length > 0 ? Math.max(...zoneConfigs.map(z => z.price)) : Number(formData.maxPrice || minP);

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
        totalTickets,
        zoneConfigs,
        zones: (formData.zones || []).map(z => ({
          ...z,
          total: Number(z.total || z.remaining || 50),
          remaining: Number(z.remaining || z.total || 50)
        })),
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
      width: '100%',
      maxWidth: '100vw',
      overflowX: 'hidden',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-main)',
      boxSizing: 'border-box'
    }}>
      {/* Mobile Topbar for screens < 1024px */}
      <header className="admin-mobile-topbar" style={{
        display: 'none',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px clamp(10px, 3vw, 16px)',
        backgroundColor: '#0a0d16',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 45,
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            style={{
              padding: '7px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#fff',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
            aria-label="Mở menu quản trị"
          >
            <Menu size={19} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Ticket size={15} color="#ffffff" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
                Ticket<span style={{ color: '#ec4899' }}>Verse</span>
              </span>
              <span style={{ fontSize: '9px', color: '#f472b6', fontWeight: 700, backgroundColor: 'rgba(236, 72, 153, 0.2)', padding: '2px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                ADMIN
              </span>
            </div>
          </div>
        </div>

        {/* Quick Tab pills on mobile topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={() => { setActiveTab('events'); setIsMobileSidebarOpen(false); }}
            style={{
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: activeTab === 'events' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'events' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              border: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            Sự kiện
          </button>
          <button
            onClick={() => { setActiveTab('tickets'); setIsMobileSidebarOpen(false); }}
            style={{
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: activeTab === 'tickets' ? 'var(--accent-pink)' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'tickets' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              border: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            Vé ({ticketsList.length})
          </button>
        </div>
      </header>

      {/* Main layout row */}
      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        width: '100%',
        maxWidth: '100vw',
        minWidth: 0,
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}>
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
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        padding: 'clamp(14px, 3vw, 28px) clamp(10px, 2.5vw, 24px)',
        backgroundColor: 'var(--bg-primary)',
        boxSizing: 'border-box'
      }}>
        {/* ================= TAB 1: QUẢN LÝ SỰ KIỆN ================= */}
        {activeTab === 'events' && (
          <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
            {/* Header Quản lý sự kiện */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              marginBottom: '22px'
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
                  marginBottom: '6px'
                }}>
                  <SlidersHorizontal size={14} /> Quản lý danh mục sự kiện & bán vé
                </div>
                <h1 style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Danh sách Sự kiện (CRUD)
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
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
                  padding: '10px 18px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md)',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={17} /> Thêm sự kiện mới
              </button>
            </div>

            {/* Bộ lọc & Tìm kiếm sự kiện */}
            <div className="glass-panel" style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
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
                flex: '1 1 240px',
                minWidth: '200px',
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}>
                <Search size={18} color="var(--text-dim)" style={{ flexShrink: 0 }} />
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

              {/* Loại vé Filter & Toggle Chế độ xem */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Loại vé:</span>
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

                {/* View Mode Toggle: Cards vs Table */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '3px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}>
                  <button
                    onClick={() => setViewMode(viewMode === 'cards' ? 'auto' : 'cards')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 9px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: viewMode === 'cards' ? 'var(--primary)' : 'transparent',
                      color: viewMode === 'cards' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    title="Hiển thị dạng thẻ (tối ưu không bị trượt ngang trên di động)"
                  >
                    <LayoutGrid size={14} />
                    <span>Thẻ</span>
                  </button>
                  <button
                    onClick={() => setViewMode(viewMode === 'table' ? 'auto' : 'table')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 9px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                      color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    title="Hiển thị dạng bảng dữ liệu đầy đủ"
                  >
                    <TableIcon size={14} />
                    <span>Bảng</span>
                  </button>
                </div>
              </div>
            </div>

            {/* DẠNG THẺ (CARDS) CHO SỰ KIỆN - HOÀN TOÀN KHÔNG CÓ THANH TRƯỢT NGANG TRÊN MOBILE */}
            {(viewMode === 'cards' || viewMode === 'auto') && (
              <div
                className={viewMode === 'auto' ? 'admin-mobile-cards-auto' : ''}
                style={{
                  display: viewMode === 'cards' ? 'grid' : undefined,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
                  gap: '16px',
                  marginBottom: '20px'
                }}
              >
                {filteredEvents.length === 0 ? (
                  <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '36px 20px', textAlign: 'center', color: 'var(--text-dim)', borderRadius: 'var(--radius-lg)' }}>
                    Không có sự kiện nào phù hợp với bộ lọc.
                  </div>
                ) : (
                  filteredEvents.map(ev => {
                    const isSeated = isSeatedEvent(ev);
                    return (
                      <div
                        key={ev.id}
                        className="glass-panel"
                        style={{
                          borderRadius: 'var(--radius-lg)',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'var(--shadow-subtle)',
                          transition: 'var(--transition)'
                        }}
                      >
                        {/* Ảnh bìa + Category badge + Type badge */}
                        <div style={{ position: 'relative', width: '100%', height: '150px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                          <img
                            src={ev.image}
                            alt={ev.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: 'rgba(10, 13, 22, 0.85)',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              color: '#fff',
                              border: '1px solid rgba(255, 255, 255, 0.15)'
                            }}>
                              {ev.category}
                            </span>
                          </div>
                          <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                            <span className={isSeated ? 'badge-type-seated' : 'badge-type-zone'} style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 9px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '11px',
                              fontWeight: 700
                            }}>
                              {isSeated ? <Armchair size={12} /> : <Layers size={12} />}
                              {isSeated ? 'Seated-based' : 'Zone-based'}
                            </span>
                          </div>
                        </div>

                        {/* Tiêu đề & Thông tin ngày/địa điểm */}
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '8px', lineHeight: 1.4 }}>
                            {ev.title}
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Calendar size={14} color="var(--primary-light)" style={{ flexShrink: 0 }} />
                              <span>{formatEventDate(ev)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <MapPin size={14} color="var(--accent-pink)" style={{ flexShrink: 0 }} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getEventVenue(ev)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Giá vé */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border-color)'
                        }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                            {isSeated ? 'Giá ghế ngồi:' : 'Giá vé từ:'}
                          </span>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-pink)' }}>
                              {formatVND(getMinPrice(ev))}
                            </span>
                            {!isSeated && (
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '4px' }}>
                                - {formatVND(getMaxPrice(ev))}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Thao tác CRUD: Xem, Sửa, Xóa */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingTop: '4px' }}>
                          <button
                            onClick={() => onViewEvent && onViewEvent(ev)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              padding: '9px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-muted)',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '1px solid var(--border-color)',
                              cursor: 'pointer'
                            }}
                            title="Xem trang chi tiết khán giả"
                          >
                            <Eye size={15} /> <span>Xem</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(ev)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              padding: '9px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(99, 102, 241, 0.15)',
                              color: 'var(--primary-light)',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              cursor: 'pointer'
                            }}
                            title="Chỉnh sửa thông tin sự kiện"
                          >
                            <Edit3 size={15} /> <span>Sửa</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(ev.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              padding: '9px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              cursor: 'pointer'
                            }}
                            title="Xóa sự kiện"
                          >
                            <Trash2 size={15} /> <span>Xóa</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* DẠNG BẢNG (TABLE) CHO SỰ KIỆN - HIỂN THỊ MẶC ĐỊNH TRÊN DESKTOP */}
            {(viewMode === 'table' || viewMode === 'auto') && (
              <div
                className={viewMode === 'auto' ? 'admin-desktop-table-auto' : ''}
                style={{
                  display: viewMode === 'table' ? 'block' : undefined,
                  width: '100%',
                  maxWidth: '100%',
                  overflow: 'hidden'
                }}
              >
                <div className="glass-panel" style={{
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-subtle)',
                  width: '100%',
                  maxWidth: '100%'
                }}>
                  <div style={{
                    overflowX: 'auto',
                    width: '100%',
                    maxWidth: '100%',
                    WebkitOverflowScrolling: 'touch'
                  }}>
                    <table style={{
                      width: '100%',
                      minWidth: '860px',
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
          </div>
        )}

        {/* ================= TAB 2: QUẢN LÝ VÉ ================= */}
        {activeTab === 'tickets' && (
          <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
            {/* Header Quản lý vé */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              marginBottom: '22px'
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
                  marginBottom: '6px'
                }}>
                  <Ticket size={14} /> Kiểm soát vé & Tra cứu đặt chỗ
                </div>
                <h1 style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Quản lý Vé đã phát hành
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                  Tra cứu người mua theo tên, mã vé và lọc vé theo từng sự kiện hoặc tình trạng thanh toán.
                </p>
              </div>

              {/* Nút đếm và reload vé từ database */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  color: 'var(--text-muted)'
                }}>
                  <CheckCircle2 size={15} color="var(--accent-emerald)" />
                  <span>Tổng vé: <strong style={{ color: '#fff' }}>{ticketsList.length}</strong></span>
                </div>
                <button
                  onClick={loadTickets}
                  disabled={isLoadingTickets}
                  title="Tải lại danh sách vé từ Supabase"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(236, 72, 153, 0.15)',
                    color: '#f472b6',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  <RefreshCw size={13} className={isLoadingTickets ? 'spin' : ''} />
                  {isLoadingTickets ? 'Đang đồng bộ...' : 'Làm mới'}
                </button>
              </div>
            </div>

            {/* Filter & Search Bar cho vé */}
            <div className="glass-panel" style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
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
                flex: '1 1 240px',
                minWidth: '200px',
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}>
                <Search size={18} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Tìm theo Mã vé, Tên khách, SĐT..."
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

              {/* Bộ lọc & Toggle View */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Sự kiện:</span>
                  <select
                    value={ticketEventFilter}
                    onChange={(e) => setTicketEventFilter(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      fontSize: '13px',
                      maxWidth: '180px'
                    }}
                  >
                    <option value="all">Tất cả sự kiện</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Trạng thái:</span>
                  <select
                    value={ticketStatusFilter}
                    onChange={(e) => setTicketStatusFilter(e.target.value)}
                    style={{
                      padding: '8px 10px',
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

                {/* View Mode Toggle: Cards vs Table */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '3px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}>
                  <button
                    onClick={() => setViewMode(viewMode === 'cards' ? 'auto' : 'cards')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 9px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: viewMode === 'cards' ? 'var(--accent-pink)' : 'transparent',
                      color: viewMode === 'cards' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    title="Hiển thị dạng thẻ (tối ưu không bị trượt ngang trên di động)"
                  >
                    <LayoutGrid size={14} />
                    <span>Thẻ</span>
                  </button>
                  <button
                    onClick={() => setViewMode(viewMode === 'table' ? 'auto' : 'table')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 9px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: viewMode === 'table' ? 'var(--accent-pink)' : 'transparent',
                      color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    title="Hiển thị dạng bảng dữ liệu đầy đủ"
                  >
                    <TableIcon size={14} />
                    <span>Bảng</span>
                  </button>
                </div>
              </div>
            </div>

            {/* DẠNG THẺ (CARDS) CHO VÉ - HOÀN TOÀN KHÔNG CÓ THANH TRƯỢT NGANG TRÊN MOBILE */}
            {(viewMode === 'cards' || viewMode === 'auto') && (
              <div
                className={viewMode === 'auto' ? 'admin-mobile-cards-auto' : ''}
                style={{
                  display: viewMode === 'cards' ? 'grid' : undefined,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
                  gap: '14px',
                  marginBottom: '20px'
                }}
              >
                {isLoadingTickets ? (
                  <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '36px 20px', textAlign: 'center', color: 'var(--text-dim)', borderRadius: 'var(--radius-lg)' }}>
                    Đang tải dữ liệu vé từ hệ thống database Supabase...
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '36px 20px', textAlign: 'center', color: 'var(--text-dim)', borderRadius: 'var(--radius-lg)' }}>
                    Không tìm thấy vé nào phù hợp với điều kiện tìm kiếm.
                  </div>
                ) : (
                  filteredTickets.map(tk => {
                    const targetEvent = events.find(e => e.id === tk.eventId);
                    return (
                      <div
                        key={tk.id || tk.ticketCode}
                        className="glass-panel"
                        style={{
                          borderRadius: 'var(--radius-lg)',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'var(--shadow-subtle)',
                          transition: 'var(--transition)'
                        }}
                      >
                        {/* Hàng 1: Mã vé + Trạng thái */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '13px',
                            color: 'var(--primary-light)',
                            backgroundColor: 'rgba(99, 102, 241, 0.12)',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(99, 102, 241, 0.25)'
                          }}>
                            {tk.ticketCode}
                          </span>

                          {tk.status === 'paid' && (
                            <span style={{
                              padding: '4px 9px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: 'var(--accent-emerald)',
                              fontSize: '11px',
                              fontWeight: 700,
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              Đã thanh toán
                            </span>
                          )}
                          {tk.status === 'checked-in' && (
                            <span style={{
                              padding: '4px 9px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'rgba(6, 182, 212, 0.15)',
                              color: 'var(--accent-cyan)',
                              fontSize: '11px',
                              fontWeight: 700,
                              border: '1px solid rgba(6, 182, 212, 0.3)'
                            }}>
                              Đã Check-in
                            </span>
                          )}
                          {tk.status === 'cancelled' && (
                            <span style={{
                              padding: '4px 9px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              fontSize: '11px',
                              fontWeight: 700,
                              border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}>
                              Đã hủy
                            </span>
                          )}
                        </div>

                        {/* Tiêu đề Sự kiện */}
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '2px', lineHeight: 1.4 }}>
                            {targetEvent ? targetEvent.title : (tk.eventTitle || 'Sự kiện hệ thống')}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                            {targetEvent ? `${targetEvent.date} • ${targetEvent.venue}` : (tk.purchaseDate || '')}
                          </div>
                        </div>

                        {/* Thông tin Khách hàng & Vị trí vé */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          fontSize: '12px'
                        }}>
                          <div>
                            <div style={{ color: 'var(--text-dim)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <User size={13} /> Khách hàng
                            </div>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{tk.customerName || 'Khách hàng'}</div>
                            <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>{tk.customerPhone || tk.customerEmail || 'N/A'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-dim)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Tag size={13} /> Hạng vé
                            </div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{tk.ticketType}</div>
                            <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>{tk.purchaseDate}</div>
                          </div>
                        </div>

                        {/* Giá tiền & Nút Soát vé Check-in */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: 'auto', paddingTop: '4px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Tổng tiền</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-pink)' }}>
                              {formatVND(tk.price)}
                            </div>
                          </div>

                          {tk.status === 'paid' ? (
                            <button
                              onClick={() => {
                                setTicketsList(prev => prev.map(t => t.ticketCode === tk.ticketCode ? { ...t, status: 'checked-in' } : t));
                                alert(`Đã Check-in thành công cho vé ${tk.ticketCode}!`);
                              }}
                              style={{
                                padding: '8px 16px',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: 'var(--accent-emerald)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <CheckCircle2 size={16} /> Soát vé
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-dim)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255, 255, 255, 0.04)' }}>
                              {tk.status === 'checked-in' ? '✓ Đã hoàn tất' : 'Vô hiệu'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* DẠNG BẢNG (TABLE) CHO VÉ - HIỂN THỊ MẶC ĐỊNH TRÊN DESKTOP */}
            {(viewMode === 'table' || viewMode === 'auto') && (
              <div
                className={viewMode === 'auto' ? 'admin-desktop-table-auto' : ''}
                style={{
                  display: viewMode === 'table' ? 'block' : undefined,
                  width: '100%',
                  maxWidth: '100%',
                  overflow: 'hidden'
                }}
              >
                <div className="glass-panel" style={{
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-subtle)',
                  width: '100%',
                  maxWidth: '100%'
                }}>
                  <div style={{
                    overflowX: 'auto',
                    width: '100%',
                    maxWidth: '100%',
                    WebkitOverflowScrolling: 'touch'
                  }}>
                    <table style={{
                      width: '100%',
                      minWidth: '920px',
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
          </div>
        )}
      </main>
      </div>

      {/* ================= MODAL THÊM / SỬA SỰ KIỆN ================= */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 'clamp(10px, 2.5vw, 24px)',
          boxSizing: 'border-box'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '720px',
            width: '100%',
            maxHeight: '92dvh',
            overflowY: 'auto',
            borderRadius: 'var(--radius-xl)',
            padding: 'clamp(16px, 3.5vw, 32px)',
            border: '1px solid var(--border-glow)',
            boxSizing: 'border-box'
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

              {/* Cấu hình giá & Số ghế / Vé: Phân tách Seated-based vs Zone-based */}
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
                        Cấu hình Sơ đồ Ghế ngồi (Seated-based)
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
                    💡 Nhập số hàng và số ghế mỗi hàng để tạo sơ đồ ghế ngồi tự động. Chuẩn thiết kế là 12 ghế/hàng để hiển thị đồng nhất không bị cuộn ngang.
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
                        placeholder="VD: 500000"
                        value={formData.seatPrice !== undefined && formData.seatPrice !== null ? formData.seatPrice : (formData.minPrice ?? 500000)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = raw === '' ? '' : Number(raw);
                          const numVal = val === '' ? 0 : val;
                          setFormData({
                            ...formData,
                            seatPrice: val,
                            minPrice: numVal,
                            maxPrice: numVal,
                            min_price: `${numVal.toFixed(2)}`,
                            max_price: `${numVal.toFixed(2)}`
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

                  {/* Nhập số ghế / hàng và tổng số ghế */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Số hàng ghế (A - Z) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="26"
                        required
                        value={formData.rowsCount || 7}
                        onChange={(e) => {
                          const r = Math.max(1, Number(e.target.value));
                          const s = Number(formData.seatsPerRow) || 12;
                          setFormData({
                            ...formData,
                            rowsCount: r,
                            totalSeats: r * s
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
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                        Hàng A đến {String.fromCharCode(64 + Math.min(26, Number(formData.rowsCount) || 7))}
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Số ghế mỗi hàng *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        required
                        value={formData.seatsPerRow || 12}
                        onChange={(e) => {
                          const s = Math.max(1, Number(e.target.value));
                          const r = Number(formData.rowsCount) || 7;
                          setFormData({
                            ...formData,
                            seatsPerRow: s,
                            totalSeats: r * s
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
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                        Ghế số 1 đến {formData.seatsPerRow || 12}
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Tổng số ghế phát hành *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.totalSeats || ((formData.rowsCount || 7) * (formData.seatsPerRow || 12))}
                        onChange={(e) => {
                          const tot = Math.max(1, Number(e.target.value));
                          const s = Number(formData.seatsPerRow) || 12;
                          setFormData({
                            ...formData,
                            totalSeats: tot,
                            rowsCount: Math.ceil(tot / s)
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--accent-pink)',
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: 700
                        }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--accent-pink)', marginTop: '4px', display: 'block' }}>
                        Tự động chia đều theo các hàng
                      </span>
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
                      Quy mô dự kiến: <strong style={{ color: '#fff' }}>{formData.totalSeats || ((formData.rowsCount || 7) * (formData.seatsPerRow || 12))} ghế ngồi</strong> ({formData.rowsCount || 7} hàng A-{String.fromCharCode(64 + Math.min(26, Number(formData.rowsCount) || 7))}, {formData.seatsPerRow || 12} ghế/hàng)
                    </span>
                    <span style={{ color: 'var(--accent-pink)', fontWeight: 700 }}>
                      Giá bán: {formatVND(formData.seatPrice || formData.minPrice || 500000)} / vé
                    </span>
                  </div>
                </div>
              ) : (
                /* Cấu hình các khu vực & Số lượng vé cho Zone-based */
                <div style={{
                  padding: '18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={18} color="var(--accent-emerald)" />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                        Cấu hình Khu vực & Số lượng vé (Zone-based)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddZone}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        color: 'var(--accent-emerald)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={14} /> Thêm khu vực
                    </button>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    💡 Nhập tên khu vực, số lượng vé (sức chứa) và giá vé tương ứng. Số lượng vé này sẽ đồng bộ trực tiếp lên trang chi tiết sự kiện.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(formData.zones || []).map((z, idx) => (
                      <div
                        key={z.id || idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr)) auto',
                          gap: '10px',
                          alignItems: 'center',
                          padding: '12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '3px' }}>Tên khu vực</label>
                          <input
                            type="text"
                            required
                            value={z.name}
                            onChange={(e) => handleZoneChange(idx, 'name', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              color: '#fff',
                              fontSize: '13px'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '3px' }}>Số lượng vé (Sức chứa) *</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={z.total || z.remaining || 50}
                            onChange={(e) => handleZoneChange(idx, 'total', Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px solid var(--accent-pink)',
                              color: '#fff',
                              fontSize: '13px',
                              fontWeight: 700
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '3px' }}>Giá vé (VNĐ) *</label>
                          <input
                            type="number"
                            step="10000"
                            required
                            value={z.price}
                            onChange={(e) => handleZoneChange(idx, 'price', Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              color: '#fff',
                              fontSize: '13px'
                            }}
                          />
                        </div>

                        {(formData.zones || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveZone(idx)}
                            title="Xóa khu vực này"
                            style={{
                              padding: '8px',
                              marginTop: '16px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
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
                      Tổng số vé phát hành: <strong style={{ color: 'var(--accent-emerald)' }}>
                        {(formData.zones || []).reduce((sum, z) => sum + (Number(z.total || z.remaining) || 0), 0)} vé
                      </strong>
                    </span>
                    <span style={{ color: 'var(--accent-pink)', fontWeight: 700 }}>
                      {(formData.zones || []).length} khu vực
                    </span>
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
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          padding: 'clamp(10px, 2.5vw, 20px)',
          boxSizing: 'border-box'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '420px',
            width: '100%',
            borderRadius: 'var(--radius-lg)',
            padding: 'clamp(18px, 4vw, 28px)',
            textAlign: 'center',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxSizing: 'border-box'
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
            width: min(280px, 85vw) !important;
            min-width: 0 !important;
            z-index: 100 !important;
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
            box-shadow: 0 0 50px rgba(0, 0, 0, 0.85);
            overflow-y: auto;
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
        /* Tự động chuyển đổi giữa Thẻ (Mobile/Tablet) và Bảng (Desktop) khi viewMode là auto */
        @media (max-width: 959px) {
          .admin-desktop-table-auto {
            display: none !important;
          }
          .admin-mobile-cards-auto {
            display: grid !important;
          }
        }
        @media (min-width: 960px) {
          .admin-desktop-table-auto {
            display: block !important;
          }
          .admin-mobile-cards-auto {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
