const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async function(req, res) {
  try {
    var username = (req.body.username || '').trim();
    var password = req.body.password || '';
    if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required' });
    var result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    var user = result.rows[0];
    var valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    var token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ success: true, token: token, user: { id: user.id, username: user.username, role: user.role } });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/verify', authenticateToken, async function(req, res) {
  try {
    var result = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/logout', authenticateToken, function(req, res) {
  res.json({ success: true, message: 'Logged out' });
});

router.post('/change-password', authenticateToken, async function(req, res) {
  try {
    var currentPassword = req.body.currentPassword || '';
    var newPassword = req.body.newPassword || '';
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Valid passwords required (min 6 chars)' });
    }
    var result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    var user = result.rows[0];
    var valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, error: 'Current password incorrect' });
    var hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true, message: 'Password changed' });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
