const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  credits: {
    type: Number,
    default: 3,
    min: 0
  },
  periodsPerWeek: {
    type: Number,
    default: 1,
    min: 1
  },
  type: {
    type: String,
    enum: ['Theory', 'Lab', 'Integrated'],
    default: 'Theory'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  semester: {
    type: Number,
    min: 1,
    max: 8
  }
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
