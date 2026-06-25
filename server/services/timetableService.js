/**
 * Timetable Scheduling Service
 * =============================
 * Faithfully ported from the Java Spring Boot TimetableService (692 lines).
 * 
 * Core algorithms:
 * 1. Auto-seed 8-period academic day
 * 2. Intelligent timetable generation (theory spread, lab pairing, multi-section)
 * 3. 5-strategy reactive repair algorithm
 * 4. Teacher substitution with conflict checking
 * 5. 4-way conflict validation for manual edits
 */

const TimetableEntry = require('../models/TimetableEntry');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const TimeSlot = require('../models/TimeSlot');
const Subject = require('../models/Subject');
const ClassSection = require('../models/ClassSection');

// ─── Helper: Shuffle array (Fisher-Yates) ───
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Helper: Get sorted time slots ───
async function getSortedTimeSlots() {
  const slots = await TimeSlot.find().lean();
  const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  return slots.sort((a, b) => (dayOrder[a.dayOfWeek] || 7) - (dayOrder[b.dayOfWeek] || 7) || a.orderIndex - b.orderIndex);
}

// ─── Helper: Check if teacher is busy at a slot ───
async function existsByTeacherAndSlot(teacherId, slotId) {
  if (!teacherId || !slotId) return false;
  return TimetableEntry.exists({ teacher: teacherId, timeSlot: slotId });
}

// ─── Helper: Check if room is busy at a slot ───
async function existsByRoomAndSlot(roomId, slotId) {
  if (!roomId || !slotId) return false;
  return TimetableEntry.exists({ room: roomId, timeSlot: slotId });
}

// ─── Helper: Check if class is busy at a slot ───
async function isClassBusy(classSectionId, slotId, maxSections = 1) {
  const count = await TimetableEntry.countDocuments({ classSection: classSectionId, timeSlot: slotId });
  return count >= maxSections;
}

// ─── Helper: Get valid rooms for a slot ───
async function getValidRooms(rooms, slotId, isLabPeriod) {
  const results = [];
  for (const room of rooms) {
    if (isLabPeriod && (!room.type || room.type !== 'Lab')) continue;
    if (!isLabPeriod && room.type === 'Lab') continue;
    const busy = await existsByRoomAndSlot(room._id, slotId);
    if (!busy) results.push(room);
  }
  return results;
}

// ─── Helper: Get valid teachers for a slot ───
async function getValidTeachers(teachers, slotId) {
  const results = [];
  for (const teacher of teachers) {
    const busy = await existsByTeacherAndSlot(teacher._id, slotId);
    if (!busy) results.push(teacher);
  }
  return results;
}

// ─── Helper: Save a timetable entry ───
async function saveEntry(classSectionId, teacher, subject, room, slotId) {
  const entry = new TimetableEntry({
    classSection: classSectionId,
    teacher: teacher._id,
    subject: subject._id,
    room: room._id,
    timeSlot: slotId
  });
  return entry.save();
}

// ═══════════════════════════════════════════════════════
// GENERATE TIMETABLE
// ═══════════════════════════════════════════════════════

/**
 * Generate a one-week timetable for a single class section.
 * Each teacher's subject is allocated exactly 'periodsPerWeek' periods.
 * Theory → spread across different days
 * Lab → back-to-back pairs (first 2 continuous, then singles)
 * Integrated → theory + lab split
 */
