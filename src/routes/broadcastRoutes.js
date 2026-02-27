// Backend: src/routes/broadcastRoutes.js
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

function getNotifier() {
  try { return require('../services/telegramCron').getNotifier(); }
  catch { return null; }
}

// POST /api/broadcast
// Body: { subject, message, teacherIds: [id,...], groupNames: ['CS-101',...] }
router.post('/', authenticateToken, async (req, res) => {
  const { subject, message, teacherIds = [], groupNames = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  const notifier = getNotifier();
  if (!notifier) {
    return res.status(503).json({ success: false, error: 'Telegram bot is not running. Check TELEGRAM_BOT_TOKEN.' });
  }

  const details = [];
  let sent = 0, failed = 0;

  // ── Format the outgoing Telegram message ───────────────────────────────────
  const buildMsg = (emoji) => {
    let text = `${emoji} <b>Message from University Admin</b>\n\n`;
    if (subject) text += `📌 <b>${subject}</b>\n\n`;
    text += message.trim();
    text += `\n\n<i>— University Admin</i>`;
    return text;
  };

  const teacherMsg = buildMsg('📢');
  const groupMsg   = buildMsg('📢');

  // ── Send to individual teachers ────────────────────────────────────────────
  if (teacherIds.length > 0) {
    let placeholders = teacherIds.map((_, i) => `$${i + 1}`).join(',');
    try {
      const result = await pool.query(
        `SELECT id, name, telegram_id FROM teachers WHERE id IN (${placeholders}) AND telegram_id IS NOT NULL`,
        teacherIds
      );
      for (const teacher of result.rows) {
        const ok = await notifier.sendMessage(teacher.telegram_id, teacherMsg);
        details.push({ name: teacher.name, type: 'teacher', ok, error: ok ? null : 'Delivery failed' });
        ok ? sent++ : failed++;
      }
    } catch (e) {
      console.error('broadcast teachers query:', e.message);
    }
  }

  // ── Send to group channels ─────────────────────────────────────────────────
  if (groupNames.length > 0) {
    let placeholders = groupNames.map((_, i) => `$${i + 1}`).join(',');
    try {
      const result = await pool.query(
        `SELECT group_name, chat_id FROM group_channels WHERE group_name IN (${placeholders})`,
        groupNames
      );
      for (const group of result.rows) {
        const ok = await notifier.sendMessage(group.chat_id, groupMsg);
        details.push({ name: group.group_name, type: 'group', ok, error: ok ? null : 'Delivery failed' });
        ok ? sent++ : failed++;
      }
    } catch (e) {
      console.error('broadcast groups query:', e.message);
    }
  }

  // ── Log the broadcast ──────────────────────────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS broadcast_log (
        id          SERIAL PRIMARY KEY,
        subject     TEXT,
        message     TEXT,
        recipient_count INT,
        sent_count  INT,
        failed_count INT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(
      `INSERT INTO broadcast_log (subject, message, recipient_count, sent_count, failed_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [subject || null, message, sent + failed, sent, failed]
    );
  } catch (e) {
    console.error('broadcast log:', e.message);
  }

  res.json({ success: true, sent, failed, details });
});

module.exports = router;