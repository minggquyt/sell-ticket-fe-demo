import React, { useState } from 'react';
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
  Hash
} from 'lucide-react';
import { CATEGORIES } from '../data/events';

// Dữ liệu mẫu danh sách vé đã đặt để quản lý vé
const INITIAL_MOCK_TICKETS = [
  {
    ticketCode: 'TK-VN98231',
    eventId: 'ev-1',
    customerName: 'Nguyễn Văn An',
    customerPhone: '0912 345 678',
    ticketType: 'VIP Crown (Ghế A-12)',
    purchaseDate: '10/10/2026 14:30',
    price: 2500000,
    status: 'paid' // paid | checked-in | cancelled
  },
  {
    ticketCode: 'TK-VN89211',
    eventId: 'ev-1',
    customerName: 'Trần Thị Thu Hà',
    customerPhone: '0988 777 666',
    ticketType: 'Gold Standard (Ghế C-04)',
    purchaseDate: '09/10/2026 09:15',
    price: 1800000,
    status: 'paid'
  },
  {
    ticketCode: 'TK-VN66723',
    eventId: 'ev-2',
    customerName: 'Lê Hoàng Nam',
    customerPhone: '0903 112 233',
    ticketType: 'Khu vực GA Standing (Zone-based)',
    purchaseDate: '08/10/2026 18:20',
    price: 450000,
    status: 'checked-in'
  },
  {
    ticketCode: 'TK-VN77812',
    eventId: 'ev-3',
    customerName: 'Phạm Minh Đức',
    customerPhone: '0977 889 900',
    ticketType: 'VIP Crown (Ghế B-08)',
    purchaseDate: '07/10/2026 11:00',
    price: 1800000,
    status: 'paid'
  },
  {
    ticketCode: 'TK-VN55410',
    eventId: 'ev-4',
    customerName: 'Vũ Thùy Linh',
    customerPhone: '0934 556 778',
    ticketType: 'Khu vực VIP Lounge (Zone-based)',
    purchaseDate: '06/10/2026 20:45',
    price: 1500000,
    status: 'cancelled'
  },
  {
    ticketCode: 'TK-VN99120',
    eventId: 'ev-2',
    customerName: 'Hoàng Anh Tuấn',
    customerPhone: '0918 223 344',
    ticketType: 'Khu vực GA Standing (Zone-based)',
    purchaseDate: '05/10/2026 16:10',
    price: 450000,
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
  const [ticketsList, setTicketsList] = useState(INITIAL_MOCK_TICKETS);

  // Form State Sự kiện
  const initialForm = {
    title: '',
    category: 'Âm nhạc',
    type: 'seated', // 'seated' | 'zone'
    status: 'ongoing', // 'ongoing' | 'upcoming'
    date: '',
    time: '19:30 - 22:30',
    venue: '',
    minPrice: 500000,
    maxPrice: 2000000,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    banner: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    organizer: '',
    description: '',
    seatTiers: [
      { id: 'vip', name: 'VIP Crown', price: 2000000, color: '#ec4899', rows: ['A', 'B'] },
      { id: 'gold', name: 'Gold Standard', price: 1200000, color: '#3b82f6', rows: ['C', 'D'] },
      { id: 'silver', name: 'Silver Regular', price: 500000, color: '#10b981', rows: ['E', 'F'] }
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
    const matchSearch = ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        ev.venue.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'all' || ev.type === filterType;
    return matchSearch && matchType;
  });

  // Lọc vé theo tên người mua, mã vé, sự kiện và trạng thái
  const filteredTickets = ticketsList.filter(tk => {
    const ev = events.find(e => e.id === tk.eventId);
    const eventTitle = ev ? ev.title.toLowerCase() : '';
    const query = ticketSearch.toLowerCase();
    
    const matchQuery = !ticketSearch || 
      tk.ticketCode.toLowerCase().includes(query) ||
      tk.customerName.toLowerCase().includes(query) ||
      tk.customerPhone.toLowerCase().includes(query) ||
      eventTitle.includes(query);

    const matchEvent = ticketEventFilter === 'all' || tk.eventId === ticketEventFilter;
    const matchStatus = ticketStatusFilter === 'all' || tk.status === ticketStatusFilter;

    return matchQuery && matchEvent && matchStatus;
  });

  const handleOpenAddModal = () => {
    setEditingEvent(null);
    setFormData({
      ...initialForm,
      date: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ev) => {
    setEditingEvent(ev);
    setFormData({
      ...ev,
      seatTiers: ev.seatTiers || initialForm.seatTiers,
      zones: ev.zones || initialForm.zones
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.venue || !formData.date) {
      alert('Vui lòng điền đầy đủ Tên sự kiện, Địa điểm và Ngày diễn ra!');
      return;
    }

    if (editingEvent) {
      onUpdateEvent({
        ...formData,
        id: editingEvent.id
      });
    } else {
      const newId = `ev-${Date.now()}`;
      onAddEvent({
        ...formData,
        id: newId
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
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-main)'
    }}>
      {/* ================= ASIDE BÊN TRÁI ================= */}
      <aside style={{
        width: '280px',
        minWidth: '280px',
        backgroundColor: '#0a0d16',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 40
      }}>
        {/* Trên cùng: Logo và Tên web */}
        <div 
          onClick={() => onNavigate && onNavigate('events')}
          style={{
            padding: '24px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            userSelect: 'none'
          }}
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
            onClick={() => setActiveTab('events')}
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
            onClick={() => setActiveTab('tickets')}
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

          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '12px 0' }} />

          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            padding: '0 12px 6px'
          }}>
            Điều hướng công khai
          </div>

          <button
            onClick={() => onNavigate && onNavigate('events')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid transparent',
              fontWeight: 600,
              fontSize: '14px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Compass size={19} color="var(--accent-cyan)" />
            <span>Xem trang sự kiện</span>
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
        padding: '32px 36px',
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
                  <option value="seated">Seated-based ({events.filter(e => e.type === 'seated').length})</option>
                  <option value="zone">Zone-based ({events.filter(e => e.type === 'zone').length})</option>
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
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '160px', whiteSpace: 'nowrap' }}>TRẠNG THÁI</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '220px' }}>NGÀY & ĐỊA ĐIỂM</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, width: '180px' }}>GIÁ TỐI THIỂU</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'right', width: '140px' }}>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
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
                            <span className={ev.type === 'seated' ? 'badge-type-seated' : 'badge-type-zone'} style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '12px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}>
                              {ev.type === 'seated' ? <Armchair size={13} /> : <Layers size={13} />}
                              {ev.type === 'seated' ? 'Seated-based' : 'Zone-based'}
                            </span>
                          </td>

                          {/* Trạng thái badge */}
                          <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                            <span className={ev.status === 'ongoing' ? 'badge-status-ongoing' : 'badge-status-upcoming'} style={{
                              padding: '5px 12px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '11px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}>
                              {ev.status === 'ongoing' ? 'Đang mở bán' : 'Sắp diễn ra'}
                            </span>
                          </td>

                          {/* Ngày & Địa điểm */}
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ fontSize: '13px', color: '#fff', marginBottom: '2px' }}>{ev.date}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-dim)', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ev.venue}
                            </div>
                          </td>

                          {/* Giá vé */}
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--accent-pink)' }}>
                              {formatVND(ev.minPrice)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                              đến {formatVND(ev.maxPrice || ev.minPrice)}
                            </div>
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

              {/* Nút check-in nhanh demo */}
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
                    {filteredTickets.length === 0 ? (
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
                            key={tk.ticketCode}
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
                                {targetEvent ? targetEvent.title : 'Sự kiện hệ thống'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                {targetEvent ? `${targetEvent.date} • ${targetEvent.venue}` : ''}
                              </div>
                            </td>

                            {/* Người mua */}
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ fontWeight: 600, color: '#fff' }}>{tk.customerName}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{tk.customerPhone}</div>
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

      {/* ================= MODAL THÊM / SỬA SỰ KIỆN ================= */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Loại hình đặt vé *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
                    <option value="seated">Seated-based (Chọn từng ghế, max 5 ghế)</option>
                    <option value="zone">Zone-based (Chọn khu vực vé, max 5 vé)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Trạng thái mở bán *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                    <option value="ongoing">Đang mở bán vé</option>
                    <option value="upcoming">Sắp diễn ra</option>
                  </select>
                </div>
              </div>

              {/* Thể loại & Ban tổ chức */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Ngày diễn ra *
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
                    Địa điểm tổ chức *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: SECC Quận 7, TP.HCM"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
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

              {/* Giá vé tối thiểu & tối đa */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Giá vé tối thiểu (VNĐ) *
                  </label>
                  <input
                    type="number"
                    required
                    step="50000"
                    value={formData.minPrice}
                    onChange={(e) => setFormData({ ...formData, minPrice: Number(e.target.value) })}
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
                    onChange={(e) => setFormData({ ...formData, maxPrice: Number(e.target.value) })}
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
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
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
    </div>
  );
}
