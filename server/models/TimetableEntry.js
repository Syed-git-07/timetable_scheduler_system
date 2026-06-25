const mongoose = require('mongoose');

const timetableEntrySchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  timeSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimeSlot',
    required: true
  },
  classSection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSection',
    required: true
  },
  customLabel: {
    type: String,
    trim: true
  }
}, { timestamps: true });

// Indexes for fast conflict checking
timetableEntrySchema.index({ teacher: 1, timeSlot: 1 });
timetableEntrySchema.index({ room: 1, timeSlot: 1 });
timetableEntrySchema.index({ classSection: 1, timeSlot: 1 });
timetableEntrySchema.index({ classSection: 1 });

module.exports = mongoose.model('TimetableEntry', timetableEntrySchema);
