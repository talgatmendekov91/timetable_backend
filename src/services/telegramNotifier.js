// Backend: src/services/telegramNotifier.js
const { Telegraf } = require('telegraf');
const pool = require('../config/database');

class TelegramNotifier {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.setupBot();
  }

  setupBot() {
    // Drop any existing webhook and pending updates before launching
    // This prevents 409 Conflict when Railway restarts the container
    this.bot.telegram.deleteWebhook({ drop_pending_updates: true })
      .then(() => {
        this.bot.launch({ dropPendingUpdates: true });
        console.log('✅ Telegram bot started');
      })
      .catch((err) => {
        console.error('Failed to delete webhook:', err.message);
        // Launch anyway
        this.bot.launch({ dropPendingUpdates: true });
        console.log('✅ Telegram bot started (fallback)');
      });

    // /start — teacher gets their Telegram ID
    this.bot.command('start', async (ctx) => {
      const telegramId = ctx.from.id;
      const username   = ctx.from.username || ctx.from.first_name;
      ctx.reply(
        `Welcome to University Schedule Bot! 🎓\n\n` +
        `Your Telegram ID: <code>${telegramId}</code>\n` +
        `Username: @${username}\n\n` +
        `Please ask your admin to link this ID to your teacher account.`,
        { parse_mode: 'HTML' }
      );
    });

    // /status — check if linked
    this.bot.command('status', async (ctx) => {
      const telegramId = ctx.from.id;
      try {
        const result = await pool.query(
          'SELECT name FROM teachers WHERE telegram_id = $1',
          [telegramId.toString()]
        );
        if (result.rows.length > 0) {
          ctx.reply(`✅ You are registered as <b>${result.rows[0].name}</b>.`, { parse_mode: 'HTML' });
        } else {
          ctx.reply(
            `❌ Not registered yet.\n\nYour Telegram ID: <code>${telegramId}</code>\nAsk your admin to link it.`,
            { parse_mode: 'HTML' }
          );
        }
      } catch {
        ctx.reply('Error checking status. Please try again later.');
      }
    });

  }

  // ── Core send ───────────────────────────────────────────────────────────────

  async sendMessage(chatId, message) {
    try {
      await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
      return true;
    } catch (error) {
      console.error(`Failed to send to ${chatId}:`, error.message);
      return false;
    }
  }

  // ── Schedule change notifications ───────────────────────────────────────────
  // Called from scheduleRoutes whenever a class is added, updated, or deleted.
  // changeType: 'added' | 'updated' | 'deleted'
  // classData:  { group, day, time, course, teacher, room, duration }
  // oldData:    previous classData (only for 'updated')

  async notifyScheduleChange(changeType, classData, oldData = null) {
    if (!classData) return;
    const { group, teacher } = classData;

    // 1. Notify the teacher personally
    try {
      const { rows } = await pool.query(
        `SELECT telegram_id FROM teachers WHERE LOWER(name) = LOWER($1) AND telegram_id IS NOT NULL`,
        [teacher || '']
      );
      if (rows.length > 0) {
        await this.sendMessage(rows[0].telegram_id, this._teacherMsg(changeType, classData, oldData));
      }
    } catch (e) {
      console.error('notifyScheduleChange (teacher):', e.message);
    }

    // 2. Notify the group channel
    try {
      const { rows } = await pool.query(
        `SELECT chat_id FROM group_channels WHERE group_name = $1`,
        [group]
      );
      if (rows.length > 0) {
        await this.sendMessage(rows[0].chat_id, this._groupMsg(changeType, classData, oldData));
      }
    } catch (e) {
      console.error('notifyScheduleChange (group):', e.message);
    }
  }

  _teacherMsg(changeType, data, oldData) {
    const { group, day, time, course, room, duration } = data;
    const dur = duration > 1 ? ` (${duration * 40} min)` : '';
    const base = `📚 <b>${course}</b>\n👥 Group: ${group}\n📅 ${day}  ⏰ ${time}${dur}\n🏫 Room: ${room || 'TBA'}`;
    const header = `🏛 <b>Alatoo International University</b>\n<i>Faculty Administration</i>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const footer = `\n\n━━━━━━━━━━━━━━━━━━━━━━\n<i>— Faculty Administration</i>`;

    if (changeType === 'added')
      return `${header}📅 <b>New Class Added to Your Schedule</b>\n\n${base}${footer}`;
    if (changeType === 'deleted')
      return `${header}🗑 <b>Class Removed from Your Schedule</b>\n\n${base}${footer}`;

    const diff = this._diff(oldData, data);
    return `${header}✏️ <b>Schedule Update</b>\n\n${base}${diff ? `\n\n<b>Changes:</b>\n${diff}` : ''}${footer}`;
  }

  _groupMsg(changeType, data, oldData) {
    const { day, time, course, teacher, room, duration } = data;
    const dur = duration > 1 ? ` (${duration * 40} min)` : '';
    const base = `📚 <b>${course}</b>\n👨‍🏫 Lecturer: ${teacher || 'TBA'}\n📅 ${day}  ⏰ ${time}${dur}\n🏫 Room: ${room || 'TBA'}`;
    const header = `🏛 <b>Alatoo International University</b>\n<i>Faculty Administration</i>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const footer = `\n\n━━━━━━━━━━━━━━━━━━━━━━\n<i>— Faculty Administration</i>`;

    if (changeType === 'added')
      return `${header}📅 <b>New Class Added to Your Schedule</b>\n\n${base}${footer}`;
    if (changeType === 'deleted')
      return `${header}🗑 <b>Class Cancelled</b>\n\n${base}${footer}`;

    const diff = this._diff(oldData, data);
    return `${header}✏️ <b>Schedule Update</b>\n\n${base}${diff ? `\n\n<b>Changes:</b>\n${diff}` : ''}${footer}`;
  }

  _diff(oldData, newData) {
    if (!oldData) return '';
    const fields = { course: '📚 Course', room: '🏫 Room', day: '📅 Day', time: '⏰ Time', teacher: '👨‍🏫 Teacher' };
    return Object.entries(fields)
      .filter(([k]) => oldData[k] !== newData[k])
      .map(([k, label]) => `  ${label}: ${oldData[k] || '—'} → ${newData[k] || '—'}`)
      .join('\n');
  }

  stop() {
    this.bot.stop('SIGTERM');
  }
}

// Singleton so only one bot instance is created
let _instance = null;

TelegramNotifier.getInstance = function() {
  if (!_instance) {
    _instance = new TelegramNotifier();
  }
  return _instance;
};

module.exports = TelegramNotifier;