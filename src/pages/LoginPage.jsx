import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react';
import { loginUser, registerUser } from '../services/eventService';
import {
  checkEmailStatus,
  requestPasswordSetup,
  verifyAndSetPassword,
  isValidGuestEmail,
} from '../services/guestService.js';
import { useToast } from '../components/toastContext.js';
import './LoginPage.css';

export default function LoginPage({ onLoginSuccess }) {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  // Mở thẳng luồng nhận lại vé từ banner sau thanh toán:
  // /login?mode=claim&email=... (&code=... nếu bấm link trong email)
  const [mode, setMode] = useState(() =>
    searchParams.get('mode') === 'claim' && searchParams.get('email') ? 'claim' : 'login',
  ); // 'login' | 'register' | 'claim'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Luồng nhận lại vé: email đã tồn tại + password null → xác thực email
  // (mã hoặc link) → đặt password, GIỮ NGUYÊN userid, thấy lại vé đã mua.
  const [claimEmail, setClaimEmail] = useState(() => searchParams.get('email') || '');
  const [claimCode, setClaimCode] = useState(() => searchParams.get('code') || '');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimConfirm, setClaimConfirm] = useState('');
  const [claimStep, setClaimStep] = useState(() =>
    searchParams.get('mode') === 'claim' && searchParams.get('code') ? 'code' : 'email',
  ); // 'email' | 'code'
  const [claimSent, setClaimSent] = useState(() =>
    Boolean(searchParams.get('mode') === 'claim' && searchParams.get('code')),
  );
  const [showClaimHint, setShowClaimHint] = useState(false);

  const toUserData = (loginRes, fallbackName) => {
    const userData = loginRes.user;
    const { token: authToken } = loginRes;
    const role = (userData.role || '').toLowerCase();
    return {
      id: userData.id,
      name: userData.fullName || fallbackName || userData.email.split('@')[0],
      email: userData.email,
      role: role === 'admin' ? 'admin' : 'user',
      token: authToken,
      authProvider: 'Email',
      avatar:
        role === 'admin'
          ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
          : `https://api.dicebear.com/7.x/identicon/svg?seed=${userData.email}`,
    };
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }
    if (mode === 'register' && !fullName) {
      setError('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await registerUser(email, password, fullName);
      }
      const loginRes = await loginUser(email, password);
      onLoginSuccess(toUserData(loginRes, fullName));
    } catch (err) {
      const message = err.message || 'Đăng nhập không thành công. Vui lòng thử lại.';
      setError(message);
      // Đăng ký mà email đã tồn tại: có thể đây là tài khoản mua vé trước đây
      // (password null) → gợi ý luồng nhận lại vé thay vì bắt đăng ký lại.
      if (
        mode === 'register' &&
        /t.n t.i|exists|already|registered|duplicate/i.test(message)
      ) {
        setShowClaimHint(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // --- LUỒNG CLAIM: kiểm tra email rồi gửi mã xác thực ---
  const handleClaimCheckEmail = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidGuestEmail(claimEmail)) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }
    setLoading(true);
    try {
      const status = await checkEmailStatus(claimEmail);
      if (!status.exists) {
        setError('Email này chưa có vé nào và chưa có tài khoản. Vui lòng đăng ký tài khoản mới.');
        return;
      }
      if (status.hasPassword) {
        setError('Email này đã có mật khẩu. Vui lòng đăng nhập thay vì nhận lại vé.');
        return;
      }
      await requestPasswordSetup(claimEmail);
      setClaimSent(true);
      setClaimStep('code');
      toast.success('Đã gửi mã xác thực về email của bạn. Vui lòng kiểm tra hộp thư.');
    } catch (err) {
      setError(err.message || 'Không thể kiểm tra email. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // --- LUỒNG CLAIM: xác thực mã + đặt password, giữ nguyên userid ---
  const handleClaimSetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!claimCode.trim()) {
      setError('Vui lòng nhập mã xác thực đã gửi về email.');
      return;
    }
    if (!claimPassword || claimPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (claimPassword !== claimConfirm) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    setLoading(true);
    try {
      await verifyAndSetPassword(claimEmail, claimCode, claimPassword);
      const loginRes = await loginUser(claimEmail, claimPassword);
      try {
        sessionStorage.setItem('sellticket_after_login', 'my-tickets');
      } catch {
        /* Bỏ qua */
      }
      toast.success('Đã đặt mật khẩu. Vé đã mua của bạn vẫn giữ nguyên!');
      onLoginSuccess(toUserData(loginRes, claimEmail.split('@')[0]));
    } catch (err) {
      setError(err.message || 'Không thể đặt mật khẩu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const openClaimWithEmail = (value) => {
    setClaimEmail(value || '');
    setClaimStep('email');
    setClaimSent(false);
    setShowClaimHint(false);
    setError('');
    setMode('claim');
  };

  return (
    <div className="login-page">
      {/* Background ambient lighting */}
      <div className="login-glow login-glow-indigo" />
      <div className="login-glow login-glow-pink" />

      <div className="glass-panel animate-fade-in login-card">
        {/* Header */}
        <div className="login-head">
          <div className="login-badge">
            <ShieldCheck size={14} /> Hệ thống xác thực Supabase bảo mật
          </div>
          <h2 className="login-title">
            {mode === 'login'
              ? 'Đăng nhập tài khoản'
              : mode === 'claim'
                ? 'Nhận lại vé đã mua'
                : 'Tạo tài khoản mới'}
          </h2>
          <p className="login-sub">
            {mode === 'login'
              ? 'Đăng nhập bằng Email & Mật khẩu để tiếp tục'
              : mode === 'claim'
                ? 'Bạn đã mua vé bằng email này trước đây? Xác thực email rồi đặt mật khẩu — giữ nguyên vé đã mua.'
                : 'Đăng ký tài khoản mới để đặt vé & quản lý sự kiện'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {showClaimHint && mode === 'register' && (
          <div className="login-claim-hint">
            <KeyRound size={16} />
            <div>
              <div className="login-claim-hint-title">Email này có thể đã mua vé trước đây</div>
              <p className="login-claim-hint-text">
                Nếu bạn từng mua vé bằng email này mà chưa đặt mật khẩu, hãy nhận lại vé thay vì
                tạo tài khoản mới.
              </p>
              <button
                type="button"
                onClick={() => openClaimWithEmail(email)}
                className="login-toggle-btn-pink"
              >
                Đặt mật khẩu để nhận lại vé
              </button>
            </div>
          </div>
        )}

        {mode === 'claim' ? (
          <form onSubmit={claimStep === 'email' ? handleClaimCheckEmail : handleClaimSetPassword}>
            <div className="login-group">
              <label className="login-label">Địa chỉ Email đã mua vé</label>
              <div className="login-field">
                <Mail size={18} color="var(--text-dim)" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={claimEmail}
                  disabled={claimStep === 'code'}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  className="login-input"
                />
              </div>
            </div>

            {claimStep === 'code' && (
              <>
                <div className="login-group">
                  <label className="login-label">Mã xác thực đã gửi về email</label>
                  <div className="login-field">
                    <KeyRound size={18} color="var(--text-dim)" />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Nhập mã 6 số"
                      value={claimCode}
                      onChange={(e) => setClaimCode(e.target.value)}
                      className="login-input"
                    />
                  </div>
                  {claimSent && (
                    <p className="login-claim-note">
                      Không thấy mã? Kiểm tra cả mục Spam, hoặc{' '}
                      <button
                        type="button"
                        onClick={handleClaimCheckEmail}
                        className="login-toggle-btn-pink"
                      >
                        gửi lại mã
                      </button>
                    </p>
                  )}
                </div>

                <div className="login-group">
                  <label className="login-label">Mật khẩu mới</label>
                  <div className="login-field">
                    <Lock size={18} color="var(--text-dim)" />
                    <input
                      type="password"
                      placeholder="Ít nhất 6 ký tự"
                      value={claimPassword}
                      onChange={(e) => setClaimPassword(e.target.value)}
                      className="login-input"
                    />
                  </div>
                </div>

                <div className="login-group-last">
                  <label className="login-label">Nhập lại mật khẩu mới</label>
                  <div className="login-field">
                    <Lock size={18} color="var(--text-dim)" />
                    <input
                      type="password"
                      placeholder="Nhập lại mật khẩu mới"
                      value={claimConfirm}
                      onChange={(e) => setClaimConfirm(e.target.value)}
                      className="login-input"
                    />
                  </div>
                </div>
              </>
            )}

            <button type="submit" disabled={loading} className="glow-btn-primary login-submit">
              {loading ? (
                'Đang xử lý...'
              ) : (
                <>
                  {claimStep === 'email' ? 'Gửi mã xác thực' : 'Đặt mật khẩu & Đăng nhập'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailSubmit}>
          {mode === 'register' && (
            <div className="login-group">
              <label className="login-label">Họ và tên</label>
              <div className="login-field">
                <User size={18} color="var(--text-dim)" />
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="login-input"
                />
              </div>
            </div>
          )}

          <div className="login-group">
            <label className="login-label">Địa chỉ Email</label>
            <div className="login-field">
              <Mail size={18} color="var(--text-dim)" />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
              />
            </div>
          </div>

          <div className="login-group-last">
            <div className="login-pw-head">
              <label className="login-label-inline">Mật khẩu</label>
              {mode === 'login' && (
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info('Vui lòng liên hệ hỗ trợ hoặc nhập lại mật khẩu mẫu');
                  }}
                  className="login-forgot"
                >
                  Quên mật khẩu?
                </a>
              )}
            </div>
            <div className="login-field">
              <Lock size={18} color="var(--text-dim)" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
              />
            </div>
          </div>

            <button type="submit" disabled={loading} className="glow-btn-primary login-submit">
              {loading ? (
                'Đang xử lý...'
              ) : (
                <>
                  {mode === 'login' ? 'Đăng nhập ngay' : 'Đăng ký tài khoản'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Toggle Mode */}
        <div className="login-toggle">
          {mode === 'login' ? (
            <span>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="login-toggle-btn-pink"
              >
                Đăng ký miễn phí
              </button>
              <span className="login-toggle-sep">•</span>
              <button
                type="button"
                onClick={() => openClaimWithEmail(email)}
                className="login-toggle-btn-primary"
              >
                Đã mua vé mà chưa có tài khoản?
              </button>
            </span>
          ) : mode === 'register' ? (
            <span>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="login-toggle-btn-primary"
              >
                Đăng nhập tại đây
              </button>
            </span>
          ) : (
            <span>
              Đã có mật khẩu rồi?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setEmail(claimEmail);
                  setError('');
                }}
                className="login-toggle-btn-primary"
              >
                Đăng nhập tại đây
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
