require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───
app.use('/api/auth', require('./routes/auth'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/timeslots', require('./routes/timeslots'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/timetable', require('./routes/timetable'));

// ─── Health check ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ─── Error handler ───
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error.' });
});

// ─── Connect to MongoDB and start server ───
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/timetable-scheduler';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Seed default users if none exist
    const User = require('./models/User');
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.create([
        {
          username: 'admin',
          password: 'admin123',
          role: 'ADMIN',
          email: 'admin@college.edu',
          fullName: 'System Administrator'
        },
        {
          username: 'student',
          password: 'student123',
          role: 'STUDENT',
          email: 'student@college.edu',
          fullName: 'Demo Student'
        }
      ]);
      console.log('✅ Default users seeded (admin/admin123, student/student123)');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
