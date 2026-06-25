const express = require('express');
const Teacher = require('../models/Teacher');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/teachers
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.available) filter.available = req.query.available === 'true';

    const teachers = await Teacher.find(filter)
      .populate('department', 'name code')
      .populate('handledSubject', 'name code type')
      .sort({ name: 1 });
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/teachers/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .populate('department', 'name code')
      .populate('handledSubject', 'name code type');
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/teachers
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const teacher = new Teacher(req.body);
    await teacher.save();
    const populated = await teacher.populate([
      { path: 'department', select: 'name code' },
      { path: 'handledSubject', select: 'name code type' }
    ]);
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/teachers/:id
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('department', 'name code')
      .populate('handledSubject', 'name code type');
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PATCH /api/teachers/:id/toggle
router.patch('/:id/toggle', auth, adminOnly, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
    teacher.available = !teacher.available;
    await teacher.save();
    const populated = await teacher.populate([
      { path: 'department', select: 'name code' },
      { path: 'handledSubject', select: 'name code type' }
    ]);
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/teachers/:id
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
    res.json({ message: 'Teacher deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
