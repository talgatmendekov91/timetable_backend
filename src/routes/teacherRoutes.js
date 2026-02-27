// Backend: src/routes/teacherRoutes.js
// REPLACE your entire existing teacherRoutes.js with this file

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET all teachers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, telegram_id, notifications_enabled FROM teachers ORDER BY name'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /teachers:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /teachers/:id/telegram  — save Telegram ID
router.put('/:id/telegram', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { telegram_id } = req.body;
  if (!telegram_id) {
    return res.status(400).json({ success: false, error: 'telegram_id is required' });
  }
  try {
    // Does NOT use updated_at — safe for any schema
    const result = await pool.query(
      `UPDATE teachers SET telegram_id = $1 WHERE id = $2 RETURNING id, name, telegram_id`,
      [telegram_id.toString(), id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /teachers/:id/telegram:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /teachers/:id/telegram  — clear Telegram ID
router.delete('/:id/telegram', authenticateToken, async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /teachers/${id}/telegram called`);
  try {
    // Does NOT use updated_at — safe for any schema
    const result = await pool.query(
      `UPDATE teachers SET telegram_id = NULL WHERE id = $1 RETURNING id, name, telegram_id`,
      [id]
    );
    console.log(`Rows updated: ${result.rowCount}`);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: `Teacher with id=${id} not found` });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /teachers/:id/telegram ERROR:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /teachers/:id  — permanently remove a teacher record
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /teachers/${id} called`);
  try {
    const result = await pool.query(
      'DELETE FROM teachers WHERE id = $1 RETURNING id, name',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: `Teacher id=${id} not found` });
    }
    console.log(`Deleted teacher: ${result.rows[0].name}`);
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error('DELETE /teachers/:id ERROR:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;