// src/routes/groupRoutes.js
const express = require('express');
const GroupController = require('../controllers/groupController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Manual validation middleware â€” no express-validator needed
const validateGroup = (req, res, next) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Group name is required' });
  }
  if (name.trim().length > 50) {
    return res.status(400).json({ success: false, error: 'Group name must be under 50 characters' });
  }
  req.body.name = name.trim();
  next();
};

// Public
router.get('/', GroupController.getAll);

// Admin only
router.post('/',   authenticateToken, requireAdmin, validateGroup, GroupController.create);
router.delete('/:name', authenticateToken, requireAdmin, GroupController.delete);

module.exports = router;