// src/controllers/authController.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthController {
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      // Find user
      const user = await User.findByUsername(username);
      if (!user) {
        return res.status(401).json({ 
          success: false,
          error: 'Invalid credentials' 
        });
      }

      // Verify password
      const validPassword = await User.verifyPassword(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ 
          success: false,
          error: 'Invalid credentials' 
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Server error during login' 
      });
    }
  }

  static async verify(req, res) {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Server error during verification' 
      });
    }
  }

  static async logout(req, res) {
    // With JWT, logout is handled client-side by removing the token
    res.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
  }

  static async register(req, res) {
    try {
      const { username, password, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({ 
          success: false,
          error: 'Username already exists' 
        });
      }

      // Create new user
      const newUser = await User.create(username, password, role);

      res.status(201).json({
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          role: newUser.role
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Server error during registration' 
      });
    }
  }

  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Get user
      const user = await User.findByUsername(req.user.username);
      
      // Verify current password
      const validPassword = await User.verifyPassword(currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ 
          success: false,
          error: 'Current password is incorrect' 
        });
      }

      // Update password
      await User.updatePassword(userId, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Server error during password change' 
      });
    }
  }
}

module.exports = AuthController;
