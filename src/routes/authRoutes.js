// src/routes/authRoutes.js

const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'teacher', 'viewer'])
    .withMessage('Invalid role')
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
];

// Routes
router.post('/login', loginValidation, validate, AuthController.login);
router.post('/register', authenticateToken, registerValidation, validate, AuthController.register);
router.get('/verify', authenticateToken, AuthController.verify);
router.post('/logout', authenticateToken, AuthController.logout);
router.post('/change-password', authenticateToken, changePasswordValidation, validate, AuthController.changePassword);

module.exports = router;
