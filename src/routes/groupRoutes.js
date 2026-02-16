const express = require('express');
const GroupController = require('../controllers/groupController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', function(req, res) { GroupController.getAll(req, res); });

router.post('/', authenticateToken, requireAdmin, function(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Group name is required' });
  req.body.name = name.trim();
  GroupController.create(req, res);
});

router.delete('/:name', authenticateToken, requireAdmin, function(req, res) {
  GroupController.delete(req, res);
});

module.exports = router;