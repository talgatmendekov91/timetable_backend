const express = require('express');
const ScheduleController = require('../controllers/scheduleController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

const VALID_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

router.get('/',                 function(req, res) { ScheduleController.getAll(req, res); });
router.get('/day/:day',         function(req, res) { ScheduleController.getByDay(req, res); });
router.get('/teacher/:teacher', function(req, res) { ScheduleController.getByTeacher(req, res); });
router.get('/group/:group',     function(req, res) { ScheduleController.getByGroup(req, res); });
router.get('/teachers',         function(req, res) { ScheduleController.getAllTeachers(req, res); });

router.post('/', authenticateToken, requireAdmin, function(req, res) {
  const { group, day, time, course } = req.body;
  if (!group || !group.trim()) return res.status(400).json({ success: false, error: 'Group is required' });
  if (!day || !VALID_DAYS.includes(day)) return res.status(400).json({ success: false, error: 'Valid day is required' });
  if (!time || !time.trim()) return res.status(400).json({ success: false, error: 'Time is required' });
  if (!course || !course.trim()) return res.status(400).json({ success: false, error: 'Course is required' });
  ScheduleController.createOrUpdate(req, res);
});

router.delete('/:group/:day/:time', authenticateToken, requireAdmin, function(req, res) {
  ScheduleController.delete(req, res);
});

module.exports = router;