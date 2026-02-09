// src/routes/scheduleRoutes.js

const express = require('express');
const { body, param } = require('express-validator');
const ScheduleController = require('../controllers/scheduleController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const scheduleValidation = [
  body('group').trim().notEmpty().withMessage('Group is required'),
  body('day')
    .trim()
    .notEmpty()
    .withMessage('Day is required')
    .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    .withMessage('Invalid day'),
  body('time').trim().notEmpty().withMessage('Time is required'),
  body('course').trim().notEmpty().withMessage('Course is required'),
  body('teacher').optional().trim(),
  body('room').optional().trim()
];

// Public routes (anyone can view)
router.get('/', ScheduleController.getAll);
router.get('/day/:day', ScheduleController.getByDay);
router.get('/teacher/:teacher', ScheduleController.getByTeacher);
router.get('/group/:group', ScheduleController.getByGroup);
router.get('/teachers', ScheduleController.getAllTeachers);

// Protected routes (admin only)
router.post('/', authenticateToken, requireAdmin, scheduleValidation, validate, ScheduleController.createOrUpdate);
router.delete('/:group/:day/:time', authenticateToken, requireAdmin, ScheduleController.delete);

module.exports = router;
