// Backend: src/services/telegramNotifier.js
const { Telegraf } = require('telegraf');
const pool = require('../config/database');

class TelegramNotifier {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.setupBot();
  }

  setupBot() {
    // Command to register telegram ID
    this.bot.command('start', async (ctx) => {
      const telegramId = ctx.from.id;
      const username = ctx.from.username || ctx.from.first_name;
      
      ctx.reply(
        `Welcome to University Schedule Bot! ðŸŽ“\n\n` +
        `Your Telegram ID: ${telegramId}\n` +
        `Username: @${username}\n\n` +
        `Please ask your admin to link this ID to your teacher account.`
      );
    });

    // Command to check registration status
    this.bot.command('status', async (ctx) => {
      const telegramId = ctx.from.id;
      
      try {
        const result = await pool.query(
          'SELECT * FROM teachers WHERE telegram_id = $1',
          [telegramId.toString()]
        );

        if (result.rows.length > 0) {
          const teacher = result.rows[0];
          ctx.reply(
            `âœ… You are registered!\n\n` +
            `Teacher: ${teacher.name}\n` +
            `Notifications: ${teacher.notifications_enabled ? 'ON' : 'OFF'}\n\n` +
            `Use /enable to turn on notifications\n` +
            `Use /disable to turn off notifications`
          );
        } else {
          ctx.reply(
            `âŒ You are not registered yet.\n\n` +
            `Your Telegram ID: ${telegramId}\n` +
            `Please contact your admin to link this ID to your teacher account.`
          );
        }
      } catch (error) {
        ctx.reply('Error checking status. Please try again later.');
      }
    });

    // Enable notifications
    this.bot.command('enable', async (ctx) => {
      const telegramId = ctx.from.id;
      
      try {
        await pool.query(
          'UPDATE teachers SET notifications_enabled = true WHERE telegram_id = $1',
          [telegramId.toString()]
        );
        ctx.reply('âœ… Notifications enabled! You will receive reminders 1 hour before your classes.');
      } catch (error) {
        ctx.reply('Error enabling notifications.');
      }
    });

    // Disable notifications
    this.bot.command('disable', async (ctx) => {
      const telegramId = ctx.from.id;
      
      try {
        await pool.query(
          'UPDATE teachers SET notifications_enabled = false WHERE telegram_id = $1',
          [telegramId.toString()]
        );
        ctx.reply('âŒ Notifications disabled.');
      } catch (error) {
        ctx.reply('Error disabling notifications.');
      }
    });

    this.bot.launch();
    console.log('âœ… Telegram bot started');
  }

  async sendNotification(telegramId, message) {
    try {
      await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
      return true;
    } catch (error) {
      console.error(`Failed to send notification to ${telegramId}:`, error.message);
      return false;
    }
  }

  async checkUpcomingLessons() {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Get current day and time
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    const targetTime = oneHourLater.toTimeString().slice(0, 5);

    try {
      // Find all classes starting in the next hour
      const result = await pool.query(`
        SELECT DISTINCT 
          s.teacher, 
          s.course, 
          s.room, 
          s.time, 
          s.day,
          s.group_name,
          t.telegram_id,
          t.notifications_enabled
        FROM schedules s
        LEFT JOIN teachers t ON LOWER(s.teacher) = LOWER(t.name)
        WHERE s.day = $1 
          AND s.time >= $2 
          AND s.time <= $3
          AND t.telegram_id IS NOT NULL
          AND t.notifications_enabled = true
      `, [currentDay, currentTime, targetTime]);

      console.log(`Found ${result.rows.length} upcoming lessons to notify`);

      for (const lesson of result.rows) {
        const message = 
          `â° <b>Reminder: Class in 1 hour!</b>\n\n` +
          `ðŸ“š Course: ${lesson.course}\n` +
          `ðŸ‘¥ Group: ${lesson.group_name}\n` +
          `ðŸ« Room: ${lesson.room || 'TBA'}\n` +
          `â° Time: ${lesson.time}\n` +
          `ðŸ“… Day: ${lesson.day}\n\n` +
          `Good luck with your class! ðŸŽ“`;

        await this.sendNotification(lesson.telegram_id, message);
      }
    } catch (error) {
      console.error('Error checking upcoming lessons:', error);
    }
  }

  stop() {
    this.bot.stop();
  }
}

module.exports = TelegramNotifier;