// scripts/setup-teachers.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'university_schedule',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123'
});

async function setupTeachers() {
  console.log('🔄 НАСТРОЙКА ТАБЛИЦЫ TEACHERS');
  console.log('==============================\n');
  
  try {
    // ШАГ 1: Создаем таблицу teachers
    console.log('📦 Шаг 1: Создание таблицы teachers...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        telegram_id VARCHAR(50),
        notifications_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица teachers создана\n');
    
    // ШАГ 2: Создаем индексы
    console.log('📊 Шаг 2: Создание индексов...');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_teacher_telegram ON teachers(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_name ON teachers(LOWER(name));
    `);
    console.log('✅ Индексы созданы\n');
    
    // ШАГ 3: Получаем учителей из расписания
    console.log('🔍 Шаг 3: Поиск учителей в расписании...');
    
    const schedulesResult = await pool.query(`
      SELECT DISTINCT teacher 
      FROM schedules 
      WHERE teacher IS NOT NULL 
        AND teacher != ''
      ORDER BY teacher
    `);
    
    const teachersFromSchedules = schedulesResult.rows;
    console.log(`✅ Найдено ${teachersFromSchedules.length} учителей в расписании\n`);
    
    if (teachersFromSchedules.length === 0) {
      console.log('⚠️ В расписании нет учителей! Добавляем примерных учителей...');
      
      const sampleTeachers = [
        'Prof. Smith',
        'Prof. Johnson',
        'Prof. Williams',
        'Prof. Brown',
        'Prof. Davis',
        'Prof. Miller',
        'Prof. Wilson'
      ];
      
      for (const teacher of sampleTeachers) {
        await pool.query(
          'INSERT INTO teachers (name, notifications_enabled) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
          [teacher, true]
        );
        console.log(`   ✅ Добавлен: ${teacher}`);
      }
    } else {
      // ШАГ 4: Импортируем учителей из расписания
      console.log('📝 Шаг 4: Импорт учителей из расписания...');
      
      for (const item of teachersFromSchedules) {
        const teacherName = item.teacher;
        
        try {
          await pool.query(
            'INSERT INTO teachers (name, notifications_enabled) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
            [teacherName, true]
          );
          console.log(`   ✅ Добавлен: ${teacherName}`);
        } catch (error) {
          console.log(`   ❌ Ошибка при добавлении ${teacherName}: ${error.message}`);
        }
      }
    }
    
    // ШАГ 5: Показываем результат
    console.log('\n📋 Шаг 5: ФИНАЛЬНЫЙ СПИСОК УЧИТЕЛЕЙ');
    console.log('====================================');
    
    const allTeachers = await pool.query(`
      SELECT * FROM teachers ORDER BY name
    `);
    
    allTeachers.rows.forEach((teacher, index) => {
      const telegramStatus = teacher.telegram_id 
        ? `✅ ID: ${teacher.telegram_id}` 
        : '❌ не привязан';
      const notificationsStatus = teacher.notifications_enabled ? 'вкл' : 'выкл';
      
      console.log(`${index + 1}. ${teacher.name}`);
      console.log(`   ID: ${teacher.id}, Telegram: ${telegramStatus}, Уведомления: ${notificationsStatus}`);
    });
    
    console.log(`\n✅ Готово! В таблице teachers теперь ${allTeachers.rows.length} учителей`);
    
  } catch (error) {
    console.error('❌ ОШИБКА:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Соединение с БД закрыто');
  }
}

// Запускаем функцию
setupTeachers();