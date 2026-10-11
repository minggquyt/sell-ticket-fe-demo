export const MOCK_EVENTS = [
  {
    id: "ev-1",
    title: "Chân Trời Rực Rỡ Live Concert - Hà Anh Tuấn & Kitaro",
    type: "seated", // 'seated' | 'zone'
    status: "ongoing", // 'ongoing' | 'upcoming'
    category: "Âm nhạc",
    date: "15 Tháng 11, 2026",
    time: "19:30 - 23:00",
    venue: "Trung tâm Hội nghị Quốc gia, Hà Nội",
    minPrice: 900000,
    maxPrice: 4500000,
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    banner: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80",
    organizer: "Viet Vision Entertainment",
    description: `Đêm đại nhạc hội đỉnh cao quy tụ huyền thoại âm nhạc New Age thế giới Kitaro cùng ca sĩ Hà Anh Tuấn. Một hành trình cảm xúc hoành tráng đưa khán giả qua từng cung bậc nghệ thuật và thiên nhiên kỳ vĩ.
    Hệ thống âm thanh L-Acoustics K1 chuẩn quốc tế cùng visual sân khấu 360 độ mãn nhãn.`,
    highlights: [
      "Trình diễn trực tiếp cùng dàn nhạc giao hưởng 60 nghệ sĩ",
      "Sân khấu thiết kế hiệu ứng ánh sáng Hologram 4D",
      "Tặng kèm bộ quà kỷ niệm độc quyền cho các hạng vé VIP"
    ],
    rules: [
      "Không mang theo đồ ăn, thức uống từ bên ngoài.",
      "Trẻ em dưới 6 tuổi không được tham gia sự kiện.",
      "Vui lòng có mặt trước giờ diễn ít nhất 45 phút để làm thủ tục check-in."
    ],
    seatTiers: [
      { id: "vip", name: "Super VIP", price: 4500000, color: "#ec4899", rows: ["A", "B"] },
      { id: "platinum", name: "Platinum", price: 2800000, color: "#8b5cf6", rows: ["C", "D"] },
      { id: "gold", name: "Gold Standard", price: 1600000, color: "#3b82f6", rows: ["E", "F", "G"] },
      { id: "silver", name: "Silver Balcony", price: 900000, color: "#10b981", rows: ["H", "I"] }
    ]
  },
  {
    id: "ev-2",
    title: "Ravolution EDM Music Festival 2026 - Beyond The Galaxy",
    type: "zone",
    status: "ongoing",
    category: "Lễ hội",
    date: "28 Tháng 11, 2026",
    time: "15:00 - 23:59",
    venue: "SECC - Trung tâm Triển lãm & Hội chợ Sài Gòn, Q.7, TP.HCM",
    minPrice: 650000,
    maxPrice: 3200000,
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
    banner: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1600&q=80",
    organizer: "Anternation & Ravolution Asia",
    description: `Lễ hội âm nhạc điện tử thường niên quy mô lớn nhất Việt Nam. Năm 2026 với chủ đề 'Beyond The Galaxy' quy tụ Top 100 DJ Mag danh tiếng, hệ thống laser và pháo hoa đẳng cấp thế giới. Không gian tự do bùng nổ năng lượng cùng hàng chục ngàn Ravers!`,
    highlights: [
      "Dàn Headliner: Martin Garrix, Alesso và các DJ hàng đầu",
      "Khu vực F&B và Merch phong phú xuyên đêm",
      "Trải nghiệm vòng quay vô cực và đường trượt tương tác ánh sáng"
    ],
    rules: [
      "Sự kiện dành cho độ tuổi từ 18 trở lên (mang theo CCCD/Hộ chiếu).",
      "Nghiêm cấm các chất kích thích và vật sắc nhọn gây cháy nổ.",
      "Vòng tay check-in không được tháo rời trong suốt thời gian diễn ra lễ hội."
    ],
    zones: [
      {
        id: "z-ga",
        name: "GA - General Admission",
        price: 650000,
        description: "Khu vực đứng tự do tại cánh sân khấu chính, tiếp cận dễ dàng khu ẩm thực.",
        remaining: 120,
        color: "#10b981"
      },
      {
        id: "z-fanzone",
        name: "Fanzone Stage Front",
        price: 1450000,
        description: "Khu vực sát hàng rào sân khấu, tận hưởng trọn vẹn dàn loa Bass và hiệu ứng CO2.",
        remaining: 45,
        color: "#3b82f6"
      },
      {
        id: "z-vip",
        name: "VIP Lounge Deck (Standing)",
        price: 3200000,
        description: "Bục ngắm nâng cao toàn cảnh sân khấu, lối check-in ưu tiên riêng và 2 đồ uống miễn phí.",
        remaining: 18,
        color: "#ec4899"
      }
    ]
  },
  {
    id: "ev-3",
    title: "Vũ Cát Tường - The Inner Light Acoustic Concert",
    type: "seated",
    status: "upcoming",
    category: "Âm nhạc",
    date: "12 Tháng 12, 2026",
    time: "20:00 - 22:30",
    venue: "Nhà hát Hòa Bình, TP.HCM",
    minPrice: 750000,
    maxPrice: 3500000,
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    banner: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80",
    organizer: "Vector Entertainment",
    description: `Đêm nhạc mộc mạc lắng đọng cùng giọng ca đầy nội lực Vũ Cát Tường. Tất cả các bản hit được phối khí hoàn toàn mới theo phong cách Acoustic & Chamber Pop.`,
    highlights: [
      "Toàn bộ ghế ngồi đệm nhung cao cấp của Nhà hát",
      "Không gian thưởng thức âm thanh tinh tế và cảm xúc",
      "Giao lưu thân mật và ký tặng album sau đêm diễn"
    ],
    rules: [
      "Vui lòng tắt chuông điện thoại trong suốt buổi biểu diễn.",
      "Không livestream hoặc quay phim chuyên nghiệp."
    ],
    seatTiers: [
      { id: "vip", name: "VIP Crown", price: 3500000, color: "#ec4899", rows: ["A", "B"] },
      { id: "gold", name: "Gold Seat", price: 1800000, color: "#3b82f6", rows: ["C", "D", "E"] },
      { id: "silver", name: "Silver Standard", price: 750000, color: "#10b981", rows: ["F", "G"] }
    ]
  },
  {
    id: "ev-4",
    title: "Tech Innovators Summit & AI Expo Vietnam 2026",
    type: "zone",
    status: "upcoming",
    category: "Hội thảo",
    date: "20 Tháng 12, 2026",
    time: "08:30 - 17:30",
    venue: "JW Marriott Hotel Hanoi",
    minPrice: 500000,
    maxPrice: 2500000,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80",
    banner: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1600&q=80",
    organizer: "Vietnam Tech Network",
    description: `Hội nghị công nghệ và trí tuệ nhân tạo quy tụ hơn 50 diễn giả hàng đầu từ Google, Microsoft, OpenAI và các tập đoàn công nghệ tiên phong tại Đông Nam Á.`,
    highlights: [
      "10 phiên thảo luận chuyên sâu về Generative AI và Agentic AI",
      "Khu vực kết nối đầu tư Networking Cocktail",
      "Nhận chứng nhận điện tử và slide tài liệu thuyết trình"
    ],
    rules: [
      "Trang phục lịch sự (Smart Casual hoặc Business).",
      "Đeo thẻ đại biểu trong suốt thời gian diễn ra hội nghị."
    ],
    zones: [
      {
        id: "z-standard",
        name: "Standard Pass (Hội thảo & Expo)",
        price: 500000,
        description: "Tham dự các phiên thuyết trình chung và tham quan gian hàng công nghệ.",
        remaining: 200,
        color: "#10b981"
      },
      {
        id: "z-vip-pass",
        name: "Executive VIP (Bao gồm Tea-break & Lunch Buffet)",
        price: 2500000,
        description: "Quyền vào VIP Lounge, dùng bữa trưa 5 sao cùng diễn giả và tiệc Cocktail tối.",
        remaining: 35,
        color: "#f59e0b"
      }
    ]
  },
  {
    id: "ev-5",
    title: "Stand-up Comedy Special - Cười Xuyên Màn Đêm",
    type: "seated",
    status: "ongoing",
    category: "Hài kịch",
    date: "05 Tháng 11, 2026",
    time: "20:00 - 22:00",
    venue: "Soul Live Project Complex, Quận 3, TP.HCM",
    minPrice: 350000,
    maxPrice: 850000,
    image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1200&q=80",
    banner: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=1600&q=80",
    organizer: "Sài Gòn Tếu",
    description: `Đêm hài độc thoại bùng nổ tiếng cười với những câu chuyện đời thường dí dỏm, sâu cay từ các cây hài được yêu thích nhất.`,
    highlights: [
      "120 phút tiếng cười sảng khoái không ngừng",
      "Tặng kèm 1 mocktail hoặc bia tươi cho mỗi vé",
      "Không gian ấm cúng, tương tác trực tiếp với nghệ sĩ"
    ],
    rules: [
      "Dành cho khán giả từ 16 tuổi trở lên.",
      "Vui lòng không ngắt lời diễn viên trên sân khấu."
    ],
    seatTiers: [
      { id: "front", name: "Hàng ghế Front Row", price: 850000, color: "#ec4899", rows: ["A"] },
      { id: "regular", name: "Hàng ghế Standard", price: 450000, color: "#3b82f6", rows: ["B", "C", "D"] },
      { id: "back", name: "Hàng ghế Sau", price: 350000, color: "#10b981", rows: ["E"] }
    ]
  },
  {
    id: "ev-6",
    title: "Chung Kết Giải Đấu Thể Thao Điện Tử VCS Mùa Đông",
    type: "zone",
    status: "upcoming",
    category: "Thể thao",
    date: "25 Tháng 12, 2026",
    time: "14:00 - 21:00",
    venue: "Nhà thi đấu Quân khu 7, TP.HCM",
    minPrice: 300000,
    maxPrice: 1200000,
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
    banner: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=80",
    organizer: "Riot Games & VNG Games",
    description: `Trận so tài đỉnh cao tìm ra nhà vô địch đại diện Việt Nam tham gia giải đấu thế giới. Không khí cổ vũ cuồng nhiệt và hàng ngàn quà tặng in-game độc quyền.`,
    highlights: [
      "Màn hình LED 8K khổng lồ toàn cảnh",
      "Tặng Giftcode tướng và trang phục giới hạn",
      "Gặp gỡ và giao lưu cùng các Pro-players và Caster"
    ],
    rules: [
      "Không mang còi hơi hoặc đồ vật gây tiếng ồn quá mức quy định.",
      "Giữ gìn vệ sinh chung khu vực thi đấu."
    ],
    zones: [
      {
        id: "z-tribune",
        name: "Khán Đài Khán Giả (Zone A & B)",
        price: 300000,
        description: "Khu vực khán đài bậc thang quan sát toàn cảnh nhà thi đấu.",
        remaining: 350,
        color: "#10b981"
      },
      {
        id: "z-floor-fan",
        name: "Floor Cheerzone (Sát Sân Khấu)",
        price: 750000,
        description: "Khu vực mặt sàn gần booth thi đấu của tuyển thủ, tặng gậy cổ vũ LED.",
        remaining: 90,
        color: "#3b82f6"
      },
      {
        id: "z-esports-vip",
        name: "VIP Player Lounge & Meet & Greet",
        price: 1200000,
        description: "Vé VIP vào khu vực giao lưu độc quyền, áo đấu kỷ niệm và ký tặng.",
        remaining: 25,
        color: "#ec4899"
      }
    ]
  }
];

export const CATEGORIES = ["Tất cả", "Âm nhạc", "Lễ hội", "Hội thảo", "Hài kịch", "Thể thao"];
export const CITIES = ["Tất cả địa điểm", "Hà Nội", "TP.HCM"];
