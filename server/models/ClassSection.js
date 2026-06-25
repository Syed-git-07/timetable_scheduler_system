const mongoose = require('mongoose');

const classSectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  year: {
    type: Number,
    required: true,
    min: 1,
    max: 4
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  section: {
    type: String,
    default: 'A',
    trim: true,
    uppercase: true
  },
  studentCount: {
    type: Number,
    default: 60,
    min: 1
  }
}, { timestamps: true });

// Generate a display name like "CSE-2A" (dept code - year section)
classSectionSchema.virtual('displayName').get(function () {
  return this.name;
});

// Compound index
classSectionSchema.index({ department: 1, year: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('ClassSection', classSectionSchema);
