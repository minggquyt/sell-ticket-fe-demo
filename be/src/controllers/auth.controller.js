const pool = require('../config/db');
const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middlewares/auth.middleware');
const logger = require('../utils/logger');

// Đăng ký tài khoản người dùng mới (đồng bộ Supabase / Postgres)
exports.register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      logger.auth('REGISTER', email || 'unknown', false, 'Thiếu thông tin');
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ email và mật khẩu.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = (fullName || cleanEmail.split('@')[0]).trim();

    let existingUser = null;
    if (process.env.DATABASE_URL) {
      try {
        const check = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1;', [cleanEmail]);
        if (check.rows.length > 0) existingUser = check.rows[0];
      } catch (err) {
        logger.error('PG_AUTH_CHECK', err.message);
      }
    }
    if (!existingUser) {
      const { data } = await supabase.from('users').select('id').eq('email', cleanEmail).maybeSingle();
      if (data) existingUser = data;
    }

    if (existingUser) {
      logger.auth('REGISTER', cleanEmail, false, 'Email đã được sử dụng');
      return res.status(400).json({ success: false, message: 'Email này đã được sử dụng.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = cleanEmail.includes('admin') ? 'ADMIN' : 'CUSTOMER';
    const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanEmail}`;
    let newUser = null;

    if (process.env.DATABASE_URL) {
      try {
        const result = await pool.query(`
          INSERT INTO users (email, password, full_name, role, avatar)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, email, full_name, role, avatar;
        `, [cleanEmail, hashedPassword, cleanFullName, role, avatar]);
        newUser = result.rows[0];
      } catch (err) {
        logger.error('PG_AUTH_REGISTER', err.message);
      }
    }

    if (!newUser) {
      const { data, error } = await supabase.from('users').insert([{
        email: cleanEmail,
        password: hashedPassword,
        full_name: cleanFullName,
        role: role,
        avatar: avatar
      }]).select('id, email, full_name, role, avatar').single();

      if (error) throw error;
      newUser = data;
    }

    logger.auth('REGISTER', cleanEmail, true, `Tạo tài khoản thành công (ID: ${newUser.id})`);
    return res.json({ success: true, message: 'Đăng ký tài khoản thành công!', data: newUser });
  } catch (err) {
    logger.error('AUTH_REGISTER', err.message, err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Đăng nhập người dùng (kiểm tra mật khẩu & sinh JWT Token)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ email và mật khẩu.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = null;

    if (process.env.DATABASE_URL) {
      try {
        const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1;', [cleanEmail]);
        if (result.rows.length > 0) user = result.rows[0];
      } catch (err) {
        logger.error('PG_AUTH_LOGIN', err.message);
      }
    }

    if (!user) {
      const { data, error } = await supabase.from('users').select('*').eq('email', cleanEmail).maybeSingle();
      if (data) user = data;
    }

    if (!user) {
      logger.auth('LOGIN', cleanEmail, false, 'Email không tồn tại');
      return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    let isMatch = false;
    if (user.password && user.password.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (password === user.password);
    }

    if (!isMatch) {
      logger.auth('LOGIN', cleanEmail, false, 'Sai mật khẩu');
      return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.full_name },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const defaultAvatar = user.avatar || (user.role === 'ADMIN'
      ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
      : `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email}`);

    logger.auth('LOGIN', cleanEmail, true, `Role: ${user.role} | Name: ${user.full_name}`);
    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        avatar: defaultAvatar
      }
    });
  } catch (err) {
    logger.error('AUTH_LOGIN', err.message, err);
    return res.status(500).json({ success: false, message: err.message });
  }
};