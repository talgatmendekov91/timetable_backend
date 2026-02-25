// Backend: src/services/telegramCron.js
const cron = require('node-cron');
const TelegramNotifier = require('./telegramNotifier');

let notifier = null;

const startTelegramNotifications = () => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN not set. Telegram notifications disabled.');
    return;
  }

  notifier = new TelegramNotifier();

  // Run every 10 minutes to check for upcoming lessons
  cron.schedule('*/10 * * * *', () => {
    console.log('🔔 Checking for upcoming lessons...');
    notifier.checkUpcomingLessons();
  });

  console.log('✅ Telegram notification cron job started (every 10 minutes)');
};

const stopTelegramNotifications = () => {
  if (notifier) {
    notifier.stop();
    console.log('❌ Telegram notifications stopped');
  }
};

module.exports = { startTelegramNotifications, stopTelegramNotifications };
