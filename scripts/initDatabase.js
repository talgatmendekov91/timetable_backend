// scripts/initDatabase.js
// This script initializes the PostgreSQL database by creating the necessary tables and indexes.

const { Pool } = require('pg');
require('dotenv').config();

const getPoolConfig = () => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'university_schedule',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
};

const pool = new Pool(getPoolConfig());

async function initDatabase() {
  let client;
  try {
    client = await pool.connect();
    console.log('ðŸ”§ Initializing database...\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'teacher', 'viewer')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('âœ… Users table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('âœ… Groups table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        group_name VARCHAR(50) NOT NULL,
        day VARCHAR(20) NOT NULL CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
        time VARCHAR(10) NOT NULL,
        course VARCHAR(100) NOT NULL,
        teacher VARCHAR(100),
        room VARCHAR(50),
        subject_type VARCHAR(20) DEFAULT 'lecture',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_name, day, time),
        FOREIGN KEY (group_name) REFERENCES groups(name) ON DELETE CASCADE
      )
    `);
    console.log('âœ… Schedules table ready');

    // Add subject_type column if upgrading an existing database that doesn't have it
    await client.query(`
      ALTER TABLE schedules
        ADD COLUMN IF NOT EXISTS subject_type VARCHAR(20) DEFAULT 'lecture'
    `);
    console.log('âœ… subject_type column ready');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_schedules_day     ON schedules(day)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_schedules_teacher ON schedules(teacher)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_schedules_group   ON schedules(group_name)`);
    console.log('âœ… Indexes ready');

    console.log('\nâœ… Database initialization complete!\n');
  } catch (error) {
    console.error('âŒ Error initializing database:', error.message);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

initDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));