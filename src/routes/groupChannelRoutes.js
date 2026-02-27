const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', async function(req, res) {
  try {
    const result = await pool.query('SELECT name FROM groups ORDER BY name');
    res.json(result.rows.map(function(r) { return r.name; }));
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/', authenticateToken, requireAdmin, async function(req, res) {
  try {
    var name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'Name required' });
    await pool.query('INSERT INTO groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    res.json({ success: true, data: { name: name } });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:name', authenticateToken, requireAdmin, async function(req, res) {
  try {
    var name = req.params.name;
    await pool.query('DELETE FROM schedules WHERE group_name = $1', [name]);
    await pool.query('DELETE FROM groups WHERE name = $1', [name]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;