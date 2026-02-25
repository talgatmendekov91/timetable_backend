const { Telegraf } = require('telegraf');
const pool = require('../config/database');

class TelegramNotifier {
  constructor() {
    console.log('🔧 Initializing TelegramNotifier...');
    
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('❌ CRITICAL: TELEGRAM_BOT_TOKEN is missing!');
      console.error('Please set TELEGRAM_BOT_TOKEN in your .env file');
      return;
    }
    
    console.log('📋 Bot token found, creating Telegraf instance...');
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    console.log('✅ Telegraf instance created');
    
    this.setupBot();
  }

  setupBot() {
    console.log('🔄 Setting up bot commands...');

    // Error handler
    this.bot.catch((err, ctx) => {
      console.error('❌ Bot error:', err);
      if (ctx) {
        ctx.reply('Sorry, an error occurred. Please try again later.');
      }
    });

    // Start command
    this.bot.command('start', async (ctx) => {
      console.log('📱 /start command received from user:', {
        id: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name
      });
      
      const telegramId = ctx.from.id;
      const username = ctx.from.username || ctx.from.first_name;
      
      await ctx.reply(
        `🎓 <b>Welcome to University Schedule Bot!</b>\n\n` +
        `Your Telegram ID: <code>${telegramId}</code>\n` +
        `Username: @${username}\n\n` +
        `Available commands:\n` +
        `/status - Check your registration status\n` +
        `/enable - Turn on class notifications\n` +
        `/disable - Turn off class notifications\n\n` +
        `Please ask your admin to link this ID to your teacher account.`,
        { parse_mode: 'HTML' }
      );
    });

    // Status command
    this.bot.command('status', async (ctx) => {
      const telegramId = ctx.from.id;
      console.log(`📊 /status command from user ${telegramId}`);
      
      try {
        const result = await pool.query(
          'SELECT * FROM teachers WHERE telegram_id = $1',
          [telegramId.toString()]
        );

        if (result.rows.length > 0) {
          const teacher = result.rows[0];
          await ctx.reply(
            `✅ <b>Registration Status: Active</b>\n\n` +
            `👤 Teacher: ${teacher.name}\n` +
            `🔔 Notifications: ${teacher.notifications_enabled ? 'ON' : 'OFF'}\n\n` +
            `Use /enable to turn on notifications\n` +
            `Use /disable to turn off notifications`,
            { parse_mode: 'HTML' }
          );
        } else {
          await ctx.reply(
            `❌ <b>Not Registered</b>\n\n` +
            `Your Telegram ID: <code>${telegramId}</code>\n\n` +
            `Please contact your admin to link this ID to your teacher account.`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (error) {
        console.error('Error checking status:', error);
        await ctx.reply('Error checking status. Please try again later.');
      }
    });

    // Enable notifications
    this.bot.command('enable', async (ctx) => {
      const telegramId = ctx.from.id;
      console.log(`🔔 /enable command from user ${telegramId}`);
      
      try {
        const result = await pool.query(
          'UPDATE teachers SET notifications_enabled = true WHERE telegram_id = $1 RETURNING name',
          [telegramId.toString()]
        );

        if (result.rows.length > 0) {
          await ctx.reply(
            '✅ <b>Notifications Enabled!</b>\n\n' +
            'You will receive reminders 1 hour before your classes.',
            { parse_mode: 'HTML' }
          );
        } else {
          await ctx.reply(
            '❌ You are not registered yet.\n' +
            'Use /start to see how to register.'
          );
        }
      } catch (error) {
        console.error('Error enabling notifications:', error);
        await ctx.reply('Error enabling notifications. Please try again later.');
      }
    });

    // Disable notifications
    this.bot.command('disable', async (ctx) => {
      const telegramId = ctx.from.id;
      console.log(`🔕 /disable command from user ${telegramId}`);
      
      try {
        const result = await pool.query(
          'UPDATE teachers SET notifications_enabled = false WHERE telegram_id = $1 RETURNING name',
          [telegramId.toString()]
        );

        if (result.rows.length > 0) {
          await ctx.reply(
            '❌ <b>Notifications Disabled</b>\n\n' +
            'You will no longer receive class reminders.',
            { parse_mode: 'HTML' }
          );
        } else {
          await ctx.reply(
            '❌ You are not registered yet.\n' +
            'Use /start to see how to register.'
          );
        }
      } catch (error) {
        console.error('Error disabling notifications:', error);
        await ctx.reply('Error disabling notifications. Please try again later.');
      }
    });

    // Help command
    this.bot.help(async (ctx) => {
      await ctx.reply(
        '📚 <b>Available Commands:</b>\n\n' +
        '/start - Welcome message and setup\n' +
        '/status - Check your registration\n' +
        '/enable - Turn on notifications\n' +
        '/disable - Turn off notifications\n' +
        '/help - Show this help message',
        { parse_mode: 'HTML' }
      );
    });

    // Launch the bot
    console.log('🚀 Launching bot...');
    this.bot.launch()
      .then(() => {
        console.log('✅ Bot successfully launched!');
        if (this.bot.botInfo) {
          console.log('🤖 Bot username:', this.bot.botInfo.username);
          console.log('🤖 Bot ID:', this.bot.botInfo.id);
        }
      })
      .catch((err) => {
        console.error('❌ Failed to launch bot:', err);
      });

    // Enable graceful stop
    process.once('SIGINT', () => this.stop('SIGINT'));
    process.once('SIGTERM', () => this.stop('SIGTERM'));
  }

  async sendNotification(telegramId, message) {
    try {
      await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
      console.log(`✅ Notification sent to ${telegramId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send notification to ${telegramId}:`, error.message);
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

    console.log(`🔍 Checking lessons for ${currentDay} between ${currentTime} and ${targetTime}`);

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

      console.log(`📊 Found ${result.rows.length} upcoming lessons to notify`);

      for (const lesson of result.rows) {
        const message = 
          `⏰ <b>Reminder: Class in 1 hour!</b>\n\n` +
          `📚 Course: ${lesson.course}\n` +
          `👥 Group: ${lesson.group_name}\n` +
          `🏫 Room: ${lesson.room || 'TBA'}\n` +
          `⏰ Time: ${lesson.time}\n` +
          `📅 Day: ${lesson.day}\n\n` +
          `Good luck with your class! 🎓`;

        await this.sendNotification(lesson.telegram_id, message);
      }
    } catch (error) {
      console.error('❌ Error checking upcoming lessons:', error);
    }
  }

  stop(signal) {
    console.log(`🛑 Stopping bot (${signal})...`);
    if (this.bot) {
      this.bot.stop(signal);
      console.log('✅ Bot stopped');
    }
  }
}

module.exports = TelegramNotifier;