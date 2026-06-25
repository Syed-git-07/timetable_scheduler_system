const express = require('express');
const Subject = require('../models/Subject');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/subjects
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.semester) filter.semester = parseInt(req.query.semester);
    if (req.query.type) filter.type = req.query.type;

    const subjects = await Subject.find(filter).populate('department', 'name code').sort({ code: 1 });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/subjects/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate('department', 'name code');
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });
    res.json(subject);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/subjects
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const subject = new Subject(req.body);
    await subject.save();
    const populated = await subject.populate('department', 'name code');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Subject code already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/subjects/:id
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('department', 'name code');
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });
    res.json(subject);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Subject code already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/subjects/:id
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });
    res.json({ message: 'Subject deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
