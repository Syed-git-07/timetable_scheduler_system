const express = require('express');
const TimeSlot = require('../models/TimeSlot');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/timeslots
router.get('/', auth, async (req, res) => {
  try {
    const slots = await TimeSlot.find().sort({ dayOfWeek: 1, orderIndex: 1 });
    // Custom sort for days of week
    const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    slots.sort((a, b) => (dayOrder[a.dayOfWeek] || 7) - (dayOrder[b.dayOfWeek] || 7) || a.orderIndex - b.orderIndex);
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/timeslots
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const slot = new TimeSlot(req.body);
    await slot.save();
    res.status(201).json(slot);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A time slot with this day and order already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/timeslots/seed — Auto-seed 8-period academic day for Mon-Fri
router.post('/seed', auth, adminOnly, async (req, res) => {
  try {
    const existing = await TimeSlot.countDocuments();
    if (existing > 0) {
      return res.status(400).json({ message: 'Time slots already exist. Clear them first to re-seed.' });
    }

    const periods = [
      ['09:00', '09:55'], ['10:00', '10:55'],
      ['11:10', '12:05'], ['12:10', '13:00'],
      ['13:55', '14:50'], ['14:55', '15:50'],
      ['16:05', '17:00'], ['17:00', '17:15']
    ];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const slots = [];

    for (const day of days) {
      for (let i = 0; i < periods.length; i++) {
        slots.push({
          dayOfWeek: day,
          startTime: periods[i][0],
          endTime: periods[i][1],
          orderIndex: i + 1
        });
      }
    }

    await TimeSlot.insertMany(slots);
    res.status(201).json({ message: `Auto-seeded ${slots.length} time slots (8 periods/day × 5 days).`, count: slots.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/timeslots/clear — Clear all time slots
router.delete('/clear', auth, adminOnly, async (req, res) => {
  try {
    const result = await TimeSlot.deleteMany({});
    res.json({ message: `Cleared ${result.deletedCount} time slots.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/timeslots/:id
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const slot = await TimeSlot.findByIdAndDelete(req.params.id);
    if (!slot) return res.status(404).json({ message: 'Time slot not found.' });
    res.json({ message: 'Time slot deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