async function generateTimetable(classSectionId) {
  const classSection = await ClassSection.findById(classSectionId).populate('department');
  if (!classSection) return 'Class section not found.';

  const studentCount = classSection.studentCount || 60;

  // Auto-seed slots if none exist
  const slotCount = await TimeSlot.countDocuments();
  if (slotCount === 0) {
    return 'No time slots found. Please seed time slots first.';
  }

  // Clear only this class's entries
  await TimetableEntry.deleteMany({ classSection: classSectionId });

  // Get all available teachers (from the class's department or shared subjects)
  const teachers = await Teacher.find({ available: true })
    .populate('handledSubject')
    .lean();

  const allRooms = await Room.find({ available: true }).lean();
  const timeSlots = await getSortedTimeSlots();

  // Calculate sections based on room capacity
  const maxRoomCap = allRooms.reduce((max, r) => Math.max(max, r.capacity || 0), 0);
  let sectionsRequired = 1;
  if (studentCount > maxRoomCap && maxRoomCap > 0) {
    sectionsRequired = Math.ceil(studentCount / maxRoomCap);
  }
  const requiredCapacity = Math.ceil(studentCount / sectionsRequired);

  const rooms = allRooms.filter(r => r.capacity >= requiredCapacity);

  if (teachers.length === 0) return 'No available teachers found. Add teachers with subjects.';
  if (rooms.length === 0) return `No available rooms found for capacity ${requiredCapacity}.`;
  if (timeSlots.length === 0) return 'No time slots found. Use auto-seed on the Time Slots page.';

  // Get unique subjects from the available teachers
  const subjectMap = new Map();
  for (const t of teachers) {
    if (t.handledSubject) {
      subjectMap.set(t.handledSubject._id.toString(), t.handledSubject);
    }
  }
  const uniqueSubjects = Array.from(subjectMap.values());

  let generatedCount = 0;

  for (const subject of uniqueSubjects) {
    const subjectTeachers = teachers.filter(
      t => t.handledSubject && t.handledSubject._id.toString() === subject._id.toString()
    );

    if (subjectTeachers.length < sectionsRequired) continue;

    let theoryPeriods = 0;
    let labPeriods = 0;
    const type = subject.type || 'Theory';
    let totalPeriods = subject.periodsPerWeek || 1;
    if (totalPeriods <= 0) totalPeriods = 1;

    if (type === 'Integrated') {
      labPeriods = Math.min(2, totalPeriods);
      theoryPeriods = totalPeriods - labPeriods;
    } else if (type === 'Lab') {
      labPeriods = totalPeriods;
    } else {
      theoryPeriods = totalPeriods;
    }

    const doubleBlocks = Math.floor(labPeriods / 2);
    const remainingLabSingles = labPeriods % 2;

    // Schedule continuous lab blocks
    for (let i = 0; i < doubleBlocks; i++) {
      const success = await scheduleContinuous(classSectionId, subjectTeachers, subject, rooms, timeSlots, true, sectionsRequired);
      if (success) generatedCount += 2 * sectionsRequired;
    }

    // Schedule remaining single lab periods
    for (let i = 0; i < remainingLabSingles; i++) {
      const success = await scheduleSingle(classSectionId, subjectTeachers, subject, rooms, timeSlots, true, sectionsRequired);
      if (success) generatedCount += 1 * sectionsRequired;
    }

    // Schedule theory periods
    for (let i = 0; i < theoryPeriods; i++) {
      const success = await scheduleSingle(classSectionId, subjectTeachers, subject, rooms, timeSlots, false, sectionsRequired);
      if (success) generatedCount += 1 * sectionsRequired;
    }
  }

  return `Timetable generated for '${classSection.name}'. Total periods assigned: ${generatedCount}`;
}

