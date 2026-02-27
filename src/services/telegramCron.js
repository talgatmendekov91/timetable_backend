// Backend: src/services/telegramCron.js
// No cron job anymore — just starts the bot for commands and schedule-change notifications.

const TelegramNotifier = require('./telegramNotifier');

let notifier = null;

const startTelegramNotifications = () => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN not set. Telegram bot disabled.');
    return;
  }
  notifier = new TelegramNotifier();
  console.log('✅ Telegram bot ready.');
};

const stopTelegramNotifications = () => {
  if (notifier) {
    notifier.stop();
    notifier = null;
    console.log('Telegram bot stopped.');
  }
};

const getNotifier = () => notifier;

module.exports = { startTelegramNotifications, stopTelegramNotifications, getNotifier };