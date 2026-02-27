// Backend: src/routes/broadcastRoutes.js
const express  = require('express');
const router   = express.Router();
const pool     = require('../config/database');
const { Telegraf } = require('telegraf');
const { authenticateToken } = require('../middleware/auth');

// Create a lightweight bot sender directly from the token.
// This avoids the singleton dependency problem where getNotifier() can
// return null if the cron module was required in a different module scope.
function getBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return new Telegraf(token);
}

async function sendMsg(bot, chatId, text) {
  try {
    await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.description || e.message };
  }
}

// POST /api/broadcast
router.post('/', authenticateToken, async (req, res) => {
  const { subject, message, teacherIds = [], groupNames = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  const bot = getBot();
  if (!bot) {
    return res.status(503).json({
      success: false,
      error: 'TELEGRAM_BOT_TOKEN is not set in environment variables.'
    });
  }

  if (teacherIds.length === 0 && groupNames.length === 0) {
    return res.status(400).json({ success: false, error: 'No recipients specified.' });
  }

  // Build the Telegram message text
  const buildText = () => {
    let text = `📢 <b>Message from University Admin</b>\n\n`;
    if (subject?.trim()) text += `📌 <b>${subject.trim()}</b>\n\n`;
    text += message.trim();
    text += `\n\n<i>— University Admin</i>`;
    return text;
  };
  const msgText = buildText();

  const details = [];
  let sent = 0, failed = 0;

  // Send to teachers
  if (teacherIds.length > 0) {
    try {
      const placeholders = teacherIds.map((_, i) => `$${i + 1}`).join(',');
      const result = await pool.query(
        `SELECT id, name, telegram_id FROM teachers
         WHERE id IN (${placeholders}) AND telegram_id IS NOT NULL`,
        teacherIds
      );
      for (const teacher of result.rows) {
        const r = await sendMsg(bot, teacher.telegram_id, msgText);
        details.push({ name: teacher.name, type: 'teacher', ...r });
        r.ok ? sent++ : failed++;
      }
    } catch (e) {
      console.error('broadcast teachers:', e.message);
    }
  }

  // Send to group channels
  if (groupNames.length > 0) {
    try {
      const placeholders = groupNames.map((_, i) => `$${i + 1}`).join(',');
      const result = await pool.query(
        `SELECT group_name, chat_id FROM group_channels
         WHERE group_name IN (${placeholders})`,
        groupNames
      );
      for (const group of result.rows) {
        const r = await sendMsg(bot, group.chat_id, msgText);
        details.push({ name: group.group_name, type: 'group', ...r });
        r.ok ? sent++ : failed++;
      }
    } catch (e) {
      console.error('broadcast groups:', e.message);
    }
  }

  // Log the broadcast
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS broadcast_log (
        id             SERIAL PRIMARY KEY,
        subject        TEXT,
        message        TEXT,
        recipient_count INT,
        sent_count     INT,
        failed_count   INT,
        created_at     TIMESTAMPTZ DEFAULT NOW()
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