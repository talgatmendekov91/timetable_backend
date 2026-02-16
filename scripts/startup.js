// scripts/startup.js
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config();

const getConfig = () => {
  if (process.env.DATABASE_URL) {
    console.log('ðŸ“¡ Using DATABASE_URL');
    return { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
  }
  console.log('ðŸ“¡ Using individual DB variables');
  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false
  };
};

const GROUPS = [
  'COMSE-25','COMCEH-25','COMFCI-25','COMCEH-24','COMSE-24','COMFCI-24',
  'COMSEH-23','COMSE-23/1-Group','COMSE-23/2-Group','COMFCI-23',
  'COM-22/1-Group','COM-22/2-Group','MATDAIS-25','MATMIE-25',
  'MATDAIS-24','MATMIE-24','MATDAIS-23','MATMIE-23','MATH-22',
  'EEAIR-25','IEMIT-25','EEAIR-24','IEMIT-24','EEAIR-23','IEMIT-23'
];

async function setup() {
  const pool = new Pool(getConfig());
  let client;

  try {
    client = await pool.connect();
    console.log('âœ… Database connected!');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_name, day, time),
        FOREIGN KEY (group_name) REFERENCES groups(name) ON DELETE CASCADE
      )`);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_day ON schedules(day)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teacher ON schedules(teacher)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_group ON schedules(group_name)`);
    console.log('âœ… Tables and indexes ready!');

    // Migrate existing DB: add subject_type if missing
    await client.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS subject_type VARCHAR(20) DEFAULT 'lecture'`);
    console.log('âœ… subject_type migration done');

    // Create admin user
    const userExists = await client.query(`SELECT id FROM users WHERE username = 'admin'`);
    if (userExists.rows.length === 0) {
       const password = process.env.ADMIN_PASSWORD || 'admin123';  // ← ADD THIS
       const hash = await bcrypt.hash(password, 10);  
      await client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ('admin', $1, 'admin')`,
        [hash]
      );
      console.log('âœ… Admin user created - login: admin / admin123');
    } else {
      console.log('âœ… Admin user already exists');
    }

    // Seed groups
    for (const name of GROUPS) {
      await client.query(
        `INSERT INTO groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name]
      );
    }
    console.log(`âœ… ${GROUPS.length} groups ready!`);

  } catch (err) {
    console.error('âŒ Setup failed:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }

  console.log('\nðŸš€ Starting Express server...\n');
  require(path.join(__dirname, '../src/server'));
}

setup();