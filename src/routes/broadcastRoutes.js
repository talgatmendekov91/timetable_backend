// Backend: src/routes/broadcastRoutes.js
const express  = require('express');
const router   = express.Router();
const pool     = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Send directly via Telegram HTTP API — avoids conflict with polling bot
const https = require('https');

async function sendMsg(_, chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };

  // Normalize chatId: numeric string → number, @username → keep as string
  let normalizedChatId = chatId;
  if (typeof chatId === 'string' && !chatId.startsWith('@')) {
    const num = parseInt(chatId);
    if (!isNaN(num)) normalizedChatId = num;
  }

  const bodyObj = { chat_id: normalizedChatId, text, parse_mode: 'HTML' };
  const bodyStr = JSON.stringify(bodyObj);

  console.log(`Sending to chat_id: ${normalizedChatId}`);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            console.log(`✅ Sent to ${normalizedChatId}`);
            resolve({ ok: true });
          } else {
            console.error(`❌ Failed to ${normalizedChatId}:`, result.description);
            resolve({ ok: false, error: result.description || JSON.stringify(result) });
          }
        } catch (e) {
          resolve({ ok: false, error: 'Invalid response: ' + data });
        }
      });
    });
    req.on('error', (e) => {
      console.error('Request error:', e.message);
      resolve({ ok: false, error: e.message });
    });
    req.write(bodyStr);
    req.end();
  });
}

function getBot() { return true; }

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
    const now  = new Date();
    const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    let text = '';
    text += `🏛 <b>Alatoo International University</b>\n`;
    text += `<i>Faculty Administration</i>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (subject?.trim()) text += `📌 <b>${subject.trim()}</b>\n\n`;
    text += message.trim();
    text += `\n\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `<i>📅 ${date}</i>\n`;
    text += `<i>— Faculty Administration</i>`;
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