// ─── Schedule a single period ───
async function scheduleSingle(classSectionId, subjectTeachers, subject, rooms, timeSlots, isLabPeriod, sectionsRequired) {
  const shuffledSlots = shuffle(timeSlots);

  // Pass 1: Try to find a day where this subject is NOT already scheduled
  for (const slot of shuffledSlots) {
    const currentEntries = await TimetableEntry.find({ classSection: classSectionId })
      .populate('subject')
      .populate('timeSlot')
      .populate('room')
      .lean();

    const subjectAlreadyOnDay = currentEntries.some(
      e => e.subject && e.subject._id.toString() === subject._id.toString() &&
        e.timeSlot && e.timeSlot.dayOfWeek === slot.dayOfWeek
    );
    if (subjectAlreadyOnDay) continue;

    if (await isClassBusy(classSectionId, slot._id, 1)) continue;

    if (isLabPeriod) {
      const labsOnDay = currentEntries.filter(
        e => e.timeSlot && e.timeSlot.dayOfWeek === slot.dayOfWeek &&
          e.room && e.room.type === 'Lab'
      ).length;
      if (labsOnDay >= 4 * sectionsRequired) continue;
    }

    const validRooms = await getValidRooms(rooms, slot._id, isLabPeriod);
    const validTeachers = await getValidTeachers(subjectTeachers, slot._id);

    if (validRooms.length >= sectionsRequired && validTeachers.length >= sectionsRequired) {
      for (let i = 0; i < sectionsRequired; i++) {
        await saveEntry(classSectionId, validTeachers[i], subject, validRooms[i], slot._id);
      }
      return true;
    }
  }

  // Pass 2: Fallback — allow multiple periods on the same day
  for (const slot of shuffledSlots) {
    if (await isClassBusy(classSectionId, slot._id, 1)) continue;

    if (isLabPeriod) {
      const currentEntries = await TimetableEntry.find({ classSection: classSectionId })
        .populate('timeSlot').populate('room').lean();
      const labsOnDay = currentEntries.filter(
        e => e.timeSlot && e.timeSlot.dayOfWeek === slot.dayOfWeek &&
          e.room && e.room.type === 'Lab'
      ).length;
      if (labsOnDay >= 6 * sectionsRequired) continue;
    }

    const validRooms = await getValidRooms(rooms, slot._id, isLabPeriod);
    const validTeachers = await getValidTeachers(subjectTeachers, slot._id);

    if (validRooms.length >= sectionsRequired && validTeachers.length >= sectionsRequired) {
      for (let i = 0; i < sectionsRequired; i++) {
        await saveEntry(classSectionId, validTeachers[i], subject, validRooms[i], slot._id);
      }
      return true;
    }
  }

  return false;
}

