// scripts/initDatabase.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Connect to default database first
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const DB_NAME = process.env.DB_NAME || 'university_schedule';

async function initDatabase() {
  let client;
  
  try {
    client = await pool.connect();
    
    console.log('🔧 Initializing database...\n');

    // Check if database exists
    const dbCheck = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    );

    if (dbCheck.rows.length === 0) {
      console.log(`📦 Creating database "${DB_NAME}"...`);
      await client.query(`CREATE DATABASE ${DB_NAME}`);
      console.log('✅ Database created successfully\n');
    } else {
      console.log(`✅ Database "${DB_NAME}" already exists\n`);
    }

    client.release();

    // Connect to the new database
    const appPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: DB_NAME,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

    const appClient = await appPool.connect();

    // Create tables
    console.log('📋 Creating tables...\n');

    // Users table
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'teacher', 'viewer')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Groups table
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Groups table created');

    // Schedules table
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        group_name VARCHAR(50) NOT NULL,
        day VARCHAR(20) NOT NULL CHECK (day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
        time VARCHAR(10) NOT NULL,
        course VARCHAR(100) NOT NULL,
        teacher VARCHAR(100),
        room VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_name, day, time),
        FOREIGN KEY (group_name) REFERENCES groups(name) ON DELETE CASCADE
      )
    `);
    console.log('✅ Schedules table created');

    // Create indexes
    console.log('\n📊 Creating indexes...\n');
    
    await appClient.query(`
      CREATE INDEX IF NOT EXISTS idx_schedules_day ON schedules(day)
    `);
    console.log('✅ Index on schedules.day created');

    await appClient.query(`
      CREATE INDEX IF NOT EXISTS idx_schedules_teacher ON schedules(teacher)
    `);
    console.log('✅ Index on schedules.teacher created');

    await appClient.query(`
      CREATE INDEX IF NOT EXISTS idx_schedules_group ON schedules(group_name)
    `);
    console.log('✅ Index on schedules.group_name created');

    appClient.release();
    await appPool.end();

    console.log('\n✅ Database initialization complete!\n');
    console.log('📌 Next steps:');
    console.log('   1. Run: npm run seed (to add initial data)');
    console.log('   2. Run: npm start (to start the server)\n');

  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run initialization
initDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
