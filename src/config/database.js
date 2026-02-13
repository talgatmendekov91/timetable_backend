// src/config/database.js

const { Pool } = require('pg');
require('dotenv').config();

const getPoolConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'university_schedule',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: false
  };
};

const pool = new Pool(getPoolConfig());

pool.on('connect', () => console.log('âœ… Database connected successfully'));
pool.on('error', (err) => console.error('âŒ Database error:', err.message));

module.exports = pool;
