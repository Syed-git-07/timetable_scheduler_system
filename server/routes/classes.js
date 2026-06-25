const express = require('express');
const ClassSection = require('../models/ClassSection');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/classes
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.year) filter.year = parseInt(req.query.year);
    if (req.query.semester) filter.semester = parseInt(req.query.semester);

    const classes = await ClassSection.find(filter)
      .populate('department', 'name code')
      .sort({ name: 1 });
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/classes/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const cls = await ClassSection.findById(req.params.id).populate('department', 'name code');
    if (!cls) return res.status(404).json({ message: 'Class not found.' });
    res.json(cls);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/classes
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const cls = new ClassSection(req.body);
    await cls.save();
    const populated = await cls.populate('department', 'name code');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This class section already exists for the department.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/classes/:id
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const cls = await ClassSection.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('department', 'name code');
    if (!cls) return res.status(404).json({ message: 'Class not found.' });
    res.json(cls);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This class section already exists for the department.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/classes/:id
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const cls = await ClassSection.findByIdAndDelete(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Class not found.' });
    res.json({ message: 'Class deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
