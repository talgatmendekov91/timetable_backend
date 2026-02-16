const express = require('express');
const ScheduleController = require('../controllers/scheduleController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const VALID_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

router.get('/', ScheduleController.getAll);
router.get('/day/:day', ScheduleController.getByDay);
router.get('/teacher/:teacher', ScheduleController.getByTeacher);
router.get('/group/:group', ScheduleController.getByGroup);
router.get('/teachers', ScheduleController.getAllTeachers);

router.post('/', authenticateToken, requireAdmin, (req, res, next) => {
  const { group, day, time, course } = req.body;
  if (!group || !group.trim()) return res.status(400).json({ success: false, error: 'Group is required' });
  if (!day || !VALID_DAYS.includes(day)) return res.status(400).json({ success: false, error: 'Valid day is required' });
  if (!time || !time.trim()) return res.status(400).json({ success: false, error: 'Time is required' });
  if (!course || !course.trim()) return res.status(400).json({ success: false, error: 'Course is required' });
  next();
}, ScheduleController.createOrUpdate);

router.delete('/:group/:day/:time', authenticateToken, requireAdmin, ScheduleController.delete);

module.exports = router;