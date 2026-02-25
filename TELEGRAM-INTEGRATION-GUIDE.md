# Telegram Notification System - Complete Integration Guide

## Overview
Teachers will receive automatic Telegram notifications 1 hour before their scheduled classes.

---

## PART 1: Create Telegram Bot

1. **Open Telegram** and search for `@BotFather`
2. Send `/newbot` command
3. Choose a name: `University Schedule Bot`
4. Choose a username: `YourUniversityScheduleBot` (must end with 'bot')
5. **BotFather will give you a TOKEN** - copy it!
   - Example: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

---

## PART 2: Backend Setup (Railway)

### Step 1: Install Dependencies

Add to `package.json`:
```json
"dependencies": {
  "telegraf": "^4.12.2",
  "node-cron": "^3.0.2"
}
```

### Step 2: Add Environment Variable

Railway → Backend → Variables:
```
TELEGRAM_BOT_TOKEN = 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```
(Use YOUR token from BotFather)

### Step 3: Add Files

1. Create `src/services/telegramNotifier.js` - copy from zip
2. Create `src/services/telegramCron.js` - copy from zip
3. Create `src/routes/teacherRoutes.js` - copy from zip

### Step 4: Update startup.js

Add teacher table creation:
```javascript
// Add after booking_requests table
await client.query(`
  CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    telegram_id VARCHAR(50),
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_teacher_telegram ON teachers(telegram_id);
  CREATE INDEX IF NOT EXISTS idx_teacher_name ON teachers(LOWER(name));
`);
console.log('✅ Teachers table ready!');
```

### Step 5: Update server.js

Add at top:
```javascript
const teacherRoutes = require('./routes/teacherRoutes');
const { startTelegramNotifications } = require('./services/telegramCron');
```

Add route:
```javascript
app.use('/api/teachers', teacherRoutes);
```

Start notifications at bottom (after app.listen):
```javascript
// Start Telegram notifications
startTelegramNotifications();
```

### Step 6: Deploy

Push to GitHub → Railway auto-deploys

Check logs for:
```
✅ Telegram bot started
✅ Telegram notification cron job started (every 10 minutes)
```

---

## PART 3: Frontend Setup (Vercel)

### Step 1: Add Files

1. `TeacherTelegramManagement.js` → `src/components/`
2. `TeacherTelegramManagement.css` → `src/components/`

### Step 2: Add to App.js

Import:
```javascript
import TeacherTelegramManagement from './components/TeacherTelegramManagement';
```

Add tab:
```javascript
const tabs = [
  // ... existing tabs
  { id: 'telegram', icon: '📱', label: t('tabTelegram') || 'Telegram' },
];
```

Add to tab content:
```javascript
{activeTab === 'telegram' && <TeacherTelegramManagement />}
```

### Step 3: Add Translations

In `src/data/i18n.js`:

