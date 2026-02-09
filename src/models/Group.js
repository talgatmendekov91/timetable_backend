// src/models/Group.js

const pool = require('../config/database');

class Group {
  static async getAll() {
    const result = await pool.query(
      'SELECT name FROM groups ORDER BY name'
    );
    return result.rows.map(row => row.name);
  }

  static async findByName(name) {
    const result = await pool.query(
      'SELECT * FROM groups WHERE name = $1',
      [name]
    );
    return result.rows[0];
  }

  static async create(name) {
    const result = await pool.query(
      'INSERT INTO groups (name) VALUES ($1) RETURNING *',
      [name]
    );
    return result.rows[0];
  }

  static async delete(name) {
    const result = await pool.query(
      'DELETE FROM groups WHERE name = $1 RETURNING *',
      [name]
    );
    return result.rows[0];
  }

  static async exists(name) {
    const result = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM groups WHERE name = $1)',
      [name]
    );
    return result.rows[0].exists;
  }
}

module.exports = Group;
