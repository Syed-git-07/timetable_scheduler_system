const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/auth/register (admin creates accounts)
router.post('/register', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only admins can create accounts.' });
    }

    const { username, password, role, email, fullName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    const user = new User({ username, password, role: role || 'STUDENT', email, fullName });
    await user.save();
    res.status(201).json({ message: 'User created successfully.', user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ message: 'Username and new password are required.' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'Username not found.' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password successfully changed.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

module.exports = router;
