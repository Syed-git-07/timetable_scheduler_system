const express = require('express');
const Room = require('../models/Room');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/rooms
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.available) filter.available = req.query.available === 'true';
    if (req.query.department) filter.department = req.query.department;

    const rooms = await Room.find(filter).populate('department', 'name code').sort({ roomNumber: 1 });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/rooms
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const room = new Room(req.body);
    await room.save();
    const populated = await room.populate('department', 'name code');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Room number already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/rooms/:id
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('department', 'name code');
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    res.json(room);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Room number already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PATCH /api/rooms/:id/toggle
router.patch('/:id/toggle', auth, adminOnly, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    room.available = !room.available;
    await room.save();
    const populated = await room.populate('department', 'name code');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/rooms/:id
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    res.json({ message: 'Room deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
