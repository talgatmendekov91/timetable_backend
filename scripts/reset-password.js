// scripts/reset-password.js
// Run: node scripts/reset-password.js
// Set RESET_PASSWORD env variable in Railway before running.
// Never hardcode passwords in this file.

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcrypt');

const USERNAME     = process.env.RESET_USERNAME || 'admin';
const NEW_PASSWORD = process.env.RESET_PASSWORD;

if (!NEW_PASSWORD) {
  console.error('❌ Set RESET_PASSWORD environment variable in Railway first.');
  console.error('   Railway → backend service → Variables → add RESET_PASSWORD=yourNewPassword');
  process.exit(1);
}

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: process.env.DB_HOST, port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD }
);

(async () => {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash(NEW_PASSWORD, 10);
    const { rowCount } = await client.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2',
      [hash, USERNAME]
    );
    if (rowCount === 0) {
      console.error(`❌ User "${USERNAME}" not found.`);
    } else {
      console.log(`✅ Password updated for "${USERNAME}"`);
      console.log(`   Remove RESET_PASSWORD from Railway variables now.`);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
})();