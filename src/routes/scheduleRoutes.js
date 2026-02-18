const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

const VALID_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

router.get('/', async function(req, res) {
  try {
    var result = await pool.query('SELECT * FROM schedules ORDER BY group_name, day, time');
    var map = {};
    result.rows.forEach(function(row) {
      var key = row.group_name + '-' + row.day + '-' + row.time;
      map[key] = {
        id: row.id,
        group: row.group_name,
        day: row.day,
        time: row.time,
        course: row.course,
        teacher: row.teacher || '',
        room: row.room || '',
        subjectType: row.subject_type || 'lecture'
      };
    });
    res.json(map);
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/teachers', async function(req, res) {
  try {
    var result = await pool.query("SELECT DISTINCT teacher FROM schedules WHERE teacher IS NOT NULL AND teacher != '' ORDER BY teacher");
    res.json(result.rows.map(function(r) { return r.teacher; }));
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/day/:day', async function(req, res) {
  try {
    var result = await pool.query('SELECT * FROM schedules WHERE day = $1 ORDER BY time, group_name', [req.params.day]);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/teacher/:teacher', async function(req, res) {
  try {
    var result = await pool.query('SELECT * FROM schedules WHERE teacher = $1 ORDER BY day, time', [req.params.teacher]);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/group/:group', async function(req, res) {
  try {
    var result = await pool.query('SELECT * FROM schedules WHERE group_name = $1 ORDER BY day, time', [req.params.group]);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/', authenticateToken, requireAdmin, async function(req, res) {
  try {
    var group = req.body.group, day = req.body.day, time = req.body.time;
    var course = req.body.course, teacher = req.body.teacher || null;
    var room = req.body.room || null, subjectType = req.body.subjectType || 'lecture';
    if (!group || !day || !time || !course) {
      return res.status(400).json({ success: false, error: 'group, day, time and course are required' });
    }
    if (!VALID_DAYS.includes(day)) {
      return res.status(400).json({ success: false, error: 'Invalid day' });
    }
    await pool.query('INSERT INTO groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [group]);
    var result = await pool.query(
      'INSERT INTO schedules (group_name, day, time, course, teacher, room, subject_type) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (group_name, day, time) DO UPDATE SET course=$4, teacher=$5, room=$6, subject_type=$7, updated_at=CURRENT_TIMESTAMP RETURNING *',
      [group, day, time, course, teacher, room, subjectType]
    );
    var row = result.rows[0];
    res.json({ success: true, data: { id: row.id, group: row.group_name, day: row.day, time: row.time, course: row.course, teacher: row.teacher, room: row.room, subjectType: row.subject_type } });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:group/:day/:time', authenticateToken, requireAdmin, async function(req, res) {
  try {
    var result = await pool.query(
      'DELETE FROM schedules WHERE group_name = $1 AND day = $2 AND time = $3 RETURNING *',
      [req.params.group, req.params.day, req.params.time]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;