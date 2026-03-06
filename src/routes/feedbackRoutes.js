// src/routes/feedbackRoutes.js
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ── Ensure table ──────────────────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS feedback (
    id            SERIAL PRIMARY KEY,
    category      TEXT    NOT NULL,  -- 'room' | 'teacher' | 'group' | 'general'
    subject       TEXT    NOT NULL,  -- room name / teacher name / group name / 'General'
    message       TEXT    NOT NULL,
    anonymous     BOOLEAN NOT NULL DEFAULT true,
    telegram_id   TEXT,              -- null if anonymous
    sender_name   TEXT,              -- null if anonymous
    sender_email  TEXT,              -- null if anonymous
    status        TEXT    NOT NULL DEFAULT 'new',  -- 'new' | 'read' | 'resolved'
    created_at    TIMESTAMPTZ DEFAULT NOW()
  )
`).then(() =>
  pool.query('ALTER TABLE feedback ADD COLUMN IF NOT EXISTS sender_email TEXT')
).catch(err => console.error('feedback table init:', err.message));

// GET all feedback (admin only) — optional filters: category, subject, status
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, subject, status } = req.query;
    const conditions = [];
    const vals       = [];
    if (category) { conditions.push(`category = $${vals.length+1}`); vals.push(category); }
    if (subject)  { conditions.push(`subject  = $${vals.length+1}`); vals.push(subject);  }
    if (status)   { conditions.push(`status   = $${vals.length+1}`); vals.push(status);   }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM feedback ${where} ORDER BY created_at DESC`,
      vals
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET stats summary (admin only)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const total     = await pool.query('SELECT COUNT(*) FROM feedback');
    const unread    = await pool.query("SELECT COUNT(*) FROM feedback WHERE status = 'new'");
    const byCategory = await pool.query(
      `SELECT category, COUNT(*) as count FROM feedback GROUP BY category ORDER BY count DESC`
    );
    const bySubject  = await pool.query(
      `SELECT subject, category, COUNT(*) as count FROM feedback
       GROUP BY subject, category ORDER BY count DESC LIMIT 10`
    );
    res.json({
      success: true,
      total:      parseInt(total.rows[0].count),
      unread:     parseInt(unread.rows[0].count),
      byCategory: byCategory.rows,
      bySubject:  bySubject.rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST — submit feedback (public — from bot or web)
router.post('/', async (req, res) => {
  const { category, subject, message, anonymous, telegram_id, sender_name, sender_email } = req.body;
  if (!category || !subject || !message?.trim())
    return res.status(400).json({ success: false, error: 'category, subject, message required' });
  try {
    const isAnon = anonymous !== false;
    const result = await pool.query(
      `INSERT INTO feedback (category, subject, message, anonymous, telegram_id, sender_name, sender_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        category, subject, message.trim(), isAnon,
        isAnon ? null : (telegram_id || null),
        isAnon ? null : (sender_name || null),
        isAnon ? null : (sender_email || null),
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT — update status (admin only)
router.put('/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  if (!['new','read','resolved'].includes(status))
    return res.status(400).json({ success: false, error: 'Invalid status' });
  try {
    const result = await pool.query(
      'UPDATE feedback SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM feedback WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;