const express = require('express');
const GroupController = require('../controllers/groupController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', GroupController.getAll);

router.post('/', authenticateToken, requireAdmin, (req, res, next) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Group name is required' });
  }
  req.body.name = name.trim();
  next();
}, GroupController.create);

router.delete('/:name', authenticateToken, requireAdmin, GroupController.delete);

module.exports = router;