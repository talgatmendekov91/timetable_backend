// src/routes/groupRoutes.js

const express = require('express');
const { body } = require('express-validator');
const GroupController = require('../controllers/groupController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const groupValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ max: 50 })
    .withMessage('Group name must be less than 50 characters')
];

// Public routes
router.get('/', GroupController.getAll);

// Protected routes (admin only)
router.post('/', authenticateToken, requireAdmin, groupValidation, validate, GroupController.create);
router.delete('/:name', authenticateToken, requireAdmin, GroupController.delete);

module.exports = router;
