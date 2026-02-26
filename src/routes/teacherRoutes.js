// Backend: src/routes/teacherRoutes.js
const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Get all teachers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, telegram_id, notifications_enabled FROM teachers ORDER BY name'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update teacher
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { name, telegram_id, notifications_enabled } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO teachers (name, telegram_id, notifications_enabled)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) 
        DO UPDATE SET telegram_id = $2, notifications_enabled = $3
        RETURNING *`,
      [name, telegram_id, notifications_enabled !== false]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update teacher telegram ID
router.put('/:id/telegram', authenticateToken, requireAdmin, async (req, res) => {
  const { telegram_id } = req.body;

  try {
    const result = await pool.query(
      'UPDATE teachers SET telegram_id = $1 WHERE id = $2 RETURNING *',
      [telegram_id?.toString().trim(), req.params.id] 
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete teacher
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM teachers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// TEMP DEBUG - remove after fixing
router.get('/debug', async (req, res) => {
  const result = await pool.query('SELECT id, name, telegram_id FROM teachers');
  res.json(result.rows);
});

module.exports = router;