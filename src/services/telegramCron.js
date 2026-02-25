const cron = require('node-cron');
const TelegramNotifier = require('./telegramNotifier');

let notifier = null;

const startTelegramNotifications = () => {
  console.log('🤖 Starting Telegram service...');
  
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN not set. Telegram notifications disabled.');
    console.log('📝 Please add TELEGRAM_BOT_TOKEN to your .env file');
    return;
  }

  try {
    // This creates the bot AND starts it (via constructor -> setupBot -> bot.launch())
    console.log('🔄 Creating TelegramNotifier instance...');
    notifier = new TelegramNotifier();
    
    // Give the bot a moment to fully initialize
    setTimeout(() => {
      console.log('✅ Telegram bot is now active and listening for commands');
    }, 2000);

    // Run every 10 minutes to check for upcoming lessons
    console.log('⏰ Setting up cron job for notifications...');
    const cronJob = cron.schedule('*/10 * * * *', () => {
      console.log('🔔 Running scheduled check for upcoming lessons...');
      if (notifier) {
        notifier.checkUpcomingLessons();
      } else {
        console.log('⚠️ Notifier not initialized, skipping check');
      }
    });

    console.log('✅ Telegram notification cron job started (every 10 minutes)');
    
    // Return the notifier instance in case it's needed elsewhere
    return notifier;

  } catch (error) {
    console.error('❌ Failed to start Telegram service:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
  }
};

const stopTelegramNotifications = () => {
  if (notifier) {
    console.log('🛑 Stopping Telegram notifications...');
    notifier.stop();
    console.log('✅ Telegram notifications stopped');
  } else {
    console.log('⚠️ No active notifier to stop');
  }
};

module.exports = { startTelegramNotifications, stopTelegramNotifications };