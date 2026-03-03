// src/routes/settingsRoutes.js
// Simple key-value settings table for app-wide config
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Ensure settings table exists
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Default: notifications enabled
  await pool.query(`
    INSERT INTO app_settings (key, value)
    VALUES ('notifications_enabled', 'true')
    ON CONFLICT (key) DO NOTHING
  `);
};
ensureTable().catch(console.error);

// GET /api/settings/:key  (public — frontend needs to check without login)
router.get('/:key', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT value FROM app_settings WHERE key = $1', [req.params.key]
    );
    res.json({ success: true, value: rows[0]?.value ?? null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings/:key  (admin only)
router.put('/:key', authenticateToken, async (req, res) => {
  try {
    const { value } = req.body;
    await pool.query(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [req.params.key, String(value)]);
    res.json({ success: true, value: String(value) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;