// backend/src/routes/authRoutes.js
'use strict';

const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const pool     = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET      = process.env.JWT_SECRET      || 'fallback-secret-change-me';
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN  || '24h';

// ── POST /api/auth/login ─────────────────────────────────────────────────────
// ⚠️  NO authenticateToken here — this is the public login endpoint.
//    Adding auth middleware to login causes a 401 loop: the user can never
//    log in because they need a token to get a token.
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash, role FROM users WHERE username = $1',
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      token,
      user: { username: user.username, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Server error during login.' });
  }
});

// ── GET /api/auth/verify ─────────────────────────────────────────────────────
// Requires a valid token — used by AuthContext on app startup to check if the
// saved token is still valid. Returns 401 when no/expired token (expected).
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── POST /api/auth/change-password ──────────────────────────────────────────
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newHash, req.user.id]
    );

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, error: 'Server error.' });
  }
});

module.exports = router;