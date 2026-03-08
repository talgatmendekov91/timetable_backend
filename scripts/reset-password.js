// scripts/reset-password.js
// Run on Railway: node scripts/reset-password.js
// Or locally with DATABASE_URL set: DATABASE_URL=... node scripts/reset-password.js
//
// This script resets the admin password directly in the database.
// Change NEW_PASSWORD below before running.

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcrypt');

// ── CONFIGURE HERE ────────────────────────────────────────────────────────────
const USERNAME     = 'admin';          // the username to reset
const NEW_PASSWORD = 'Admin@2025';     // change this to your new password
// ─────────────────────────────────────────────────────────────────────────────

const getPoolConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  }
  return {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'university_schedule',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
  };
};

(async () => {
  const pool = new Pool(getPoolConfig());
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to database');

    // Check user exists
    const check = await client.query(
      'SELECT id, username, role FROM users WHERE username = $1',
      [USERNAME]
    );

    if (check.rows.length === 0) {
      console.log(`❌ User "${USERNAME}" not found.`);
      console.log('   Creating admin user...');
      const hash = await bcrypt.hash(NEW_PASSWORD, 10);
      await client.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
        [USERNAME, hash, 'admin']
      );
      console.log(`✅ Created user "${USERNAME}" with role "admin"`);
    } else {
      const user = check.rows[0];
      console.log(`Found user: id=${user.id}, username=${user.username}, role=${user.role}`);
      const hash = await bcrypt.hash(NEW_PASSWORD, 10);
      await client.query(
        'UPDATE users SET password_hash = $1 WHERE username = $2',
        [hash, USERNAME]
      );
      console.log(`✅ Password updated for "${USERNAME}"`);
    }

    // Verify the new hash works
    const verify = await client.query(
      'SELECT password_hash FROM users WHERE username = $1',
      [USERNAME]
    );
    const ok = await bcrypt.compare(NEW_PASSWORD, verify.rows[0].password_hash);
    console.log(`✅ Verification: bcrypt.compare = ${ok}`);
    console.log(`\nYou can now log in with:\n  Username: ${USERNAME}\n  Password: ${NEW_PASSWORD}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
})();