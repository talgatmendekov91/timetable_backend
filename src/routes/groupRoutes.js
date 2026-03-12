// src/routes/groupRoutes.js
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/groups — returns plain string array ['COMSE-25', ...]
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name FROM groups ORDER BY name'
    );
    const groups = result.rows.map(r => r.name);
    res.json(groups);
  } catch (err) {
    console.error('GET /groups error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/groups — add a group
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    await pool.query(
      'INSERT INTO groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('POST /groups error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/groups/:name
router.delete('/:name', authenticateToken, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    await pool.query('DELETE FROM groups WHERE name=$1', [name]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /groups error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;