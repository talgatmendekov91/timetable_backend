// scripts/seedData.js

const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'university_schedule',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const UNIVERSITY_GROUPS = [
  'COMSE-25', 'COMCEH-25', 'COMFCI-25', 'COMCEH-24',
  'COMSE-24', 'COMFCI-24', 'COMSEH-23', 'COMSE-23/1-Group',
  'COMSE-23/2-Group', 'COMFCI-23', 'COM-22/1-Group',
  'COM-22/2-Group', 'MATDAIS-25', 'MATMIE-25',
  'MATDAIS-24', 'MATMIE-24', 'MATDAIS-23', 'MATMIE-23',
  'MATH-22', 'EEAIR-25', 'IEMIT-25', 'EEAIR-24',
  'IEMIT-24', 'EEAIR-23', 'IEMIT-23'
];

async function seedDatabase() {
  let client;
  
  try {
    client = await pool.connect();
    
    console.log('🌱 Seeding database...\n');

    // Check if admin user exists
    const userCheck = await client.query(
      `SELECT * FROM users WHERE username = 'admin'`
    );

    if (userCheck.rows.length === 0) {
      console.log('👤 Creating default admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
        ['admin', hashedPassword, 'admin']
      );
      
      console.log('✅ Admin user created');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      console.log('   ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!\n');
    } else {
      console.log('✅ Admin user already exists\n');
    }

    // Insert groups
    console.log('📚 Inserting university groups...');
    
    for (const groupName of UNIVERSITY_GROUPS) {
      await client.query(
        `INSERT INTO groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [groupName]
      );
    }
    
    console.log(`✅ ${UNIVERSITY_GROUPS.length} groups inserted\n`);

    // Optional: Add some sample schedules
    console.log('📅 Adding sample schedules...');
    
    const sampleSchedules = [
      {
        group: 'COMSE-25',
        day: 'Monday',
        time: '08:00',
        course: 'Data Structures',
        teacher: 'Prof. Johnson',
        room: 'Room 401'
      },
      {
        group: 'COMSE-25',
        day: 'Monday',
        time: '09:30',
        course: 'Algorithms',
        teacher: 'Prof. Smith',
        room: 'Room 305'
      },
      {
        group: 'COMCEH-25',
        day: 'Tuesday',
        time: '08:00',
        course: 'Computer Networks',
        teacher: 'Prof. Williams',
        room: 'Lab 201'
      },
      {
        group: 'MATDAIS-25',
        day: 'Wednesday',
        time: '10:15',
        course: 'Linear Algebra',
        teacher: 'Prof. Davis',
        room: 'Room 102'
      },
      {
        group: 'EEAIR-25',
        day: 'Thursday',
        time: '14:00',
        course: 'Circuit Theory',
        teacher: 'Prof. Brown',
        room: 'Lab 303'
      }
    ];

    for (const schedule of sampleSchedules) {
      await client.query(
        `INSERT INTO schedules (group_name, day, time, course, teacher, room) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (group_name, day, time) DO NOTHING`,
        [schedule.group, schedule.day, schedule.time, schedule.course, schedule.teacher, schedule.room]
      );
    }
    
    console.log(`✅ ${sampleSchedules.length} sample schedules added\n`);

    console.log('✅ Database seeding complete!\n');
    console.log('📌 You can now start the server with: npm start\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run seeding
seedDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