```javascript
// English
tabTelegram: 'Telegram',
telegramNotifications: 'Telegram Notifications',
howToSetup: 'How to Setup',
step1: 'Create a Telegram bot using @BotFather',
step2: 'Set TELEGRAM_BOT_TOKEN in Railway',
step3: 'Teachers start the bot and send /start',
step4: 'Copy their Telegram ID and enter it here',
step5: 'Teachers receive notifications 1 hour before classes',
telegramId: 'Telegram ID',
notSet: 'Not set',
telegramIdSaved: 'Telegram ID saved!',
botCommands: 'Bot Commands for Teachers',
cmdStart: 'Get your Telegram ID',
cmdStatus: 'Check registration status',
cmdEnable: 'Enable notifications',
cmdDisable: 'Disable notifications',

// Russian
tabTelegram: 'Telegram',
telegramNotifications: 'Telegram уведомления',
howToSetup: 'Как настроить',
step1: 'Создайте бота через @BotFather',
step2: 'Добавьте TELEGRAM_BOT_TOKEN в Railway',
step3: 'Преподаватели запускают бота командой /start',
step4: 'Скопируйте их Telegram ID и введите здесь',
step5: 'Преподаватели получат уведомления за 1 час',
telegramId: 'Telegram ID',
notSet: 'Не задан',
telegramIdSaved: 'Telegram ID сохранен!',
botCommands: 'Команды бота',
cmdStart: 'Получить Telegram ID',
cmdStatus: 'Проверить статус',
cmdEnable: 'Включить уведомления',
cmdDisable: 'Отключить уведомления',

// Kyrgyz
tabTelegram: 'Telegram',
telegramNotifications: 'Telegram билдирүүлөр',
howToSetup: 'Кантип тууралоо',
step1: '@BotFather аркылуу бот түзүңүз',
step2: 'Railway\'ге TELEGRAM_BOT_TOKEN кошуңуз',
step3: 'Мугалимдер ботту /start буйругу менен иштетсин',
step4: 'Алардын Telegram ID\'син көчүрүп мында киргизиңиз',
step5: 'Мугалимдер 1 саат мурун билдирүү аласыз',
telegramId: 'Telegram ID',
notSet: 'Коюлган эмес',
telegramIdSaved: 'Telegram ID сакталды!',
botCommands: 'Бот буйруктары',
cmdStart: 'Telegram ID алуу',
cmdStatus: 'Статусту текшерүү',
cmdEnable: 'Билдирүүлөрдү күйгүзүү',
cmdDisable: 'Билдирүүлөрдү өчүрүү',
```

### Step 4: Deploy

Push to GitHub → Vercel auto-deploys

---

## PART 4: Teacher Onboarding

### For Each Teacher:

1. **Admin gives teacher the bot username**
   - Example: `@YourUniversityScheduleBot`

2. **Teacher opens Telegram** and searches for bot

3. **Teacher clicks START** or sends `/start`
   - Bot replies with their Telegram ID (e.g., `123456789`)

4. **Teacher copies their Telegram ID**

5. **Admin logs into website** → **Telegram tab**

6. **Admin finds teacher in list** → clicks **Edit**

7. **Admin pastes Telegram ID** → clicks **Save**

8. **Done!** Teacher is now registered

### Teacher Commands:
- `/status` - Check if registered
- `/enable` - Turn on notifications
- `/disable` - Turn off notifications

---

## PART 5: How It Works

1. **Cron job runs every 10 minutes** (checks for upcoming classes)

2. **Finds all classes starting in next hour:**
   - Current time: 13:45
   - Checks for classes at: 14:00, 14:45

3. **Looks up teachers with Telegram IDs enabled**

4. **Sends notification:**
   ```
   ⏰ Reminder: Class in 1 hour!
   
   📚 Course: Mathematics
   👥 Group: COMSE-25
   🏫 Room: B107
   ⏰ Time: 14:45
   📅 Day: Monday
   
   Good luck with your class! 🎓
   ```

---

## Troubleshooting

### Bot not starting?
- Check Railway logs for "✅ Telegram bot started"
- Verify `TELEGRAM_BOT_TOKEN` is set correctly
- Make sure `telegraf` and `node-cron` are in package.json

### Teacher not receiving notifications?
- Check teacher has telegram_id saved in database
- Check notifications_enabled = true
- Ask teacher to send `/status` to bot
- Check Railway logs for "Found X upcoming lessons"

### Wrong timing?
- Server timezone might be different
- Check Railway logs to see what time it detects

---

## Testing

1. **Create a test class** 1 hour from now
2. **Assign it to a teacher** with Telegram ID
3. **Wait for cron job** (runs every 10 minutes)
4. **Teacher should receive notification**

Or manually trigger:
```javascript
// In Railway console or logs
notifier.checkUpcomingLessons();
```

---

## Summary

✅ Teachers get notified 1 hour before class
✅ Teachers can enable/disable notifications
✅ Admin manages Telegram IDs in UI
✅ Automatic - runs every 10 minutes
✅ Works for all days and times
✅ Multilingual support (EN/RU/KY)

**Start by creating the bot, then follow the guide step by step!** 🚀
