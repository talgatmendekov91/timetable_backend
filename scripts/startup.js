// scripts/startup.js - WITH FULL ERROR LOGGING
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

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

    await client.query(`CREATE INDEX IF NOT EXISTS idx_day ON schedules(day)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teacher ON schedules(teacher)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_group ON schedules(group_name)`);
    console.log('✅ Tables and indexes ready!');

    // Migrations
    await client.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS subject_type VARCHAR(20) DEFAULT 'lecture'`);
    await client.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 1`);
    console.log('✅ Migrations done');

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

    // Create booking_requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_requests (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        phone VARCHAR(50),
        room VARCHAR(50) NOT NULL,
        day VARCHAR(20) NOT NULL,
        start_time VARCHAR(10) NOT NULL,
        duration INTEGER DEFAULT 1,
        purpose TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_status ON booking_requests(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_created ON booking_requests(created_at DESC)`);
    console.log('✅ Booking requests table ready!');

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
    require('../src/server');

  } catch (error) {
    console.error('❌ Setup failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Full error:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (client) client.release();
  }
};

setupDatabase();