const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
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
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  designation: {
    type: String,
    trim: true
  },
  available: {
    type: Boolean,
    default: true
  },
  handledSubject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }
}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);
