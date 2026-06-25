const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  hodName: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);
