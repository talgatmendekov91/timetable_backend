// src/routes/bookingRoutes.js
const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Guest: Submit booking request
router.post('/', async function(req, res) {
  try {
    const { name, email, phone, room, day, startTime, duration, purpose } = req.body;
    
    if (!name || !email || !room || !day || !startTime || !duration || !purpose) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }

    const result = await pool.query(
      `INSERT INTO booking_requests (name, email, phone, room, day, start_time, duration, purpose, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', CURRENT_TIMESTAMP)
       RETURNING *`,
      [name, email, phone, room, day, startTime, duration, purpose]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch(e) { 
    res.status(500).json({ success: false, error: e.message }); 
  }
});

// Admin: Get all booking requests
router.get('/', authenticateToken, requireAdmin, async function(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM booking_requests ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: Get pending count
router.get('/pending-count', authenticateToken, requireAdmin, async function(req, res) {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) as count FROM booking_requests WHERE status = 'pending'"
    );
    res.json({ success: true, count: parseInt(result.rows[0].count) });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: Approve booking (adds to schedule)
router.post('/:id/approve', authenticateToken, requireAdmin, async function(req, res) {
  try {
    const { id } = req.params;
    
    // Get booking details
    const booking = await pool.query('SELECT * FROM booking_requests WHERE id = $1', [id]);
    if (booking.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const b = booking.rows[0];
    
    // Create a temporary group for booking if needed
    const groupName = `BOOKING-${b.name.split(' ')[0]}`;
    await pool.query(
      'INSERT INTO groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [groupName]
    );

    // Add to schedule
    await pool.query(
      `INSERT INTO schedules (group_name, day, time, course, teacher, room, subject_type, duration)
       VALUES ($1, $2, $3, $4, $5, $6, 'other', $7)
       ON CONFLICT (group_name, day, time) DO UPDATE 
       SET course = $4, teacher = $5, room = $6, duration = $7`,
      [groupName, b.day, b.start_time, b.purpose, b.name, b.room, b.duration]
    );

    // Mark as approved
    await pool.query(
      "UPDATE booking_requests SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    res.json({ success: true, message: 'Booking approved and added to schedule' });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: Reject booking
router.post('/:id/reject', authenticateToken, requireAdmin, async function(req, res) {
  try {
    await pool.query(
      "UPDATE booking_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [req.params.id]
    );
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: Delete booking request
router.delete('/:id', authenticateToken, requireAdmin, async function(req, res) {
  try {
    await pool.query('DELETE FROM booking_requests WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
