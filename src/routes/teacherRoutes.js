// Backend: src/routes/teacherRoutes.js
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ── GET /api/teachers ─────────────────────────────────────────────────────────
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

// ── POST /api/teachers/save-telegram ─────────────────────────────────────────
// Save telegram_id by id (if known) or by name (creates record if missing)
// Using POST /save-telegram avoids any conflict with PUT /:id routes
router.post('/save-telegram', authenticateToken, async (req, res) => {
  const { id, name, telegram_id } = req.body;
  if (!telegram_id?.trim()) return res.status(400).json({ success: false, error: 'telegram_id is required' });
  if (!name?.trim() && !id)  return res.status(400).json({ success: false, error: 'name or id is required' });

  try {
    let result;

    if (id) {
      // Update by id — fastest path
      result = await pool.query(
        'UPDATE teachers SET telegram_id = $1 WHERE id = $2 RETURNING id, name, telegram_id',
        [telegram_id.trim(), id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Teacher not found by id' });
      }
    } else {
      // Find by name
      const existing = await pool.query(
        'SELECT id FROM teachers WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
        [name.trim()]
      );
      if (existing.rows.length > 0) {
        result = await pool.query(
          'UPDATE teachers SET telegram_id = $1 WHERE id = $2 RETURNING id, name, telegram_id',
          [telegram_id.trim(), existing.rows[0].id]
        );
      } else {
        // Create new teacher record
        result = await pool.query(
          'INSERT INTO teachers (name, telegram_id) VALUES ($1, $2) RETURNING id, name, telegram_id',
          [name.trim(), telegram_id.trim()]
        );
      }
    }

    console.log('Saved telegram for "' + (name || id) + '": ' + telegram_id);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /teachers/save-telegram:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/teachers/:id/telegram ───────────────────────────────────────────
router.put('/:id/telegram', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { telegram_id } = req.body;
  if (!telegram_id) return res.status(400).json({ success: false, error: 'telegram_id is required' });
  try {
    const result = await pool.query(
      'UPDATE teachers SET telegram_id = $1 WHERE id = $2 RETURNING id, name, telegram_id',
      [telegram_id.toString(), id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Teacher not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /teachers/:id/telegram:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/teachers/:id/telegram ────────────────────────────────────────
router.delete('/:id/telegram', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE teachers SET telegram_id = NULL WHERE id = $1 RETURNING id, name',
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Teacher not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /teachers/:id/telegram:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/teachers/:id/name ────────────────────────────────────────────────
router.put('/:id/name', authenticateToken, async (req, res) => {
  const { id }   = req.params;
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, error: 'name is required' });
  try {
    const result = await pool.query(
      'UPDATE teachers SET name = $1 WHERE id = $2 RETURNING id, name',
      [name.trim(), id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/teachers/:id ──────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM teachers WHERE id = $1 RETURNING id, name',
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Teacher not found' });
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error('DELETE /teachers/:id:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /teachers/:id/notifications — toggle notifications on/off
router.put('/:id/notifications', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;
  try {
    const result = await pool.query(
      'UPDATE teachers SET notifications_enabled = $1 WHERE id = $2 RETURNING id, name, notifications_enabled',
      [enabled === true || enabled === 'true', id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Teacher not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /teachers/:id/notifications:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;