const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ success: false, error: 'Username is required' });
  if (!password) return res.status(400).json({ success: false, error: 'Password is required' });
  next();
}, AuthController.login);

router.get('/verify', authenticateToken, AuthController.verify);
router.post('/logout', authenticateToken, AuthController.logout);

router.post('/change-password', authenticateToken, (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword) return res.status(400).json({ success: false, error: 'Current password is required' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
  next();
}, AuthController.changePassword);

module.exports = router;
