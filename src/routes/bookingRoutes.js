// src/routes/bookingRoutes.js
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Auto-add columns if missing
pool.query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS entity   VARCHAR(200)').catch(()=>{});
pool.query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS email    VARCHAR(200)').catch(()=>{});
pool.query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS end_time VARCHAR(20)').catch(()=>{});

const deleteExpired = async () => {
  try {
    await pool.query(`DELETE FROM booking_requests WHERE status='approved' AND end_time IS NOT NULL AND end_time!='' AND EXTRACT(DOW FROM NOW())=CASE day WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE 0 END AND end_time::time < NOW()::time`);
  } catch(e) { console.error('Auto-expire:',e.message); }
};

const notifyAdmin = async (b) => {
  try {
    const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
    if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) return;
    const notifier = require('../services/telegramNotifier').getInstance();
    await notifier.sendMessage(chatId,
      `<b>New Lab Booking</b>\n\n<b>Name:</b> ${b.name}\n<b>Email:</b> ${b.email}\n<b>Phone:</b> ${b.phone||'—'}\n<b>Entity:</b> ${b.entity||'—'}\n<b>Day:</b> ${b.day}\n<b>Time:</b> ${b.start_time} - ${b.end_time}\n<b>Room:</b> ${b.room}\n<b>Purpose:</b> ${b.purpose}\n\n<i>Go to Lab Bookings to approve/reject.</i>`
    );
  } catch(e) { console.error('Admin notify:',e.message); }
};

router.get('/', async (req,res) => {
  try {
    await deleteExpired();
    const r = await pool.query('SELECT * FROM booking_requests ORDER BY created_at DESC');
    res.json({ success:true, data:r.rows });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.post('/', async (req,res) => {
  try {
    const { name, email, phone, entity, day, start_time, end_time, purpose, room } = req.body;
    if (!name) return res.status(400).json({success:false,error:'Name is required'});
    if (!email) return res.status(400).json({success:false,error:'Email is required'});
    if (!String(email).toLowerCase().endsWith('@alatoo.edu.kg'))
      return res.status(400).json({success:false,error:'Only @alatoo.edu.kg emails are permitted to book'});
    if (!day) return res.status(400).json({success:false,error:'Day is required'});
    if (!start_time) return res.status(400).json({success:false,error:'Start time is required'});
    if (!end_time) return res.status(400).json({success:false,error:'End time is required'});
    if (!room) return res.status(400).json({success:false,error:'Room is required'});
    if (!purpose) return res.status(400).json({success:false,error:'Purpose is required'});

    const r = await pool.query(
      `INSERT INTO booking_requests (name,email,phone,entity,day,start_time,end_time,purpose,room,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING *`,
      [name, email, phone||'', entity||'', day, start_time, end_time, purpose, room]
    );
    const booking = r.rows[0];
    notifyAdmin(booking).catch(()=>{});
    res.json({ success:true, data:booking });
  } catch(err) {
    console.error('POST /booking-requests:',err.message);
    res.status(500).json({ success:false, error:err.message });
  }
});

router.put('/:id', authenticateToken, async (req,res) => {
  try {
    const { status } = req.body;
    if (!['approved','rejected'].includes(status))
      return res.status(400).json({success:false,error:'Invalid status'});
    const r = await pool.query(
      'UPDATE booking_requests SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (r.rowCount===0) return res.status(404).json({success:false,error:'Not found'});
    res.json({ success:true, data:r.rows[0] });
  } catch(err) { res.status(500).json({success:false,error:err.message}); }
});

router.delete('/:id', authenticateToken, async (req,res) => {
  try {
    const r = await pool.query('DELETE FROM booking_requests WHERE id=$1 RETURNING id',[req.params.id]);
    if (r.rowCount===0) return res.status(404).json({success:false,error:'Not found'});
    res.json({ success:true });
  } catch(err) { res.status(500).json({success:false,error:err.message}); }
});

module.exports = router;