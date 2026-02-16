const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/login', function(req, res) {
  const { username, password } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ success: false, error: 'Username is required' });
  if (!password) return res.status(400).json({ success: false, error: 'Password is required' });
  AuthController.login(req, res);
});

router.get('/verify', authenticateToken, function(req, res) {
  AuthController.verify(req, res);
});

router.post('/logout', authenticateToken, function(req, res) {
  AuthController.logout(req, res);
});

router.post('/change-password', authenticateToken, function(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword) return res.status(400).json({ success: false, error: 'Current password is required' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
  AuthController.changePassword(req, res);
});

module.exports = router;