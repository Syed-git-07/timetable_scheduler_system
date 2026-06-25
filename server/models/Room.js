const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  type: {
    type: String,
    enum: ['Classroom', 'Lab', 'Seminar Hall', 'Auditorium'],
    default: 'Classroom'
  },
  building: {
    type: String,
    trim: true
  },
  floor: {
    type: Number,
    default: 0
  },
  available: {
    type: Boolean,
    default: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
