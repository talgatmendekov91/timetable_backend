// src/controllers/groupController.js

const Group = require('../models/Group');
const Schedule = require('../models/Schedule');

class GroupController {
  static async getAll(req, res) {
    try {
      const groups = await Group.getAll();
      res.json(groups);
    } catch (error) {
      console.error('Get all groups error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Server error fetching groups' 
      });
    }
  }

  static async create(req, res) {
    try {
      const { name } = req.body;

      // Check if group already exists
      const exists = await Group.exists(name);
      if (exists) {
        return res.status(400).json({ 
          success: false,
          error: 'Group already exists' 
        });
      }

      const group = await Group.create(name);

      res.status(201).json({
        success: true,
        data: {
          id: group.id,
          name: group.name
        }
      });
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Server error creating group' 
      });
    }
  }

  static async delete(req, res) {
    try {
      const { name } = req.params;

      // Delete all schedules for this group first
      await Schedule.deleteByGroup(name);

      // Delete the group
      const deleted = await Group.delete(name);
      
      if (!deleted) {
        return res.status(404).json({ 
          success: false,
          error: 'Group not found' 
        });
      }

      res.json({ 
        success: true,
        message: 'Group and associated schedules deleted successfully' 
      });
    } catch (error) {
      console.error('Delete group error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Server error deleting group' 
      });
    }
  }
}

module.exports = GroupController;
