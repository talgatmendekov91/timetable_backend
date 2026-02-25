// import-teachers-from-schedules.js
require('dotenv').config();
const { Pool } = require('pg');

// Настройка подключения к базе данных
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'university_schedule',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123'
});

async function importTeachersFromSchedules() {
  console.log('🔄 Начинаем импорт учителей из расписания...');
  console.log('==========================================\n');
  
  try {
    // Шаг 1: Получаем уникальных учителей из таблицы schedules
    console.log('📊 Поиск учителей в расписании...');
    
    const result = await pool.query(`
      SELECT DISTINCT teacher 
      FROM schedules 
      WHERE teacher IS NOT NULL 
        AND teacher != ''
      ORDER BY teacher
    `);
    
    const teachersFromSchedules = result.rows;
    console.log(`✅ Найдено ${teachersFromSchedules.length} учителей в расписании\n`);
    
    if (teachersFromSchedules.length === 0) {
      console.log('❌ В расписании нет учителей! Сначала добавьте расписание.');
      return;
    }
    
    // Показываем найденных учителей
    console.log('📋 Список учителей из расписания:');
    teachersFromSchedules.forEach((t, index) => {
      console.log(`   ${index + 1}. ${t.teacher}`);
    });
    console.log('');
    
    // Шаг 2: Проверяем, какие учителя уже есть в таблице teachers
    console.log('🔍 Проверка существующих записей в таблице teachers...');
    
    const existingTeachers = await pool.query(`
      SELECT name FROM teachers
    `);
    
    const existingNames = existingTeachers.rows.map(t => t.name);
    console.log(`✅ Найдено ${existingNames.length} учителей в таблице teachers\n`);
    
    // Шаг 3: Добавляем только новых учителей
    console.log('📝 Добавление новых учителей...');
    
    let added = 0;
    let skipped = 0;
    
    for (const item of teachersFromSchedules) {
      const teacherName = item.teacher;
      
      // Проверяем, есть ли уже такой учитель
      if (existingNames.includes(teacherName)) {
        console.log(`⏭️  Пропущен (уже есть): ${teacherName}`);
        skipped++;
      } else {
        try {
          // Добавляем нового учителя
          await pool.query(
            'INSERT INTO teachers (name, notifications_enabled) VALUES ($1, $2)',
            [teacherName, true]
          );
          console.log(`✅ Добавлен: ${teacherName}`);
          added++;
        } catch (error) {
          console.log(`❌ Ошибка при добавлении ${teacherName}: ${error.message}`);
        }
      }
    }
    
    console.log('\n📊 ИТОГИ:');
    console.log(`   - Найдено в расписании: ${teachersFromSchedules.length}`);
    console.log(`   - Уже было в teachers: ${existingNames.length}`);
    console.log(`   - Добавлено новых: ${added}`);
    console.log(`   - Пропущено (дубликаты): ${skipped}`);
    
    // Шаг 4: Показываем финальный список всех учителей
    console.log('\n📋 ФИНАЛЬНЫЙ СПИСОК УЧИТЕЛЕЙ:');
    console.log('================================');
    
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
    
  } catch (error) {
    console.error('❌ ОШИБКА:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
    console.log('\n🔌 Соединение с БД закрыто');
  }
}

// Запускаем функцию
importTeachersFromSchedules();