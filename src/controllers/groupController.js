// src/controllers/scheduleController.js

const Schedule = require('../models/Schedule');
const Group = require('../models/Group');

class ScheduleController {
  static async getAll(req, res) {
    try {
      res.json(await Schedule.getAll());
    } catch (error) {
      console.error('Get all schedules error:', error);
      res.status(500).json({ success: false, error: 'Server error fetching schedules' });
    }
  }

  static async createOrUpdate(req, res) {
    try {
      const { group, day, time, course, teacher, room, subjectType } = req.body;

      // Auto-create group if it doesn't exist yet
      const groupExists = await Group.exists(group);
      if (!groupExists) {
        await Group.create(group);
      }

      const schedule = await Schedule.upsert(
        group, day, time, course,
        teacher || null,
        room || null,
        subjectType || 'lecture'
      );

      res.json({
        success: true,
        data: {
          id: schedule.id,
          group: schedule.group_name,
          day: schedule.day,
          time: schedule.time,
          course: schedule.course,
          teacher: schedule.teacher,
          room: schedule.room,
          subjectType: schedule.subject_type,
        }
      });
    } catch (error) {
      console.error('Create/Update schedule error:', error);
      res.status(500).json({ success: false, error: 'Server error saving schedule' });
    }
  }

  static async delete(req, res) {
    try {
      const { group, day, time } = req.params;
      const deleted = await Schedule.delete(group, day, time);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Schedule entry not found' });
      }
      res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
      console.error('Delete schedule error:', error);
      res.status(500).json({ success: false, error: 'Server error deleting schedule' });
    }
  }

  static async getByDay(req, res) {
    try {
      res.json(await Schedule.getByDay(req.params.day));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }

  static async getByTeacher(req, res) {
    try {
      res.json(await Schedule.getByTeacher(req.params.teacher));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }

  static async getByGroup(req, res) {
    try {
      res.json(await Schedule.getByGroup(req.params.group));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }

  static async getAllTeachers(req, res) {
    try {
      res.json(await Schedule.getAllTeachers());
    } catch (error) {
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
}

module.exports = ScheduleController;