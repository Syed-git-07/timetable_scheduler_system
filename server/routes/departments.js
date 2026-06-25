const express = require('express');
const Department = require('../models/Department');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/departments
router.get('/', auth, async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/departments/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: 'Department not found.' });
    res.json(department);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/departments
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const department = new Department(req.body);
    await department.save();
    res.status(201).json(department);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Department name or code already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/departments/:id
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!department) return res.status(404).json({ message: 'Department not found.' });
    res.json(department);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Department name or code already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/departments/:id
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) return res.status(404).json({ message: 'Department not found.' });
    res.json({ message: 'Department deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
