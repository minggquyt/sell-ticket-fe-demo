import { useState, useEffect } from 'react';
import { fetchAdminTickets, fetchSeatsByEvent } from '../services/eventService';
import { useToast } from '../components/toastContext.js';
import AdminSidebar from '../components/AdminSidebar.jsx';
import AdminEventsTab from '../components/AdminEventsTab.jsx';
import AdminTicketsTab from '../components/AdminTicketsTab.jsx';
import EventFormModal from '../components/EventFormModal.jsx';
import './AdminPage.css';
import { AlertCircle, Ticket, Menu } from 'lucide-react';
import {
  formatEventDate,
  isSeatedEvent,
  getEventVenue,
  getMinPrice,
  getMaxPrice,
  getSingleSeatTier,
} from '../data/events';
import { getRowLetter, deriveSeatLayout } from '../utils/seatLayout.js';

export default function AdminPage({
  events,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onViewEvent,
  onNavigate,
  user,
  onLogout,
}) {
  const toast = useToast();
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
    image:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    banner:
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    thumbnails: [
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    ],
    organizer: '',
    description: '',
    seatTiers: [
      {
        id: 'standard',
        name: 'Ghế tiêu chuẩn',
        price: 500000,
        color: '#6366f1',
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        // HERE 
      },
    ],
    zones: [
      {
        id: 'z-ga',
        name: 'Khu vực GA Standing',
        price: 500000,
        description: 'Vé đứng tự do',
        total: 150,
        remaining: 150,
        color: '#10b981',
      },
      {
        id: 'z-vip',
        name: 'Khu vực VIP Lounge',
        price: 1800000,
        description: 'Vé đứng khu vực ưu tiên',
        total: 40,
        remaining: 40,
        color: '#ec4899',
      },
    ],
  };

  const [formData, setFormData] = useState(initialForm);

  // Lọc sự kiện
  const filteredEvents = events.filter((ev) => {
    const isSeated = isSeatedEvent(ev);
    const evVenue = getEventVenue(ev);
    const matchSearch =
      ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
  const filteredTickets = ticketsList.filter((tk) => {
    const ev = events.find((e) => e.id === tk.eventId);
    const eventTitle = ev ? ev.title.toLowerCase() : (tk.eventTitle || '').toLowerCase();
    const query = ticketSearch.toLowerCase();

    const matchQuery =
      !ticketSearch ||
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
      start_time: today.toISOString(),
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

    // Layout ghế (H1): chỉ lấy tạm số backend trả về theo sự kiện (nếu có);
    // danh sách ghế thật tải về ngay sau đó sẽ ghi đè bằng layout suy từ ghế.
    const rowsCount = ev.rowsCount || ev.seatConfig?.rowsCount || '';
    const seatsPerRow = ev.seatsPerRow || ev.seatConfig?.seatsPerRow || '';
    const totalSeats = ev.totalSeats || ev.seatConfig?.totalSeats || '';

    const price =
      evMinPrice > 0
        ? evMinPrice
        : singleTier.price > 0
          ? singleTier.price
          : Number(ev.seatPrice) > 0
            ? Number(ev.seatPrice)
            : 500000;
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
          rows: singleTier.rows?.length
            ? singleTier.rows
            : Array.from({ length: Number(rowsCount) || 0 }, (_, i) => getRowLetter(i)),
        },
      ],
      zones: ev.zones || initialForm.zones,
    });
    setIsModalOpen(true);

    if (ev.id) {
      fetchSeatsByEvent(ev.id)
        .then((seats) => {
          if (!seats || seats.length === 0) return;
          if (!isSeated) {
            const zoneMap = {};
            seats.forEach((s) => {
              const zName = (s.zone_name || 'STANDARD').toUpperCase();
              if (!zoneMap[zName]) {
                zoneMap[zName] = {
                  id: `z-${zName.toLowerCase()}`,
                  name: zName,
                  price: Number(s.price || 0),
                  description: 'Vé đứng tự do',
                  total: 0,
                  remaining: 0,
                  color: '#10b981',
                };
              }
              zoneMap[zName].total += 1;
              if (s.status === 'AVAILABLE') {
                zoneMap[zName].remaining += 1;
              }
            });
            const loadedZones = Object.values(zoneMap);
            if (loadedZones.length > 0) {
              const zPrices = loadedZones.map((z) => z.price).filter((p) => p > 0);
              const loadedMinP = zPrices.length > 0 ? Math.min(...zPrices) : price;
              const loadedMaxP = zPrices.length > 0 ? Math.max(...zPrices) : maxP;
              setFormData((prev) => ({
                ...prev,
                zones: loadedZones,
                minPrice: loadedMinP,
                maxPrice: loadedMaxP,
                min_price: `${loadedMinP.toFixed(2)}`,
                max_price: `${loadedMaxP.toFixed(2)}`,
              }));
            }
          } else {
            // H1: suy layout (số hàng, ghế mỗi hàng, tổng ghế) từ ghế thật của backend
            const layout = deriveSeatLayout(seats);
            const actualSeatPrice = Number(seats[0]?.price) > 0 ? Number(seats[0].price) : 0;
            setFormData((prev) => ({
              ...prev,
              ...(actualSeatPrice > 0
                ? {
                    seatPrice: actualSeatPrice,
                    minPrice: actualSeatPrice,
                    maxPrice: actualSeatPrice,
                    min_price: `${actualSeatPrice.toFixed(2)}`,
                    max_price: `${actualSeatPrice.toFixed(2)}`,
                  }
                : {}),
              ...(layout.rowsCount > 0
                ? {
                    rowsCount: layout.rowsCount,
                    seatsPerRow: layout.seatsPerRow,
                    totalSeats: layout.totalSeats,
                    seatTiers: [
                      {
                        ...(prev.seatTiers?.[0] || {}),
                        rows: layout.rows.map((r) => r.letter),
                      },
                    ],
                  }
                : {}),
            }));
          }
        })
        .catch((err) => console.warn('Could not sync seat/zone details for edit modal:', err));
    }
  };

  // Helper quản lý danh sách Zone cho Zone-based
  const handleZoneChange = (index, field, value) => {
    setFormData((prev) => {
      const newZones = [...(prev.zones || [])];
      newZones[index] = { ...newZones[index], [field]: value };
      if (field === 'total') {
        const numVal = value === '' || value == null ? 0 : Number(value);
        newZones[index].remaining = isNaN(numVal) ? 0 : numVal;
      }
      return { ...prev, zones: newZones };
    });
  };

  const handleAddZone = () => {
    setFormData((prev) => ({
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
          color: '#10b981',
        },
      ],
    }));
  };

  const handleRemoveZone = (index) => {
    setFormData((prev) => {
      const newZones = (prev.zones || []).filter((_, i) => i !== index);
      return { ...prev, zones: newZones };
    });
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    const loc = formData.location || formData.venue;
    if (!formData.title || !loc || !formData.date) {
      toast.warning('Vui lòng điền đầy đủ Tên sự kiện, Địa điểm và Ngày diễn ra!');
      return;
    }

    const isSeated = formData.event_type === 'SEAT_BASED' || formData.type === 'seated';
    let payload;

    if (isSeated) {
      const rowsCount =
        formData.rowsCount === '' || formData.rowsCount == null ? 0 : Number(formData.rowsCount);
      const seatsPerRow =
        formData.seatsPerRow === '' || formData.seatsPerRow == null
          ? 0
          : Number(formData.seatsPerRow);

      if (rowsCount < 2) {
        toast.warning(
          `Số hàng ghế không hợp lệ! Vui lòng nhập tối thiểu 2 hàng ghế (hiện tại: ${rowsCount}).`,
        );
        return;
      }

      if (seatsPerRow < 3) {
        toast.warning(
          `Số ghế mỗi hàng không hợp lệ! Vui lòng nhập tối thiểu 3 ghế cho mỗi hàng (hiện tại: ${seatsPerRow}).`,
        );
        return;
      }

      // Seated-based: Cấu hình số ghế theo hàng x cột
      const price = Number(
        formData.seatPrice !== '' && formData.seatPrice != null
          ? formData.seatPrice
          : formData.minPrice || 500000,
      );
      const tierName = formData.seatTierName || 'Ghế tiêu chuẩn';
      const tierColor = formData.seatColor || '#6366f1';
      const totalSeats = Number(formData.totalSeats) || rowsCount * seatsPerRow;
      const rowLetters = Array.from({ length: rowsCount }, (_, i) => getRowLetter(i));

      const singleTier = {
        id: 'standard',
        name: tierName,
        price,
        color: tierColor,
        rows: rowLetters,
      };

      const seatConfig = {
        totalSeats,
        rowsCount,
        seatsPerRow,
        price,
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
        seatPrice: price,
        totalSeats,
        rowsCount,
        seatsPerRow,
        seatConfig,
        seatTiers: [singleTier],
        thumbnails: formData.thumbnails || [formData.image],
        // Không còn nhét chuỗi LAYOUT: vào highlights (H1); bộ lọc giữ lại để
        // dọn các chuỗi LAYOUT: cũ còn sót trong dữ liệu khi lưu lại sự kiện.
        highlights: (
          formData.highlights || [
            'Sơ đồ ghế đồng giá cho toàn bộ vị trí',
            'Trải nghiệm âm thanh và ánh sáng chuẩn quốc tế',
            'Check-in bằng mã vé điện tử QR nhanh chóng',
          ]
        ).filter((h) => typeof h !== 'string' || !h.startsWith('LAYOUT:')),
        rules: formData.rules || [
          'Không mang thức ăn, nước uống từ bên ngoài.',
          'Vui lòng có mặt trước giờ diễn 30 phút để làm thủ tục check-in.',
        ],
      };
    } else {
      const zones = formData.zones || [];
      if (zones.length === 0) {
        toast.warning('Vui lòng thêm ít nhất một khu vực cho sự kiện dạng Zone-based!');
        return;
      }

      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        const count = z.total === '' || z.total == null ? 0 : Number(z.total);
        if (count < 50) {
          toast.warning(
            `Khu vực "${z.name || `Khu vực ${i + 1}`}" có số lượng vé không hợp lệ! Mỗi khu vực phải có tối thiểu 50 vé (hiện tại: ${count}).`,
          );
          return;
        }
      }

      const zoneConfigs = zones.map((z) => ({
        zoneName: (z.name || z.zoneName || 'STANDARD').toUpperCase(),
        count: z.total === '' || z.total == null ? 0 : Number(z.total),
        price: Number(z.price || formData.minPrice || 500000),
      }));
      const totalTickets = zoneConfigs.reduce((sum, z) => sum + z.count, 0);
      const minP =
        zoneConfigs.length > 0
          ? Math.min(...zoneConfigs.map((z) => z.price))
          : Number(formData.minPrice || 500000);
      const maxP =
        zoneConfigs.length > 0
          ? Math.max(...zoneConfigs.map((z) => z.price))
          : Number(formData.maxPrice || minP);

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
        zones: zones.map((z) => {
          const c = z.total === '' || z.total == null ? 0 : Number(z.total);
          return {
            ...z,
            total: c,
            remaining: c,
          };
        }),
        thumbnails: formData.thumbnails || [formData.image],
        highlights: formData.highlights || [
          'Khu vực đứng tự do bùng nổ năng lượng',
          'Hiệu ứng âm thanh và laser hiện đại',
        ],
        rules: formData.rules || [
          'Không mang vật sắc nhọn, chất cấm vào sự kiện.',
          'Vòng tay check-in không tháo rời trong sự kiện.',
        ],
      };
    }

    if (editingEvent) {
      onUpdateEvent({
        ...payload,
        id: editingEvent.id,
      });
    } else {
      const newId = `22222222-2222-2222-2222-${Date.now().toString().slice(-12)}`;
      onAddEvent({
        ...payload,
        id: newId,
        created_at: new Date().toISOString(),
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    onDeleteEvent(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="admin-root">
      {/* Mobile Topbar for screens < 1024px */}
      <header className="admin-mobile-topbar">
        <div className="admin-topbar-left">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="admin-topbar-menu-btn"
            aria-label="Mở menu quản trị"
          >
            <Menu size={19} />
          </button>
          <div className="admin-topbar-logo">
            <div className="admin-topbar-logo-icon">
              <Ticket size={15} color="#ffffff" />
            </div>
            <div className="admin-topbar-logo-text">
              <span className="admin-topbar-title">
                Ticket<span className="admin-topbar-verse">Verse</span>
              </span>
              <span className="admin-topbar-badge">ADMIN</span>
            </div>
          </div>
        </div>

        {/* Quick Tab pills on mobile topbar */}
        <div className="admin-topbar-pills">
          <button
            onClick={() => {
              setActiveTab('events');
              setIsMobileSidebarOpen(false);
            }}
            className={`admin-pill${activeTab === 'events' ? ' active-indigo' : ''}`}
          >
            Sự kiện
          </button>
          <button
            onClick={() => {
              setActiveTab('tickets');
              setIsMobileSidebarOpen(false);
            }}
            className={`admin-pill${activeTab === 'tickets' ? ' active-pink' : ''}`}
          >
            Vé ({ticketsList.length})
          </button>
        </div>
      </header>

      {/* Main layout row */}
      <div className="admin-layout-row">
        {/* Mobile backdrop */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="admin-sidebar-backdrop animate-fade-in"
          />
        )}

        {/* ================= ASIDE BÊN TRÁI (tách ở Phần 3c) ================= */}
        <AdminSidebar
          user={user}
          activeTab={activeTab}
          eventsCount={events.length}
          ticketsCount={ticketsList.length}
          isMobileSidebarOpen={isMobileSidebarOpen}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setIsMobileSidebarOpen(false);
          }}
          onClose={() => setIsMobileSidebarOpen(false)}
          onLogout={onLogout}
          onNavigate={onNavigate}
        />

        {/* ================= NỘI DUNG CHÍNH (MAIN CONTENT) ================= */}
        <main className="admin-main-content">
          {/* ================= TAB 1: QUẢN LÝ SỰ KIỆN (tách ở Phần 3c) ================= */}
          {activeTab === 'events' && (
            <AdminEventsTab
              events={events}
              filteredEvents={filteredEvents}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterType={filterType}
              setFilterType={setFilterType}
              viewMode={viewMode}
              setViewMode={setViewMode}
              handleOpenAddModal={handleOpenAddModal}
              handleOpenEditModal={handleOpenEditModal}
              setDeleteConfirmId={setDeleteConfirmId}
              onViewEvent={onViewEvent}
            />
          )}

          {/* ================= TAB 2: QUẢN LÝ VÉ (tách ở Phần 3c) ================= */}
          {activeTab === 'tickets' && (
            <AdminTicketsTab
              events={events}
              ticketsList={ticketsList}
              setTicketsList={setTicketsList}
              filteredTickets={filteredTickets}
              ticketSearch={ticketSearch}
              setTicketSearch={setTicketSearch}
              ticketEventFilter={ticketEventFilter}
              setTicketEventFilter={setTicketEventFilter}
              ticketStatusFilter={ticketStatusFilter}
              setTicketStatusFilter={setTicketStatusFilter}
              viewMode={viewMode}
              setViewMode={setViewMode}
              isLoadingTickets={isLoadingTickets}
              loadTickets={loadTickets}
            />
          )}
        </main>
      </div>

      {/* ================= MODAL THÊM / SỬA SỰ KIỆN (tách ở Phần 3c) ================= */}
      {isModalOpen && (
        <EventFormModal
          editingEvent={editingEvent}
          formData={formData}
          setFormData={setFormData}
          setIsModalOpen={setIsModalOpen}
          handleZoneChange={handleZoneChange}
          handleAddZone={handleAddZone}
          handleRemoveZone={handleRemoveZone}
          handleSubmitForm={handleSubmitForm}
        />
      )}

      {/* ================= MODAL XÁC NHẬN XÓA ================= */}
      {deleteConfirmId && (
        <div className="admin-delete-overlay">
          <div className="glass-panel animate-fade-in admin-delete-card">
            <div className="admin-delete-icon">
              <AlertCircle size={28} />
            </div>

            <h3 className="admin-delete-title">Xác nhận xóa sự kiện?</h3>
            <p className="admin-delete-text">
              Hành động này không thể hoàn tác và sự kiện sẽ bị gỡ bỏ khỏi toàn bộ danh sách vé.
            </p>

            <div className="admin-delete-actions">
              <button onClick={() => setDeleteConfirmId(null)} className="admin-delete-cancel">
                Hủy bỏ
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="admin-delete-confirm"
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
