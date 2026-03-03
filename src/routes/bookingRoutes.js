// src/routes/bookingRoutes.js
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ── Auto-delete expired approved bookings ────────────────────────────────────
// Called on every GET so expired bookings disappear automatically
const deleteExpiredBookings = async () => {
  try {
    // Parse booking end time and compare to current time
    // booking has day (Monday..Saturday), start_time (HH:MM), end_time (HH:MM)
    // We delete approved bookings where the day+end_time is in the past
    await pool.query(`
      DELETE FROM booking_requests
      WHERE status = 'approved'
        AND end_time IS NOT NULL
        AND (
          -- Convert day name to a day-of-week offset from Monday
          CASE day
            WHEN 'Monday'    THEN 1
            WHEN 'Tuesday'   THEN 2
            WHEN 'Wednesday' THEN 3
            WHEN 'Thursday'  THEN 4
            WHEN 'Friday'    THEN 5
            WHEN 'Saturday'  THEN 6
            ELSE 7
          END
        ) <= EXTRACT(DOW FROM NOW())
        AND end_time::time < NOW()::time
        AND (
          CASE day
            WHEN 'Monday'    THEN 1
            WHEN 'Tuesday'   THEN 2
            WHEN 'Wednesday' THEN 3
            WHEN 'Thursday'  THEN 4
            WHEN 'Friday'    THEN 5
            WHEN 'Saturday'  THEN 6
            ELSE 7
          END
        ) = EXTRACT(DOW FROM NOW())
    `);
  } catch (e) {
    // Don't crash the route if cleanup fails
    console.error('Auto-expire bookings error:', e.message);
  }
};

// Notify admin on new booking
const notifyAdminNewBooking = async (booking) => {
  try {
    const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
    if (!adminChatId || !process.env.TELEGRAM_BOT_TOKEN) return;
    const TelegramNotifier = require('../services/telegramNotifier');
    const notifier = TelegramNotifier.getInstance();
    const msg =
      `🏫 <b>New Lab Booking Request</b>\n\n` +
      `👤 <b>Name:</b> ${booking.guest_name}\n` +
      `📞 <b>Phone:</b> ${booking.phone || '—'}\n` +
      `👥 <b>Group:</b> ${booking.group_name}\n` +
      `📅 <b>Day:</b> ${booking.day}\n` +
      `⏰ <b>Time:</b> ${booking.start_time}${booking.end_time ? ' – ' + booking.end_time : ''}\n` +
      `📝 <b>Purpose:</b> ${booking.purpose}\n\n` +
      `<i>Go to Lab Bookings tab to approve or reject.</i>`;
    await notifier.sendMessage(adminChatId, msg);
  } catch (e) {
    console.error('Admin booking notify error:', e.message);
  }
};

// GET all booking requests (public — guests need to see their pending bookings)
router.get('/', async (req, res) => {
  try {
    await deleteExpiredBookings();
    const result = await pool.query(
      `SELECT * FROM booking_requests ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST new booking (public — guests submit)
router.post('/', async (req, res) => {
  try {
    const { guest_name, phone, group_name, day, start_time, end_time, purpose, room } = req.body;
    if (!guest_name || !group_name || !day || !start_time || !purpose)
      return res.status(400).json({ success: false, error: 'Missing required fields' });

    const result = await pool.query(
      `INSERT INTO booking_requests
         (guest_name, phone, group_name, day, start_time, end_time, purpose, room, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
       RETURNING *`,
      [guest_name, phone || '', group_name, day, start_time, end_time || '', purpose, room || '']
    );
    const booking = result.rows[0];

    // Notify admin via Telegram
    await notifyAdminNewBooking(booking);

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT approve/reject (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' | 'rejected'
    const result = await pool.query(
      `UPDATE booking_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ success: false, error: 'Booking not found' });

    // If approved and there's a room/time, optionally add to schedule
    const b = result.rows[0];
    if (status === 'approved' && b.room && b.group_name && b.day && b.start_time) {
      try {
        await pool.query(
          `INSERT INTO schedules (group_name, day, time, course, teacher, room, subject_type)
           VALUES ($1,$2,$3,$4,$5,$6,'other')
           ON CONFLICT (group_name, day, time) DO NOTHING`,
          [b.group_name, b.day, b.start_time, b.purpose, b.guest_name, b.room]
        );
      } catch { /* conflict is fine */ }
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE booking (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM booking_requests WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;