import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function LoginPage({ onLoginSuccess, onNavigate }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = (e) => {
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
    setTimeout(() => {
      setLoading(false);
      const isAdminAccount = email.toLowerCase().includes('admin') || password.toLowerCase() === 'admin123';
      onLoginSuccess({
        id: 'usr_' + Date.now(),
        name: fullName || (isAdminAccount ? 'Quản trị viên Hệ thống' : email.split('@')[0]),
        email: email,
        role: isAdminAccount ? 'admin' : 'user',
        authProvider: 'Email',
        avatar: isAdminAccount
          ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
          : `https://api.dicebear.com/7.x/identicon/svg?seed=${email}`
      });
    }, 700);
  };

  const handleSocialLogin = (provider) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      let dummyName = provider === 'Google' ? 'Alex Nguyễn' : 'Minh Quân';
      let dummyEmail = provider === 'Google' ? 'alex.nguyen@gmail.com' : 'minhquan@zalo.me';
      let avatar = provider === 'Google'
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
        : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80';

      // Test giao diện: Đăng nhập Zalo là Admin, các đăng nhập khác là user
      const isZaloAdmin = provider === 'Zalo';

      onLoginSuccess({
        id: 'usr_' + provider.toLowerCase() + '_' + Date.now(),
        name: dummyName,
        email: dummyEmail,
        role: isZaloAdmin ? 'admin' : 'user',
        authProvider: provider,
        avatar: avatar
      });
    }, 600);
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 72px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative'
    }}>
      {/* Background ambient lighting */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '20%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '25%',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }} />

      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '480px',
        borderRadius: 'var(--radius-xl)',
        padding: '36px',
        boxShadow: 'var(--shadow-subtle)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: 'var(--primary-light)',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '12px',
            border: '1px solid rgba(99, 102, 241, 0.25)'
          }}>
            <ShieldCheck size={14} /> Hệ thống bán vé bảo mật
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '6px', color: '#fff' }}>
            {mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {mode === 'login' ? 'Đăng nhập để đặt vé và quản lý chỗ ngồi của bạn' : 'Tham gia cùng hàng triệu khán giả yêu âm nhạc & sự kiện'}
          </p>
        </div>

        {/* Social Login Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {/* Google Button */}
          <button
            type="button"
            onClick={() => handleSocialLogin('Google')}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Đăng nhập bằng Google
          </button>

          {/* Zalo Button */}
          <button
            type="button"
            onClick={() => handleSocialLogin('Zalo')}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#0068FF',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 104, 255, 0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0055d4'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0068FF'}
          >
            <div style={{
              width: '22px',
              height: '22px',
              backgroundColor: '#ffffff',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0068FF',
              fontWeight: 900,
              fontSize: '13px',
              letterSpacing: '-1px'
            }}>
              Z
            </div>
            Đăng nhập bằng Zalo
          </button>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '20px 0',
          color: 'var(--text-dim)',
          fontSize: '13px'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
          <span>Hoặc tiếp tục với Email</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleEmailSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                Họ và tên
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)'
              }}>
                <User size={18} color="var(--text-dim)" />
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
              Địa chỉ Email
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)'
            }}>
              <Mail size={18} color="var(--text-dim)" />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Mật khẩu
              </label>
              {mode === 'login' && (
                <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Vui lòng liên hệ hỗ trợ hoặc nhập lại mật khẩu mẫu'); }} style={{ fontSize: '12px', color: 'var(--primary-light)' }}>
                  Quên mật khẩu?
                </a>
              )}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)'
            }}>
              <Lock size={18} color="var(--text-dim)" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="glow-btn-primary"
            style={{
              width: '100%',
              padding: '13px',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? 'Đang xử lý...' : (
              <>
                {mode === 'login' ? 'Đăng nhập ngay' : 'Đăng ký tài khoản'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <span>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                style={{ background: 'none', color: 'var(--accent-pink)', fontWeight: 600, textDecoration: 'underline' }}
              >
                Đăng ký miễn phí
              </button>
            </span>
          ) : (
            <span>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                style={{ background: 'none', color: 'var(--primary-light)', fontWeight: 600, textDecoration: 'underline' }}
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
