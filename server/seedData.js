require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Department = require('./models/Department');
const Subject = require('./models/Subject');
const Teacher = require('./models/Teacher');
const Room = require('./models/Room');
const TimeSlot = require('./models/TimeSlot');
const ClassSection = require('./models/ClassSection');
const TimetableEntry = require('./models/TimetableEntry');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/timetable-scheduler';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔌 Connected to MongoDB for seeding...');

    // 1. Clear Existing Data
    console.log('🧹 Clearing old data...');
    await TimetableEntry.deleteMany({});
    await ClassSection.deleteMany({});
    await Teacher.deleteMany({});
    await Room.deleteMany({});
    await Subject.deleteMany({});
    await TimeSlot.deleteMany({});
    await Department.deleteMany({});
    
    // Note: Keep Users to avoid breaking existing logins, but ensure defaults exist
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
      console.log('👤 Seeding default users (admin/admin123, student/student123)...');
    }

    // 2. Seed Departments
    console.log('🏢 Seeding Departments...');
    const depts = await Department.create([
      { name: 'Computer Science & Engineering', code: 'CSE', hodName: 'Dr. Alan Turing', description: 'Department of CSE' },
      { name: 'Electronics & Communication Engineering', code: 'ECE', hodName: 'Dr. Nikola Tesla', description: 'Department of ECE' },
      { name: 'Mechanical Engineering', code: 'ME', hodName: 'Dr. James Watt', description: 'Department of Mechanical Engineering' }
    ]);

    const cseDept = depts[0];
    const eceDept = depts[1];
    const meDept = depts[2];

    // 3. Seed Subjects
    console.log('📚 Seeding Subjects...');
    const subjects = await Subject.create([
      // CSE Subjects
      { name: 'Data Structures', code: 'CS201', credits: 4, periodsPerWeek: 4, type: 'Theory', department: cseDept._id, semester: 3 },
      { name: 'Object Oriented Programming', code: 'CS202', credits: 4, periodsPerWeek: 3, type: 'Theory', department: cseDept._id, semester: 3 },
      { name: 'OOP Lab', code: 'CS202L', credits: 2, periodsPerWeek: 2, type: 'Lab', department: cseDept._id, semester: 3 },
      { name: 'Database Management Systems', code: 'CS203', credits: 4, periodsPerWeek: 4, type: 'Theory', department: cseDept._id, semester: 3 },
      { name: 'DBMS Lab', code: 'CS203L', credits: 2, periodsPerWeek: 2, type: 'Lab', department: cseDept._id, semester: 3 },
      { name: 'Operating Systems', code: 'CS204', credits: 3, periodsPerWeek: 3, type: 'Theory', department: cseDept._id, semester: 3 },

      // ECE Subjects
      { name: 'Microprocessors & Microcontrollers', code: 'EC301', credits: 4, periodsPerWeek: 4, type: 'Theory', department: eceDept._id, semester: 5 },
      { name: 'Digital Signal Processing', code: 'EC302', credits: 3, periodsPerWeek: 3, type: 'Theory', department: eceDept._id, semester: 5 },
      { name: 'DSP Lab', code: 'EC302L', credits: 2, periodsPerWeek: 2, type: 'Lab', department: eceDept._id, semester: 5 },
      { name: 'Analog Communication', code: 'EC303', credits: 4, periodsPerWeek: 3, type: 'Theory', department: eceDept._id, semester: 5 },

      // ME Subjects
      { name: 'Thermodynamics', code: 'ME101', credits: 4, periodsPerWeek: 4, type: 'Theory', department: meDept._id, semester: 1 },
      { name: 'Fluid Mechanics', code: 'ME102', credits: 3, periodsPerWeek: 3, type: 'Theory', department: meDept._id, semester: 1 },
      { name: 'Thermal Engineering Lab', code: 'ME102L', credits: 2, periodsPerWeek: 2, type: 'Lab', department: meDept._id, semester: 1 }
    ]);

    // 4. Seed Teachers (associated with subjects)
    console.log('👨‍🏫 Seeding Teachers...');
    await Teacher.create([
      // CSE
      { name: 'Dr. Alan Turing', department: cseDept._id, email: 'turing@college.edu', phone: '9876543210', designation: 'Professor & HOD', handledSubject: subjects[0]._id },
      { name: 'Dr. Grace Hopper', department: cseDept._id, email: 'hopper@college.edu', phone: '9876543211', designation: 'Professor', handledSubject: subjects[1]._id },
      { name: 'Prof. Ada Lovelace', department: cseDept._id, email: 'lovelace@college.edu', phone: '9876543212', designation: 'Assistant Professor', handledSubject: subjects[2]._id },
      { name: 'Dr. Edgar Codd', department: cseDept._id, email: 'codd@college.edu', phone: '9876543213', designation: 'Associate Professor', handledSubject: subjects[3]._id },
      { name: 'Prof. Dennis Ritchie', department: cseDept._id, email: 'ritchie@college.edu', phone: '9876543214', designation: 'Assistant Professor', handledSubject: subjects[4]._id },
      { name: 'Dr. Linus Torvalds', department: cseDept._id, email: 'torvalds@college.edu', phone: '9876543215', designation: 'Professor', handledSubject: subjects[5]._id },

      // ECE
      { name: 'Dr. Nikola Tesla', department: eceDept._id, email: 'tesla@college.edu', phone: '8765432100', designation: 'Professor & HOD', handledSubject: subjects[6]._id },
      { name: 'Prof. Claude Shannon', department: eceDept._id, email: 'shannon@college.edu', phone: '8765432101', designation: 'Associate Professor', handledSubject: subjects[7]._id },
      { name: 'Dr. Jack Kilby', department: eceDept._id, email: 'kilby@college.edu', phone: '8765432102', designation: 'Professor', handledSubject: subjects[8]._id },
      { name: 'Prof. Heinrich Hertz', department: eceDept._id, email: 'hertz@college.edu', phone: '8765432103', designation: 'Assistant Professor', handledSubject: subjects[9]._id },

      // ME
      { name: 'Dr. James Watt', department: meDept._id, email: 'watt@college.edu', phone: '7654321000', designation: 'Professor & HOD', handledSubject: subjects[10]._id },
      { name: 'Prof. Rudolf Diesel', department: meDept._id, email: 'diesel@college.edu', phone: '7654321001', designation: 'Associate Professor', handledSubject: subjects[11]._id },
      { name: 'Dr. Nicolas Carnot', department: meDept._id, email: 'carnot@college.edu', phone: '7654321002', designation: 'Assistant Professor', handledSubject: subjects[12]._id }
    ]);

    // 5. Seed Rooms
    console.log('🏫 Seeding Rooms...');
    await Room.create([
      { roomNumber: 'LH-101', capacity: 60, type: 'Classroom', building: 'Main Block', floor: 1, department: cseDept._id },
      { roomNumber: 'LH-102', capacity: 60, type: 'Classroom', building: 'Main Block', floor: 1, department: cseDept._id },
      { roomNumber: 'LH-201', capacity: 60, type: 'Classroom', building: 'Science Block', floor: 2, department: eceDept._id },
      { roomNumber: 'LH-301', capacity: 60, type: 'Classroom', building: 'Mechanical Block', floor: 3, department: meDept._id },
      { roomNumber: 'CSE-LAB1', capacity: 40, type: 'Lab', building: 'Main Block', floor: 2, department: cseDept._id },
      { roomNumber: 'CSE-LAB2', capacity: 40, type: 'Lab', building: 'Main Block', floor: 2, department: cseDept._id },
      { roomNumber: 'ECE-LAB1', capacity: 40, type: 'Lab', building: 'Science Block', floor: 1, department: eceDept._id },
      { roomNumber: 'ME-WORKSHOP', capacity: 50, type: 'Lab', building: 'Mechanical Block', floor: 0, department: meDept._id }
    ]);

    // 6. Seed Class Sections
    console.log('👥 Seeding Class Sections...');
    await ClassSection.create([
      { name: 'CSE-2A', department: cseDept._id, year: 2, semester: 3, section: 'A', studentCount: 55 },
      { name: 'CSE-2B', department: cseDept._id, year: 2, semester: 3, section: 'B', studentCount: 48 },
      { name: 'ECE-3A', department: eceDept._id, year: 3, semester: 5, section: 'A', studentCount: 42 },
      { name: 'ME-1A', department: meDept._id, year: 1, semester: 1, section: 'A', studentCount: 35 }
    ]);

    // 7. Seed Time Slots (8 periods per day, Monday - Friday)
    console.log('⏰ Seeding Time Slots...');
    const periods = [
      ['09:00', '09:55'], ['10:00', '10:55'],
      ['11:10', '12:05'], ['12:10', '13:00'],
      ['13:55', '14:50'], ['14:55', '15:50'],
      ['16:05', '17:00'], ['17:00', '17:15']
    ];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const slots = [];

    for (const day of days) {
      for (let i = 0; i < periods.length; i++) {
        slots.push({
          dayOfWeek: day,
          startTime: periods[i][0],
          endTime: periods[i][1],
          orderIndex: i + 1
        });
      }
    }
    await TimeSlot.insertMany(slots);

    console.log('✨ Database seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
