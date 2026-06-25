const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  dayOfWeek: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  orderIndex: {
    type: Number,
    required: true
  }
}, { timestamps: true });

// Compound index: each day+order combo should be unique
timeSlotSchema.index({ dayOfWeek: 1, orderIndex: 1 }, { unique: true });

timeSlotSchema.methods.toString = function () {
  return `${this.dayOfWeek} (${this.startTime} - ${this.endTime})`;
};

module.exports = mongoose.model('TimeSlot', timeSlotSchema);
