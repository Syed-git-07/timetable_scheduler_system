const express = require('express');
const TimetableEntry = require('../models/TimetableEntry');
const ClassSection = require('../models/ClassSection');
const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const TimeSlot = require('../models/TimeSlot');
const timetableService = require('../services/timetableService');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/timetable/entries — All entries (optionally filter by class)
router.get('/entries', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.classSection) filter.classSection = req.query.classSection;
    if (req.query.teacher) filter.teacher = req.query.teacher;

    const entries = await TimetableEntry.find(filter)
      .populate({ path: 'teacher', populate: { path: 'department', select: 'name code' } })
      .populate({ path: 'subject', populate: { path: 'department', select: 'name code' } })
      .populate({ path: 'room', populate: { path: 'department', select: 'name code' } })
      .populate('timeSlot')
      .populate({ path: 'classSection', populate: { path: 'department', select: 'name code' } })
      .sort({ 'timeSlot.dayOfWeek': 1, 'timeSlot.orderIndex': 1 });

    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/timetable/stats — Dashboard statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const [teacherCount, subjectCount, roomCount, slotCount, entryCount, classCount, departmentCount] = await Promise.all([
      Teacher.countDocuments(),
      Subject.countDocuments(),
      Room.countDocuments(),
      TimeSlot.countDocuments(),
      TimetableEntry.countDocuments(),
      ClassSection.countDocuments(),
      require('../models/Department').countDocuments()
    ]);
    res.json({ teacherCount, subjectCount, roomCount, slotCount, entryCount, classCount, departmentCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/timetable/generate — Generate timetable for a single class
router.post('/generate', auth, adminOnly, async (req, res) => {
  try {
    const { classSectionId } = req.body;
    if (!classSectionId) {
      return res.status(400).json({ message: 'classSectionId is required.' });
    }
    const result = await timetableService.generateTimetable(classSectionId);
    res.json({ message: result });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/timetable/generate-all — Generate timetable for ALL class sections
router.post('/generate-all', auth, adminOnly, async (req, res) => {
  try {
    const allClasses = await ClassSection.find({}).lean();
    if (allClasses.length === 0) {
      return res.status(400).json({ message: 'No class sections found. Add classes first.' });
    }
    const results = [];
    for (const cls of allClasses) {
      const result = await timetableService.generateTimetable(cls._id.toString());
      results.push(`[${cls.name}] ${result}`);
    }
    res.json({ message: `Generated timetables for ${allClasses.length} class(es).`, details: results });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});



// POST /api/timetable/substitute — Substitute a teacher
router.post('/substitute', auth, adminOnly, async (req, res) => {
  try {
    const { absentTeacherId, substituteTeacherId } = req.body;
    if (!absentTeacherId || !substituteTeacherId) {
      return res.status(400).json({ message: 'Both teacher IDs are required.' });
    }
    const result = await timetableService.substituteTeacher(absentTeacherId, substituteTeacherId);
    res.json({ message: result });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/timetable/repair — Run repair algorithm
router.post('/repair', auth, adminOnly, async (req, res) => {
  try {
    const result = await timetableService.repairAffectedSlots();
    res.json({ message: result });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/timetable/update/:id — Update a single entry
router.put('/update/:id', auth, adminOnly, async (req, res) => {
  try {
    const error = await timetableService.validateAndUpdateEntry(req.params.id, req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    res.json({ success: true, message: 'Entry updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/timetable/add-custom — Add a custom entry
router.post('/add-custom', auth, adminOnly, async (req, res) => {
  try {
    const { classSectionId, timeSlotId, customLabel, teacherId, roomId } = req.body;
    const error = await timetableService.addCustomEntry(classSectionId, timeSlotId, customLabel, teacherId, roomId);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    res.json({ success: true, message: 'Custom period added.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/timetable/:id — Delete a single entry
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await TimetableEntry.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Period cleared.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/timetable/clear/all — Clear entire timetable
router.delete('/clear/all', auth, adminOnly, async (req, res) => {
  try {
    const result = await TimetableEntry.deleteMany({});
    res.json({ message: `Timetable cleared. ${result.deletedCount} entries removed.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/timetable/clear/class/:id — Clear timetable for a specific class
router.delete('/clear/class/:id', auth, adminOnly, async (req, res) => {
  try {
    const result = await TimetableEntry.deleteMany({ classSection: req.params.id });
    res.json({ message: `Cleared ${result.deletedCount} entries for this class.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
