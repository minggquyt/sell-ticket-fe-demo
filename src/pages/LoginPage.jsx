import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Loader2,
} from 'lucide-react';
import {
  loginUser,
  registerUser,
  resendRegistrationOtp,
  verifyRegistrationOtp,
  cancelRegistration,
} from '../services/eventService';
import {
  checkEmailStatus,
  requestPasswordSetup,
  verifyAndSetPassword,
  isValidGuestEmail,
} from '../services/guestService.js';
import { useToast } from '../components/toastContext.js';
import { computeAuthServerOffsetMs } from '../utils/authSession.js';
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
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerStep, setRegisterStep] = useState('details');
  const [registrationId, setRegistrationId] = useState('');
  const [registrationEmail, setRegistrationEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpLocked, setOtpLocked] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [deliveryWarning, setDeliveryWarning] = useState(false);
  const otpInputRef = useRef(null);
  const registerSubmittingRef = useRef(false);
  const verifySubmittingRef = useRef(false);
  const resendSubmittingRef = useRef(false);
  const cancelSubmittingRef = useRef(false);
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

  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  const expirySeconds = Math.max(0, Math.ceil((otpExpiresAt - now) / 1000));

  // --- PERSISTENCE: Lưu và khôi phục pending registration ---
  useEffect(() => {
    if (mode !== 'register' || registerStep !== 'otp') return;
    if (!registrationId || !registrationEmail) return;
    try {
      sessionStorage.setItem(
        'sellticket_pending_registration',
        JSON.stringify({
          registrationId,
          registrationEmail,
          otpExpiresAt,
          resendAvailableAt,
        }),
      );
    } catch {
      // Bỏ qua lỗi storage
    }
  }, [mode, registerStep, registrationId, registrationEmail, otpExpiresAt, resendAvailableAt]);

  useEffect(() => {
    if (mode !== 'register' || registerStep !== 'details') return;
    try {
      const stored = sessionStorage.getItem('sellticket_pending_registration');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed.registrationId || !parsed.registrationEmail) return;
      const expiry = Number(parsed.otpExpiresAt) || 0;
      const resend = Number(parsed.resendAvailableAt) || 0;
      const timestamp = Date.now();
      if (expiry > 0 && expiry < timestamp) {
        sessionStorage.removeItem('sellticket_pending_registration');
        return;
      }
      setRegistrationId(parsed.registrationId);
      setRegistrationEmail(parsed.registrationEmail);
      setOtpExpiresAt(expiry);
      setResendAvailableAt(resend);
      setNow(timestamp);
      setRegisterStep('otp');
      toast.info('Phiên đăng ký trước đó vẫn đang chờ xác minh.');
    } catch {
      sessionStorage.removeItem('sellticket_pending_registration');
    }
  }, []);

  useEffect(() => {
    if (mode !== 'register' || registerStep !== 'otp') return undefined;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    otpInputRef.current?.focus();
    return () => window.clearInterval(intervalId);
  }, [mode, registerStep]);

  const maskEmail = (value) => {
    const [local, domain] = String(value).split('@');
    if (!local || !domain) return value;
    return `${local.slice(0, Math.min(2, local.length))}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  };

  const resetPendingRegistration = () => {
    setRegisterStep('details');
    setRegistrationId('');
    setRegistrationEmail('');
    setOtp('');
    setOtpLocked(false);
    setResendDisabled(false);
    setResendAvailableAt(0);
    setOtpExpiresAt(0);
    setDeliveryWarning(false);
    try {
      sessionStorage.removeItem('sellticket_pending_registration');
    } catch {
      // Bỏ qua
    }
  };

  const syncOtpTimers = ({ expiresIn = 0, resendAfter = 0 } = {}) => {
    const timestamp = Date.now();
    setNow(timestamp);
    setOtpExpiresAt(timestamp + Math.max(0, Number(expiresIn) || 0) * 1000);
    setResendAvailableAt(timestamp + Math.max(0, Number(resendAfter) || 0) * 1000);
  };

  const handleRegistrationError = (err, action) => {
    const code = err.code || err.payload?.data?.code;
    const message = err.message || 'Yêu cầu không thành công. Vui lòng thử lại.';

    // --- RESUME: Xử lý REGISTRATION_PENDING ---
    if (code === 'REGISTRATION_PENDING' && err.payload?.data) {
      const { registrationId: resumeId, expiresIn, resendAfter } = err.payload.data;
      if (resumeId) {
        setRegistrationId(resumeId);
        setRegistrationEmail(email.trim().toLowerCase());
        setRegisterStep('otp');
        setOtp('');
        setOtpLocked(false);
        setResendDisabled(false);
        syncOtpTimers({ expiresIn, resendAfter });
        toast.info('Yêu cầu đăng ký trước đó vẫn đang chờ xác minh.');
        return;
      }
    }

    // --- EMAIL DELIVERY FAIL: Vẫn tạo session ---
    if (code === 'EMAIL_DELIVERY_UNAVAILABLE' && err.payload?.data) {
      const { registrationId: failId, expiresIn, resendAfter } = err.payload.data;
      if (failId && action === 'register') {
        setRegistrationId(failId);
        setRegistrationEmail(email.trim().toLowerCase());
        setRegisterStep('otp');
        setOtp('');
        setOtpLocked(false);
        setResendDisabled(false);
        setDeliveryWarning(true);
        syncOtpTimers({ expiresIn, resendAfter });
        setError('Chưa thể gửi email OTP. Vui lòng thử gửi lại sau.');
        return;
      }
    }

    if (code === 'REGISTRATION_INVALID' || code === 'REGISTRATION_EXPIRED') {
      resetPendingRegistration();
      setError(
        code === 'REGISTRATION_EXPIRED'
          ? 'Phiên đăng ký đã hết hạn. Vui lòng đăng ký lại.'
          : 'Phiên đăng ký không hợp lệ. Vui lòng bắt đầu lại.',
      );
      return;
    }
    if (code === 'REGISTRATION_COMPLETED') {
      resetPendingRegistration();
      setMode('login');
      setEmail(registrationEmail || email);
      toast.info('Tài khoản đã hoàn tất đăng ký. Vui lòng đăng nhập.');
      return;
    }
    if (code === 'RESEND_COOLDOWN' || code === 'RATE_LIMITED') {
      const retryAfter = err.retryAfter || 60;
      setNow(Date.now());
      setResendAvailableAt(Date.now() + retryAfter * 1000);
    }
    if (code === 'OTP_LOCKED') setOtpLocked(true);
    if (code === 'RESEND_LIMIT_REACHED') setResendDisabled(true);
    if (code === 'INVALID_OTP') {
      setOtp('');
      window.setTimeout(() => otpInputRef.current?.focus(), 0);
    }
    if (code === 'EMAIL_ALREADY_EXISTS') setShowClaimHint(true);

    const friendlyMessages = {
      INVALID_OTP: 'Mã OTP không đúng. Vui lòng nhập lại.',
      OTP_UNAVAILABLE: 'Mã OTP không còn sử dụng được. Vui lòng gửi lại mã mới.',
      OTP_EXPIRED: 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.',
      OTP_LOCKED: 'Mã OTP đã bị khóa do nhập sai nhiều lần. Vui lòng gửi lại mã mới.',
      RESEND_LIMIT_REACHED: 'Bạn đã đạt giới hạn gửi lại OTP. Vui lòng bắt đầu đăng ký lại.',
      RESEND_COOLDOWN: 'Bạn chưa thể gửi lại mã. Vui lòng chờ hết thời gian đếm ngược.',
      RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
      REGISTRATION_PENDING: 'Email này đang có phiên đăng ký chờ xác minh.',
      EMAIL_ALREADY_EXISTS: 'Email này đã có tài khoản. Vui lòng đăng nhập hoặc nhận lại vé.',
      EMAIL_DELIVERY_UNAVAILABLE: 'Chưa thể gửi email OTP. Vui lòng thử lại sau.',
    };
    setError(friendlyMessages[code] || message);
    if (action === 'verify' && code !== 'INVALID_OTP') otpInputRef.current?.focus();
  };

  const toUserData = (loginRes, fallbackName, fallbackPhone = null) => {
    const userData = loginRes.user;
    const { token: authToken, serverTime } = loginRes;
    const role = (userData.role || '').toLowerCase();
    return {
      id: userData.id,
      name: userData.fullName || fallbackName || userData.email.split('@')[0],
      email: userData.email,
      phone: userData.phone || fallbackPhone || null,
      role: role === 'admin' ? 'admin' : 'user',
      token: authToken,
      serverOffsetMs: computeAuthServerOffsetMs(serverTime, authToken),
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
    if (mode === 'register') {
      if (!isValidGuestEmail(email)) {
        setError('Vui lòng nhập địa chỉ email hợp lệ.');
        return;
      }
      if (password.length < 6) {
        setError('Mật khẩu phải có ít nhất 6 ký tự.');
        return;
      }
      const cleanPhone = phone.replace(/\D/g, '').trim();
      if (!cleanPhone) {
        setError('Vui lòng nhập số điện thoại để đăng ký.');
        return;
      }
      if (!/^\d{10,11}$/.test(cleanPhone)) {
        setError('Số điện thoại phải gồm 10–11 chữ số.');
        return;
      }
      setPhone(cleanPhone);
    }

    if (registerSubmittingRef.current) return;
    registerSubmittingRef.current = true;
    setLoading(true);
    try {
      if (mode === 'register') {
        const normalizedEmail = email.trim().toLowerCase();
        const result = await registerUser(
          normalizedEmail,
          password,
          fullName.trim(),
          phone.replace(/\D/g, '').trim(),
        );
        if (!result?.registrationId) {
          throw new Error('Dữ liệu đăng ký từ hệ thống không hợp lệ.');
        }
        setRegistrationId(result.registrationId);
        setRegistrationEmail(normalizedEmail);
        setRegisterStep('otp');
        setOtp('');
        setOtpLocked(false);
        setResendDisabled(false);
        syncOtpTimers(result);
        toast.success('Mã OTP đã được gửi đến email của bạn.');
        return;
      }
      const loginRes = await loginUser(email, password);
      if (!loginRes?.token || !loginRes?.user) {
        throw new Error('Dữ liệu đăng nhập từ hệ thống không hợp lệ.');
      }
      onLoginSuccess(
        toUserData(
          loginRes,
          fullName || email.split('@')[0],
          phone.replace(/\D/g, '').trim() || null,
        ),
      );
    } catch (err) {
      if (mode === 'register') {
        handleRegistrationError(err, 'register');
        return;
      }
      const message = err.message || 'Đăng nhập không thành công. Vui lòng thử lại.';
      setError(message);
    } finally {
      setLoading(false);
      registerSubmittingRef.current = false;
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) {
      setError('Mã OTP phải gồm đúng 6 chữ số.');
      otpInputRef.current?.focus();
      return;
    }
    if (verifySubmittingRef.current || otpLocked) return;
    verifySubmittingRef.current = true;
    setVerifyLoading(true);
    try {
      await verifyRegistrationOtp(registrationId, otp);
      const verifiedEmail = registrationEmail;
      resetPendingRegistration();
      setMode('login');
      setEmail(verifiedEmail);
      setPassword('');
      setError('');
      toast.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
    } catch (err) {
      handleRegistrationError(err, 'verify');
    } finally {
      setVerifyLoading(false);
      verifySubmittingRef.current = false;
    }
  };

  const handleResendOtp = async () => {
    if (
      resendSubmittingRef.current ||
      resendLoading ||
      resendSeconds > 0 ||
      resendDisabled ||
      !registrationId
    ) {
      return;
    }
    setError('');
    resendSubmittingRef.current = true;
    setResendLoading(true);
    try {
      const result = await resendRegistrationOtp(registrationId);
      setOtp('');
      setOtpLocked(false);
      setDeliveryWarning(false);
      syncOtpTimers(result);
      toast.success('Mã OTP mới đã được gửi.');
      window.setTimeout(() => otpInputRef.current?.focus(), 0);
    } catch (err) {
      handleRegistrationError(err, 'resend');
    } finally {
      setResendLoading(false);
      resendSubmittingRef.current = false;
    }
  };

  // --- CANCEL: Hủy phiên đăng ký ---
  const handleCancelRegistration = async () => {
    if (cancelSubmittingRef.current || !registrationId) return;
    setError('');
    cancelSubmittingRef.current = true;
    setCancelLoading(true);
    try {
      await cancelRegistration(registrationId);
      resetPendingRegistration();
      setCancelModalOpen(false);
      toast.success('Đã hủy yêu cầu đăng ký.');
    } catch (err) {
      const code = err.code || err.payload?.data?.code;
      if (code === 'RATE_LIMITED') {
        const retryAfter = err.retryAfter || 60;
        setError(`Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfter}s.`);
        const timestamp = Date.now();
        setNow(timestamp);
        setResendAvailableAt(timestamp + retryAfter * 1000);
      } else {
        setError(err.message || 'Không thể hủy yêu cầu đăng ký.');
      }
    } finally {
      setCancelLoading(false);
      cancelSubmittingRef.current = false;
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
      if (!loginRes?.token || !loginRes?.user) {
        throw new Error('Dữ liệu đăng nhập từ hệ thống không hợp lệ.');
      }
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
                : registerStep === 'otp'
                  ? 'Xác minh Email OTP'
                  : 'Tạo tài khoản mới'}
          </h2>
          <p className="login-sub">
            {mode === 'login'
              ? 'Đăng nhập bằng Email & Mật khẩu để tiếp tục'
              : mode === 'claim'
                ? 'Bạn đã mua vé bằng email này trước đây? Xác thực email rồi đặt mật khẩu — giữ nguyên vé đã mua.'
                : registerStep === 'otp'
                  ? `Nhập mã 6 số đã gửi tới ${maskEmail(registrationEmail)}`
                  : 'Đăng ký tài khoản mới để đặt vé & quản lý sự kiện'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="login-error" role="alert" aria-live="assertive">
            <AlertCircle size={16} aria-hidden="true" />
            {error}
          </div>
        )}

        {showClaimHint && mode === 'register' && (
          <div className="login-claim-hint">
            <KeyRound size={16} />
            <div>
              <div className="login-claim-hint-title">Email này có thể đã mua vé trước đây</div>
              <p className="login-claim-hint-text">
                Nếu bạn từng mua vé bằng email này mà chưa đặt mật khẩu, hãy nhận lại vé thay vì tạo
                tài khoản mới.
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
                <>
                  <Loader2 size={18} className="spin-animation" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  {claimStep === 'email' ? 'Gửi mã xác thực' : 'Đặt mật khẩu & Đăng nhập'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : mode === 'register' && registerStep === 'otp' ? (
          <form onSubmit={handleVerifyOtp}>
            {deliveryWarning && (
              <div className="login-error" role="alert" style={{ background: '#f97316' }}>
                <AlertCircle size={16} aria-hidden="true" />
                Email OTP chưa được gửi thành công. Vui lòng thử gửi lại sau khi hết thời gian chờ.
              </div>
            )}

            <div className="login-otp-summary">
              <Mail size={18} aria-hidden="true" />
              <div>
                <strong>Kiểm tra hộp thư của bạn</strong>
                <p>
                  Mã OTP có hiệu lực trong{' '}
                  <span className={expirySeconds === 0 ? 'login-timer-expired' : ''}>
                    {Math.floor(expirySeconds / 60)}:{String(expirySeconds % 60).padStart(2, '0')}
                  </span>
                </p>
              </div>
            </div>

            <div className="login-group-last">
              <label className="login-label" htmlFor="registration-otp">
                Mã OTP
              </label>
              <div className="login-field login-otp-field">
                <KeyRound size={18} color="var(--text-dim)" aria-hidden="true" />
                <input
                  ref={otpInputRef}
                  id="registration-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  className="login-input login-otp-input"
                  aria-describedby="registration-otp-help"
                />
              </div>
              <p id="registration-otp-help" className="login-otp-help">
                Không chia sẻ mã này với bất kỳ ai.
              </p>
            </div>

            <button
              type="submit"
              disabled={verifyLoading || otp.length !== 6 || otpLocked || expirySeconds === 0}
              className="glow-btn-primary login-submit"
            >
              {verifyLoading ? (
                <>
                  <Loader2 size={18} className="spin-animation" />
                  Đang xác minh...
                </>
              ) : (
                'Xác minh & hoàn tất đăng ký'
              )}
            </button>

            <div className="login-otp-actions">
              <button
                type="button"
                className="login-toggle-btn-pink"
                disabled={resendLoading || resendSeconds > 0 || resendDisabled}
                onClick={handleResendOtp}
              >
                {resendLoading ? (
                  <>
                    <Loader2 size={14} className="spin-animation" />
                    Đang gửi...
                  </>
                ) : resendDisabled ? (
                  'Đã hết lượt gửi lại'
                ) : resendSeconds > 0 ? (
                  `Gửi lại sau ${resendSeconds}s`
                ) : (
                  'Gửi lại mã OTP'
                )}
              </button>
              <button
                type="button"
                className="login-toggle-btn-primary"
                disabled={verifyLoading || resendLoading || cancelLoading}
                onClick={() => setCancelModalOpen(true)}
              >
                Đổi thông tin đăng ký
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEmailSubmit}>
            {mode === 'register' && (
              <>
                <div className="login-group">
                  <label className="login-label" htmlFor="register-full-name">
                    Họ và tên (không bắt buộc)
                  </label>
                  <div className="login-field">
                    <User size={18} color="var(--text-dim)" />
                    <input
                      type="text"
                      id="register-full-name"
                      placeholder="Nguyễn Văn A"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="login-input"
                    />
                  </div>
                </div>

                <div className="login-group">
                  <label className="login-label" htmlFor="register-phone">
                    Số điện thoại
                  </label>
                  <div className="login-field">
                    <Phone size={18} color="var(--text-dim)" />
                    <input
                      type="tel"
                      id="register-phone"
                      placeholder="0901234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      className="login-input"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="login-group">
              <label className="login-label" htmlFor="auth-email">
                Địa chỉ Email
              </label>
              <div className="login-field">
                <Mail size={18} color="var(--text-dim)" />
                <input
                  type="email"
                  id="auth-email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input"
                />
              </div>
            </div>

            <div className="login-group-last">
              <div className="login-pw-head">
                <label className="login-label-inline" htmlFor="auth-password">
                  Mật khẩu
                </label>
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
                  id="auth-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="glow-btn-primary login-submit">
              {loading ? (
                <>
                  <Loader2 size={18} className="spin-animation" />
                  Đang xử lý...
                </>
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
                  resetPendingRegistration();
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
          ) : mode === 'register' && registerStep === 'details' ? (
            <span>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  resetPendingRegistration();
                  setMode('login');
                  setError('');
                }}
                className="login-toggle-btn-primary"
              >
                Đăng nhập tại đây
              </button>
            </span>
          ) : mode === 'claim' ? (
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
          ) : null}
        </div>
      </div>

      {/* Cancel Modal */}
      {cancelModalOpen && (
        <div
          className="login-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelLoading) {
              setCancelModalOpen(false);
            }
          }}
        >
          <div className="login-modal glass-panel">
            <h3 className="login-modal-title">Xác nhận hủy đăng ký</h3>
            <p className="login-modal-text">
              Bạn muốn tiếp tục xác minh hay hủy yêu cầu đăng ký hiện tại? Nếu hủy, mã OTP đã gửi sẽ
              không còn hiệu lực.
            </p>
            <div className="login-modal-actions">
              <button
                type="button"
                className="glow-btn-secondary"
                disabled={cancelLoading}
                onClick={() => setCancelModalOpen(false)}
              >
                Tiếp tục xác minh
              </button>
              <button
                type="button"
                className="glow-btn-danger"
                disabled={cancelLoading}
                onClick={handleCancelRegistration}
              >
                {cancelLoading ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    Đang hủy...
                  </>
                ) : (
                  'Hủy và đăng ký lại'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
