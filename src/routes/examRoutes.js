// src/routes/examRoutes.js
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Ensure exams table exists
pool.query(`
  CREATE TABLE IF NOT EXISTS exams (
    id           SERIAL PRIMARY KEY,
    group_name   TEXT NOT NULL,
    subject      TEXT NOT NULL,
    teacher      TEXT NOT NULL,
    room         TEXT NOT NULL,
    exam_date    DATE NOT NULL,
    start_time   TEXT NOT NULL,
    duration     INT  NOT NULL DEFAULT 90,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(err => console.error('exams table init:', err.message));

// GET all exams (optionally filter by date range)
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query  = 'SELECT * FROM exams';
    const vals = [];
    if (from && to) {
      query += ' WHERE exam_date BETWEEN $1 AND $2';
      vals.push(from, to);
    }
    query += ' ORDER BY exam_date ASC, start_time ASC';
    const result = await pool.query(query, vals);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST — create exam
router.post('/', authenticateToken, async (req, res) => {
  const { group_name, subject, teacher, room, exam_date, start_time, duration, notes } = req.body;
  if (!group_name || !subject || !room || !exam_date || !start_time)
    return res.status(400).json({ success: false, error: 'group_name, subject, room, exam_date, start_time are required' });

  // Conflict check: same room, same date, overlapping time
  try {
    const dur      = parseInt(duration) || 90;
    const existing = await pool.query(
      `SELECT * FROM exams WHERE room = $1 AND exam_date = $2`,
      [room, exam_date]
    );

    const toMins = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
    const newStart = toMins(start_time);
    const newEnd   = newStart + dur;

    const conflict = existing.rows.find(e => {
      const eStart = toMins(e.start_time);
      const eEnd   = eStart + e.duration;
      return newStart < eEnd && newEnd > eStart;
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        error: `Room ${room} is already booked from ${conflict.start_time} (${conflict.duration}min) for ${conflict.group_name} — ${conflict.subject}`
      });
    }

    const result = await pool.query(
      `INSERT INTO exams (group_name, subject, teacher, room, exam_date, start_time, duration, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [group_name, subject, teacher, room, exam_date, start_time, dur, notes || null]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT — update exam
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { group_name, subject, teacher, room, exam_date, start_time, duration, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE exams SET group_name=$1, subject=$2, teacher=$3, room=$4,
       exam_date=$5, start_time=$6, duration=$7, notes=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [group_name, subject, teacher, room, exam_date, start_time, duration || 90, notes || null, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Exam not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE exam
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM exams WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;