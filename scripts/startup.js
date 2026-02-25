// scripts/startup.js - WITH PROPER TELEGRAM INITIALIZATION
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const getPoolConfig = () => {
  if (process.env.DATABASE_URL) {
    console.log('🔗 Using DATABASE_URL');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }
  console.log('🔡 Using individual DB variables');
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'university_schedule',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  };
};

const runMigrationFile = async (client, filename) => {
  try {
    console.log(`📦 Running migration: ${filename}`);
    const filePath = path.join(__dirname, filename);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Migration file not found: ${filename}, skipping...`);
      return;
    }

    const migrationSQL = fs.readFileSync(filePath, 'utf8');
    await client.query(migrationSQL);
    console.log(`✅ Migration completed: ${filename}`);
  } catch (error) {
    console.error(`❌ Migration failed for ${filename}:`, error.message);
    throw error;
  }
};

const setupDatabase = async () => {
  const pool = new Pool(getPoolConfig());
  let client;

  try {
    client = await pool.connect();
    console.log('✅ Database connected!');

    // Create groups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    // Create schedules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        group_name VARCHAR(50) NOT NULL,
        day VARCHAR(20) NOT NULL,
        time VARCHAR(10) NOT NULL,
        course VARCHAR(100) NOT NULL,
        teacher VARCHAR(100),
        room VARCHAR(50),
        subject_type VARCHAR(20) DEFAULT 'lecture',
        duration INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_name, day, time),
        FOREIGN KEY (group_name) REFERENCES groups(name) ON DELETE CASCADE
      )`);

    // Create indexes for schedules
    await client.query(`CREATE INDEX IF NOT EXISTS idx_day ON schedules(day)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teacher ON schedules(teacher)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_group ON schedules(group_name)`);

    // Add columns if they don't exist
    await client.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS subject_type VARCHAR(20) DEFAULT 'lecture'`);
    await client.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 1`);

    console.log('✅ Schedules table and indexes ready!');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    console.log('✅ Users table ready!');

    // Run booking migration
    await runMigrationFile(client, 'booking-migration.sql');

    // Create teachers table
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

    // В scripts/startup.js, после создания других таблиц, добавьте:

    // Create teachers table
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

    // Create admin user
    const adminCheck = await client.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
      await client.query(
        "INSERT INTO users (username, password_hash, role) VALUES ('admin', $1, 'admin')",
        [hashedPassword]
      );
      console.log('✅ Admin user created (admin/admin123)');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Seed groups
    const groups = [
      'COMSE-25', 'COMSE-24', 'COMSE-23/1-Group', 'COMSE-23/2-Group',
      'COMCEH-25', 'COMCEH-24', 'COMCEH-23',
      'COMFCI-25', 'COMFCI-24', 'COMFCI-23',
      'MATDAIS-25', 'MATDAIS-24', 'MATDAIS-23',
      'MATMIE-25', 'MATMIE-24', 'MATMIE-23',
      'EEAIR-25', 'EEAIR-24', 'EEAIR-23',
      'IEMIT-25', 'IEMIT-24', 'IEMIT-23',
      'COM-22/1-Group', 'COM-22/2-Group', 'MATH-22'
    ];

    for (const group of groups) {
      await client.query(
        'INSERT INTO groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [group]
      );
    }
    console.log(`✅ ${groups.length} groups ready!`);

    console.log('🚀 Starting Express server...');

    // IMPORTANT: Import the server but DON'T release the client yet
    // The server needs the pool to be available
    const app = require('../src/server');

    console.log('✅ Server started successfully!');
    console.log('🤖 Telegram bot should now be initializing...');

  } catch (error) {
    console.error('❌ Setup failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Full error:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
  // Don't release the client here - let the server manage the pool
};

// Run setup
setupDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});