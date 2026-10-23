import { useState } from 'react';
import { Mail, Lock, User, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { loginUser, registerUser } from '../services/eventService';
import { useToast } from '../components/toastContext.js';
import './LoginPage.css';

export default function LoginPage({ onLoginSuccess }) {
  const toast = useToast();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const userData = loginRes.user;
      const role = (userData.role || '').toLowerCase();
      onLoginSuccess({
        id: userData.id,
        name: userData.fullName || fullName || email.split('@')[0],
        email: userData.email,
        role: role === 'admin' ? 'admin' : 'user',
        token: loginRes.token,
        authProvider: 'Email',
        avatar:
          role === 'admin'
            ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
            : `https://api.dicebear.com/7.x/identicon/svg?seed=${email}`,
      });
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
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
            {mode === 'login' ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
          </h2>
          <p className="login-sub">
            {mode === 'login'
              ? 'Đăng nhập bằng Email & Mật khẩu để tiếp tục'
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

        {/* Email & Password Form */}
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
            </span>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
