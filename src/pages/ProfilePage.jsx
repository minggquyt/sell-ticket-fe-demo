import { useEffect, useState } from 'react';
import { ArrowLeft, Landmark, AlertTriangle, Save, Search, User } from 'lucide-react';
import { fetchMyBank, updateMyBank, fetchVietQrBanks } from '../services/eventService';
import { stripAccents, toBankAccountName } from '../utils/format.js';
import { useToast } from '../components/toastContext.js';
import './OrderHistoryPage.css';
import '../components/CustomerInfoModal.css'; // .modal-label / .modal-input
import './ProfilePage.css';

const ACCOUNT_NO_REGEX = /^[A-Za-z0-9]{6,25}$/;

export default function ProfilePage({ user, onBack, onRequireLogin, onSaved }) {
  const toast = useToast();
  const [profile, setProfile] = useState(null); // { bank, bankError } từ BE
  const [banks, setBanks] = useState([]);
  const [banksError, setBanksError] = useState('');
  const [bank, setBank] = useState(null); // { bin, shortName, name, logo }
  const [query, setQuery] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [accountNo, setAccountNo] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const applyProfile = (p) => {
    setProfile(p);
    if (p?.bank) {
      setBank({
        bin: p.bank.bankBin,
        shortName: p.bank.bankShortName,
        name: p.bank.bankName,
        logo: p.bank.bankLogo,
      });
      setAccountNo(p.bank.bankAccountNo);
      setAccountName(p.bank.bankAccountName);
    }
  };

  useEffect(() => {
    if (!user?.token) return;
    fetchMyBank(user.token)
      .then(applyProfile)
      .catch((err) => setBanksError(err.message));
    fetchVietQrBanks()
      .then(setBanks)
      .catch((err) => setBanksError(err.message));
  }, [user?.token]);

  // Cuộn tới mục Ngân hàng khi được điều hướng từ đơn hoàn tiền (/profile#bank)
  useEffect(() => {
    if (window.location.hash === '#bank' && profile) {
      document.getElementById('bank')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [profile]);

  if (!user) {
    return (
      <div className="order-history-page">
        <div className="glass-panel order-history-guest">
          <h2 className="order-history-guest-title">Hồ sơ tài khoản</h2>
          <p className="order-history-guest-text">Vui lòng đăng nhập để cập nhật hồ sơ.</p>
          <div className="order-history-guest-actions">
            <button onClick={onRequireLogin} className="glow-btn-primary order-history-btn-primary">
              Đăng nhập ngay
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = stripAccents(query).toLowerCase();
  const filteredBanks = banks.filter((b) =>
    stripAccents(`${b.shortName} ${b.name} ${b.code} ${b.bin}`).toLowerCase().includes(q),
  );

  const selectBank = (b) => {
    setBank({ bin: String(b.bin), shortName: b.shortName, name: b.name, logo: b.logo });
    setQuery('');
    setListOpen(false);
  };

  const bankError = profile?.bankError;
  const old = profile?.bank;
  const cleanName = accountName.trim();
  const unchanged =
    old &&
    old.bankBin === bank?.bin &&
    old.bankAccountNo === accountNo &&
    old.bankAccountName === cleanName;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bank) return toast.warning('Vui lòng chọn ngân hàng từ danh sách.');
    if (!ACCOUNT_NO_REGEX.test(accountNo)) {
      return toast.warning('Số tài khoản chỉ gồm chữ và số, dài 6–25 ký tự.');
    }
    if (cleanName.length < 2) return toast.warning('Vui lòng nhập tên chủ tài khoản.');
    if (bankError && unchanged) {
      return toast.warning(
        'Thông tin đang bị Admin báo sai. Vui lòng chỉnh sửa Ngân hàng, Số tài khoản hoặc Tên chủ tài khoản trước khi lưu.',
      );
    }

    setIsSaving(true);
    try {
      const saved = await updateMyBank(
        {
          bankBin: bank.bin,
          bankShortName: bank.shortName,
          bankName: bank.name,
          bankLogo: bank.logo,
          bankAccountNo: accountNo,
          bankAccountName: cleanName,
        },
        user.token,
      );
      applyProfile(saved);
      toast.success('Đã lưu thông tin ngân hàng nhận hoàn tiền!');
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="order-history-page animate-fade-in">
      <div className="oh-top-bar">
        <button onClick={onBack} className="event-back-btn">
          <ArrowLeft size={15} />
          <span>Quay lại</span>
        </button>
      </div>

      <div className="glass-panel pf-card">
        <h1 className="pf-title">
          <User size={20} /> Hồ sơ tài khoản
        </h1>
        <div className="pf-row">
          <span className="pf-label">Họ tên</span>
          <span>{profile?.fullName || user.name}</span>
        </div>
        <div className="pf-row">
          <span className="pf-label">Email</span>
          <span>{profile?.email || user.email}</span>
        </div>
      </div>

      <form id="bank" onSubmit={handleSubmit} className="glass-panel pf-card">
        <h2 className="pf-title">
          <Landmark size={20} /> Tài khoản ngân hàng nhận hoàn tiền
        </h2>
        <p className="pf-desc">
          Không bắt buộc. Chỉ dùng để Admin chuyển khoản hoàn tiền khi đơn của bạn bị hủy/hết hạn
          nhưng đã thanh toán.
        </p>

        {bankError && (
          <div className="oh-refund-alert pf-alert-error" role="alert">
            <AlertTriangle size={18} className="oh-refund-alert-icon" />
            <div>
              <div className="oh-refund-alert-title">Admin báo thông tin tài khoản chưa đúng</div>
              <div className="oh-refund-alert-desc">
                Lý do: <strong>{bankError}</strong>. Vui lòng sửa lại và bấm Lưu.
              </div>
            </div>
          </div>
        )}

        {banksError && <p className="pf-hint pf-hint-error">{banksError}</p>}

        {/* Ngân hàng: combobox bắt buộc chọn từ danh sách VietQR */}
        <div className="pf-field">
          <label className="modal-label" htmlFor="pf-bank-search">
            Ngân hàng *
          </label>
          {bank && !listOpen ? (
            <button
              type="button"
              className="pf-bank-selected"
              onClick={() => setListOpen(true)}
              title="Bấm để đổi ngân hàng"
            >
              {bank.logo && <img src={bank.logo} alt="" className="pf-bank-logo" />}
              <span>
                <strong>{bank.shortName}</strong>
                <span className="pf-bank-fullname">{bank.name}</span>
              </span>
            </button>
          ) : (
            <div className="pf-combobox">
              <Search size={16} className="pf-combobox-icon" />
              <input
                id="pf-bank-search"
                type="text"
                className="modal-input pf-combobox-input"
                placeholder="Tìm ngân hàng: VCB, Vietcombank, MB..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setListOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setListOpen(false);
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredBanks[0]) selectBank(filteredBanks[0]);
                  }
                }}
                role="combobox"
                aria-expanded={listOpen}
                aria-controls="pf-bank-list"
                autoComplete="off"
              />
              {listOpen && (
                <ul id="pf-bank-list" role="listbox" className="pf-bank-list">
                  {filteredBanks.length === 0 ? (
                    <li className="pf-bank-empty">
                      {banks.length === 0 ? 'Đang tải danh sách...' : 'Không tìm thấy ngân hàng'}
                    </li>
                  ) : (
                    filteredBanks.map((b) => (
                      <li key={b.id} role="option" aria-selected={bank?.bin === String(b.bin)}>
                        <button
                          type="button"
                          className="pf-bank-option"
                          onClick={() => selectBank(b)}
                        >
                          <img src={b.logo} alt="" className="pf-bank-logo" loading="lazy" />
                          <span>
                            <strong>{b.shortName}</strong>
                            <span className="pf-bank-fullname">{b.name}</span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="pf-field">
          <label className="modal-label" htmlFor="pf-account-no">
            Số tài khoản *
          </label>
          <input
            id="pf-account-no"
            type="text"
            className="modal-input"
            placeholder="Ví dụ: 0123456789"
            value={accountNo}
            onChange={(e) => setAccountNo(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 25))}
            inputMode="text"
            maxLength={25}
            autoComplete="off"
          />
          <p className="pf-hint">Chỉ chữ và số, 6–25 ký tự (khoảng trắng tự động bị xóa).</p>
        </div>

        <div className="pf-field">
          <label className="modal-label" htmlFor="pf-account-name">
            Tên chủ tài khoản *
          </label>
          <input
            id="pf-account-name"
            type="text"
            className="modal-input pf-uppercase"
            placeholder="NGUYEN VAN A"
            value={accountName}
            onChange={(e) => setAccountName(toBankAccountName(e.target.value))}
            maxLength={100}
            autoComplete="off"
          />
          <p className="pf-hint">
            ⚠️ Kiểm tra tên phải <strong>khớp chính xác</strong> với tên hiển thị trên App Ngân hàng
            của bạn, nếu không Admin sẽ không thể hoàn tiền.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="glow-btn-primary pf-save-btn"
        >
          <Save size={16} /> {isSaving ? 'Đang lưu...' : 'Lưu thông tin ngân hàng'}
        </button>
      </form>
    </div>
  );
}