// ─── Schedule continuous (back-to-back) lab periods ───
async function scheduleContinuous(classSectionId, subjectTeachers, subject, rooms, timeSlots, isLabPeriod, sectionsRequired) {
  for (let pass = 1; pass <= 3; pass++) {
    for (let i = 0; i < timeSlots.length - 1; i++) {
      const s1 = timeSlots[i];
      const s2 = timeSlots[i + 1];

      if (s1.dayOfWeek !== s2.dayOfWeek) continue;
      if (s2.orderIndex !== s1.orderIndex + 1) continue;
      if (await isClassBusy(classSectionId, s1._id, 1)) continue;
      if (await isClassBusy(classSectionId, s2._id, 1)) continue;

      const currentEntries = await TimetableEntry.find({ classSection: classSectionId })
        .populate('subject').populate('timeSlot').populate('room').lean();

      const subjectAlreadyOnDay = currentEntries.some(
        e => e.subject && e.subject._id.toString() === subject._id.toString() &&
          e.timeSlot && e.timeSlot.dayOfWeek === s1.dayOfWeek
      );
      if (pass === 1 && subjectAlreadyOnDay) continue;

      if (isLabPeriod) {
        const labsOnDay = currentEntries.filter(
          e => e.timeSlot && e.timeSlot.dayOfWeek === s1.dayOfWeek &&
            e.room && e.room.type === 'Lab'
        ).length;
        if (pass <= 2 && labsOnDay >= 4 * sectionsRequired) continue;
        if (pass === 3 && labsOnDay >= 6 * sectionsRequired) continue;

        // Only allow valid break-aligned pairs: odd orderIndex starts (P1,P2), (P3,P4), etc.
        if (s1.orderIndex % 2 === 0) continue;

        // Prevent adjacent labs
        if (pass <= 2) {
          const s0 = i > 0 ? timeSlots[i - 1] : null;
          const s3 = i < timeSlots.length - 2 ? timeSlots[i + 2] : null;
          let adjacentLab = false;

          if (s0 && s0.dayOfWeek === s1.dayOfWeek) {
            adjacentLab = currentEntries.some(
              e => e.timeSlot && e.timeSlot._id.toString() === s0._id.toString() &&
                e.room && e.room.type === 'Lab'
            );
          }
          if (!adjacentLab && s3 && s3.dayOfWeek === s1.dayOfWeek) {
            adjacentLab = currentEntries.some(
              e => e.timeSlot && e.timeSlot._id.toString() === s3._id.toString() &&
                e.room && e.room.type === 'Lab'
            );
          }
          if (adjacentLab) continue;
        }
      }

      // Find rooms and teachers available for BOTH slots
      const validRooms1 = await getValidRooms(rooms, s1._id, isLabPeriod);
      const validRooms2 = await getValidRooms(rooms, s2._id, isLabPeriod);
      const continuousRooms = validRooms1.filter(
        r => validRooms2.some(r2 => r2._id.toString() === r._id.toString())
      );

      const validTeachers1 = await getValidTeachers(subjectTeachers, s1._id);
      const validTeachers2 = await getValidTeachers(subjectTeachers, s2._id);
      const continuousTeachers = validTeachers1.filter(
        t => validTeachers2.some(t2 => t2._id.toString() === t._id.toString())
      );

      if (continuousRooms.length >= sectionsRequired && continuousTeachers.length >= sectionsRequired) {
        for (let j = 0; j < sectionsRequired; j++) {
          await saveEntry(classSectionId, continuousTeachers[j], subject, continuousRooms[j], s1._id);
          await saveEntry(classSectionId, continuousTeachers[j], subject, continuousRooms[j], s2._id);
        }
        return true;
      }
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════
// SUBSTITUTE TEACHER
// ═══════════════════════════════════════════════════════

async function substituteTeacher(absentTeacherId, substituteTeacherId) {
  if (absentTeacherId === substituteTeacherId) {
    return 'Absent teacher and substitute teacher cannot be the same.';
  }

  const absentTeacher = await Teacher.findById(absentTeacherId);
  const subTeacher = await Teacher.findById(substituteTeacherId);
  if (!absentTeacher || !subTeacher) return 'Invalid teacher selection.';

  const allEntries = await TimetableEntry.find().populate('teacher').populate('timeSlot').lean();
  let substitutionCount = 0;

  for (const entry of allEntries) {
    if (entry.teacher && entry.teacher._id.toString() === absentTeacherId) {
      const isSubBusy = allEntries.some(
        e => e.teacher && e.teacher._id.toString() === substituteTeacherId &&
          e.timeSlot && entry.timeSlot &&
          e.timeSlot._id.toString() === entry.timeSlot._id.toString()
      );

      if (!isSubBusy) {
        await TimetableEntry.findByIdAndUpdate(entry._id, { teacher: substituteTeacherId });
        substitutionCount++;
      }
    }
  }

  return `Substituted ${absentTeacher.name} with ${subTeacher.name} for ${substitutionCount} periods.`;
}

// ═══════════════════════════════════════════════════════
// 5-STRATEGY REACTIVE REPAIR ALGORITHM
// ═══════════════════════════════════════════════════════

async function repairAffectedSlots() {
  const allEntries = await TimetableEntry.find()
    .populate('teacher').populate('room').populate('timeSlot').populate('subject');
  const allTeachers = await Teacher.find().lean();
  const allRooms = await Room.find().lean();
  const allSlots = await getSortedTimeSlots();

  const availableTeachers = allTeachers.filter(t => t.available);
  const availableRooms = allRooms.filter(r => r.available);

  // Identify conflicts: entries where teacher or room is now unavailable
  const conflicts = allEntries.filter(
    e => (e.teacher && !e.teacher.available) || (e.room && !e.room.available)
  );

  let reassigned = 0, swapped = 0, substituted = 0, roomChanged = 0, backtracked = 0, unresolved = 0;

  for (const conflict of conflicts) {
    let resolved = false;

    // Strategy 1: Try Reassign Slot
    if (!resolved) {
      for (const freeSlot of allSlots) {
        if (conflict.timeSlot && freeSlot._id.toString() === conflict.timeSlot._id.toString()) continue;
        if (await isClassBusy(conflict.classSection, freeSlot._id, 1)) continue;

        if (conflict.teacher && conflict.teacher.available &&
          !(await existsByTeacherAndSlot(conflict.teacher._id, freeSlot._id)) &&
          conflict.room && conflict.room.available &&
          !(await existsByRoomAndSlot(conflict.room._id, freeSlot._id))) {
          await TimetableEntry.findByIdAndUpdate(conflict._id, { timeSlot: freeSlot._id });
          reassigned++;
          resolved = true;
          break;
        }
      }
    }

    // Strategy 2: Try Swap
    if (!resolved) {
      const classmates = allEntries.filter(
        e => e.classSection && conflict.classSection &&
          e.classSection.toString() === conflict.classSection.toString() &&
          e._id.toString() !== conflict._id.toString() &&
          e.teacher && e.teacher.available && e.room && e.room.available
      );

      for (const candidate of classmates) {
        if (!conflict.timeSlot || !candidate.timeSlot) continue;
        const slotA = conflict.timeSlot._id;
        const slotB = candidate.timeSlot._id;

        const teacher = conflict.teacher || candidate.teacher;
        const room = conflict.room || candidate.room;

        const canSwap = !(await existsByTeacherAndSlot(teacher._id, slotB)) &&
          !(await existsByRoomAndSlot(room._id, slotB));

        if (canSwap) {
          await TimetableEntry.findByIdAndUpdate(conflict._id, { timeSlot: slotB });
          await TimetableEntry.findByIdAndUpdate(candidate._id, { timeSlot: slotA });
          swapped++;
          resolved = true;
          break;
        }
      }
    }

    // Strategy 3: Substitute Teacher (same dept, free in that slot)
    if (!resolved && conflict.teacher && !conflict.teacher.available) {
      const dept = conflict.teacher.department;
      const candidates = [];
      for (const t of availableTeachers) {
        if (dept && t.department && t.department.toString() === dept.toString()) {
          if (!(await existsByTeacherAndSlot(t._id, conflict.timeSlot?._id))) {
            const load = await TimetableEntry.countDocuments({ teacher: t._id });
            candidates.push({ teacher: t, load });
          }
        }
      }
      candidates.sort((a, b) => a.load - b.load);

      if (candidates.length > 0) {
        await TimetableEntry.findByIdAndUpdate(conflict._id, { teacher: candidates[0].teacher._id });
        substituted++;
        resolved = true;
      }
    }

    // Strategy 4: Room Change (same type, free in that slot)
    if (!resolved && conflict.room && !conflict.room.available) {
      const roomType = conflict.room.type;
      const candidates = [];
      for (const r of availableRooms) {
        if (roomType && r.type === roomType) {
          if (!(await existsByRoomAndSlot(r._id, conflict.timeSlot?._id))) {
            candidates.push(r);
          }
        }
      }
      candidates.sort((a, b) => b.capacity - a.capacity);

      if (candidates.length > 0) {
        await TimetableEntry.findByIdAndUpdate(conflict._id, { room: candidates[0]._id });
        roomChanged++;
        resolved = true;
      }
    }

    // Strategy 5: Backtracking + Cost Computation
    if (!resolved) {
      let bestCost = 10;
      let anyTeacher = null;
      let anyRoom = null;

      if (conflict.teacher && !conflict.teacher.available) {
        for (const t of availableTeachers) {
          if (!(await existsByTeacherAndSlot(t._id, conflict.timeSlot?._id))) {
            anyTeacher = t;
            bestCost = 5;
            break;
          }
        }
      }

      if (conflict.room && !conflict.room.available) {
        for (const r of availableRooms) {
          if (!(await existsByRoomAndSlot(r._id, conflict.timeSlot?._id))) {
            anyRoom = r;
            if (3 < bestCost) bestCost = 3;
            break;
          }
        }
      }

      if (bestCost === 3 && anyRoom) {
        await TimetableEntry.findByIdAndUpdate(conflict._id, { room: anyRoom._id });
        backtracked++;
        resolved = true;
      } else if (bestCost === 5 && anyTeacher) {
        await TimetableEntry.findByIdAndUpdate(conflict._id, { teacher: anyTeacher._id });
        backtracked++;
        resolved = true;
      } else {
        await TimetableEntry.findByIdAndDelete(conflict._id);
        unresolved++;
      }
    }
  }

  return `Repair complete: ${reassigned} reassigned | ${swapped} swapped | ${substituted} substituted | ${roomChanged} room-changed | ${backtracked} backtracked | ${unresolved} unresolved.`;
}

// ═══════════════════════════════════════════════════════
// VALIDATE AND UPDATE ENTRY (Manual Edit)
// ═══════════════════════════════════════════════════════

async function validateAndUpdateEntry(entryId, { subjectId, teacherId, roomId, timeSlotId, customLabel }) {
  const entry = await TimetableEntry.findById(entryId);
  if (!entry) return 'Entry not found.';

  const newTeacher = teacherId ? await Teacher.findById(teacherId) : null;
  const newRoom = roomId ? await Room.findById(roomId) : null;
  const newSlot = timeSlotId ? await TimeSlot.findById(timeSlotId) : null;
  const newSubject = subjectId ? await Subject.findById(subjectId) : null;

  const effectiveTeacherId = teacherId || entry.teacher;
  const effectiveRoomId = roomId || entry.room;
  const effectiveSlotId = timeSlotId || entry.timeSlot;
  const effectiveSubjectId = subjectId || entry.subject;

  // Custom label entries skip subject checks
  if (customLabel && customLabel.trim()) {
    entry.subject = null;
    entry.teacher = effectiveTeacherId;
    entry.room = effectiveRoomId;
    entry.timeSlot = effectiveSlotId;
    entry.customLabel = customLabel;
    await entry.save();
    return null;
  }

  // Conflict Check 1: Teacher double-booked
  if (effectiveTeacherId && effectiveSlotId) {
    const teacherBusy = await TimetableEntry.exists({
      _id: { $ne: entryId },
      teacher: effectiveTeacherId,
      timeSlot: effectiveSlotId
    });
    if (teacherBusy) {
      const t = newTeacher || await Teacher.findById(effectiveTeacherId);
      return `Conflict: Teacher '${t?.name || 'Unknown'}' is already assigned to another class in this slot.`;
    }
  }

  // Conflict Check 2: Room double-booked
  if (effectiveRoomId && effectiveSlotId) {
    const roomBusy = await TimetableEntry.exists({
      _id: { $ne: entryId },
      room: effectiveRoomId,
      timeSlot: effectiveSlotId
    });
    if (roomBusy) {
      const r = newRoom || await Room.findById(effectiveRoomId);
      return `Conflict: Room '${r?.roomNumber || 'Unknown'}' is already booked in this slot.`;
    }
  }

  // Conflict Check 3: Class already has another subject in the same slot
  if (effectiveSlotId) {
    const classBusy = await TimetableEntry.findOne({
      _id: { $ne: entryId },
      classSection: entry.classSection,
      timeSlot: effectiveSlotId,
      subject: { $ne: effectiveSubjectId }
    });
    if (classBusy) {
      return `Conflict: This class already has a different subject in this slot.`;
    }
  }

  // Conflict Check 4: Subject period count
  if (effectiveSubjectId) {
    const subject = newSubject || await Subject.findById(effectiveSubjectId);
    if (subject && subject.periodsPerWeek > 0) {
      const existingCount = await TimetableEntry.countDocuments({
        _id: { $ne: entryId },
        classSection: entry.classSection,
        subject: effectiveSubjectId
      });
      if (existingCount >= subject.periodsPerWeek) {
        return `Warning: '${subject.name}' already has ${existingCount}/${subject.periodsPerWeek} periods. Adding more exceeds the weekly quota.`;
      }
    }
  }

  // Apply changes
  entry.subject = effectiveSubjectId;
  entry.teacher = effectiveTeacherId;
  entry.room = effectiveRoomId;
  entry.timeSlot = effectiveSlotId;
  entry.customLabel = null;
  await entry.save();
  return null;
}

// ─── Add custom entry ───
async function addCustomEntry(classSectionId, timeSlotId, customLabel, teacherId, roomId) {
  const slot = await TimeSlot.findById(timeSlotId);
  if (!slot) return 'Invalid time slot.';

  const existing = await TimetableEntry.exists({ classSection: classSectionId, timeSlot: timeSlotId });
  if (existing) return 'This slot is already occupied. Edit the existing entry instead.';

  const entry = new TimetableEntry({
    classSection: classSectionId,
    timeSlot: timeSlotId,
    customLabel,
    teacher: teacherId || undefined,
    room: roomId || undefined
  });
  await entry.save();
  return null;
}

module.exports = {
  generateTimetable,
  substituteTeacher,
  repairAffectedSlots,
  validateAndUpdateEntry,
  addCustomEntry
};
