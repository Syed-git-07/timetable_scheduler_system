package com.example.timetablescheduler.service;

import com.example.timetablescheduler.model.*;
import com.example.timetablescheduler.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TimetableService {

    @Autowired
    private TimetableRepository timetableRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private TimeSlotRepository timeSlotRepository;

    public List<TimetableEntry> getAllEntries() {
        return timetableRepository.findAll();
    }

    public List<TimetableEntry> getByClassName(String className) {
        return timetableRepository.findByClassName(className);
    }

    public List<TimetableEntry> getByTeacher(Long teacherId) {
        return timetableRepository.findByTeacherId(teacherId);
    }

    public void clearTimetable() {
        timetableRepository.deleteAll();
    }

    public String substituteTeacher(Long absentTeacherId, Long substituteTeacherId) {
        if (absentTeacherId.equals(substituteTeacherId)) {
            return "Absent teacher and substitute teacher cannot be the same.";
        }
        
        Teacher absentTeacher = teacherRepository.findById(absentTeacherId).orElse(null);
        Teacher substituteTeacher = teacherRepository.findById(substituteTeacherId).orElse(null);
        
        if (absentTeacher == null || substituteTeacher == null) {
            return "Invalid teacher selection.";
        }

        List<TimetableEntry> allEntries = timetableRepository.findAll();
        int substitutionCount = 0;

        for (TimetableEntry entry : allEntries) {
            if (entry.getTeacher() != null && entry.getTeacher().getId().equals(absentTeacherId)) {
                // Check if substitute teacher is already busy at this time slot
                boolean isSubstituteBusy = allEntries.stream().anyMatch(e -> 
                    e.getTeacher() != null && 
                    e.getTeacher().getId().equals(substituteTeacherId) && 
                    e.getTimeSlot() != null && 
                    e.getTimeSlot().getId().equals(entry.getTimeSlot().getId())
                );
                
                if (!isSubstituteBusy) {
                    entry.setTeacher(substituteTeacher);
                    timetableRepository.save(entry);
                    substitutionCount++;
                }
            }
        }
        return "Substituted " + absentTeacher.getName() + " with " + substituteTeacher.getName() + " for " + substitutionCount + " periods.";
    }

    // =========================================================
    // MULTI-STRATEGY REACTIVE REPAIR ALGORITHM
    // Flow: Event → Identify Conflicts → For each conflict:
    // 1. Try Reassign Slot
    // 2. Try Swap (with non-conflicting entry of same class)
    // 3. Try Substitute Teacher (same dept, free in that slot)
    // 4. Try Room Change (same type, free in that slot)
    // 5. Backtracking + Cost Computation → Apply Best Solution
    // =========================================================

    public String repairAffectedSlots() {
        // --- [Event Occurs] → [Identify Conflicts] ---
        List<TimetableEntry> allEntries = timetableRepository.findAll();
        List<Teacher> allTeachers = teacherRepository.findAll();
        List<Room> allRooms = roomRepository.findAll();
        List<TimeSlot> allSlots = timeSlotRepository.findAllByOrderByDayOfWeekAscOrderIndexAsc();

        List<Teacher> availableTeachers = allTeachers.stream().filter(Teacher::isAvailable).toList();
        List<Room> availableRooms = allRooms.stream().filter(Room::isAvailable).toList();

        List<TimetableEntry> conflicts = allEntries.stream()
                .filter(e -> (e.getTeacher() != null && !e.getTeacher().isAvailable())
                        || (e.getRoom() != null && !e.getRoom().isAvailable()))
                .toList();

        int reassigned = 0;
        int swapped = 0;
        int substituted = 0;
        int roomChanged = 0;
        int backtracked = 0;
        int unresolved = 0;

        // --- [For each conflict] ---
        for (TimetableEntry conflict : conflicts) {
            boolean resolved = false;

            // --- Strategy 1: Try Reassign Slot ---
            // Move the class to a completely free slot where no constraint is violated.
            if (!resolved) {
                for (TimeSlot freeSlot : allSlots) {
                    if (freeSlot.getId().equals(conflict.getTimeSlot() != null ? conflict.getTimeSlot().getId() : -1))
                        continue;
                    if (isClassBusy(conflict.getClassName(), freeSlot, 1))
                        continue;
                    if (conflict.getTeacher() != null && conflict.getTeacher().isAvailable()
                            && !existsByTeacherAndSlot(conflict.getTeacher(), freeSlot)
                            && conflict.getRoom() != null && conflict.getRoom().isAvailable()
                            && !existsByRoomAndSlot(conflict.getRoom(), freeSlot)) {
                        conflict.setTimeSlot(freeSlot);
                        timetableRepository.save(conflict);
                        reassigned++;
                        resolved = true;
                        break;
                    }
                }
            }

            // --- Strategy 2: Try Swap ---
            // Find another entry in the same class that can swap time slots with this one.
            if (!resolved) {
                List<TimetableEntry> classmates = allEntries.stream()
                        .filter(e -> e.getClassName().equals(conflict.getClassName()))
                        .filter(e -> !e.getId().equals(conflict.getId()))
                        .filter(e -> e.getTeacher() != null && e.getTeacher().isAvailable()
                                && e.getRoom() != null && e.getRoom().isAvailable())
                        .toList();

                for (TimetableEntry candidate : classmates) {
                    TimeSlot slotA = conflict.getTimeSlot();
                    TimeSlot slotB = candidate.getTimeSlot();
                    if (slotA == null || slotB == null)
                        continue;

                    // Check if conflict's teacher/room can go to slotB (after removing conflict
                    // from slotA)
                    boolean canSwap = !existsByTeacherAndSlot(
                            conflict.getTeacher() != null ? conflict.getTeacher() : candidate.getTeacher(), slotB)
                            && !existsByRoomAndSlot(
                                    conflict.getRoom() != null ? conflict.getRoom() : candidate.getRoom(), slotB);

                    if (canSwap) {
                        conflict.setTimeSlot(slotB);
                        candidate.setTimeSlot(slotA);
                        timetableRepository.save(conflict);
                        timetableRepository.save(candidate);
                        swapped++;
                        resolved = true;
                        break;
                    }
                }
            }

            // --- Strategy 3: Try Substitute Teacher ---
            // Keep slot & room, swap only the teacher with a free colleague in same dept.
            if (!resolved && conflict.getTeacher() != null && !conflict.getTeacher().isAvailable()) {
                String dept = conflict.getTeacher().getDepartment();
                Teacher substitute = availableTeachers.stream()
                        .filter(t -> dept != null && dept.equals(t.getDepartment()))
                        .filter(t -> !existsByTeacherAndSlot(t, conflict.getTimeSlot()))
                        .min(java.util.Comparator
                                .comparingLong(t -> timetableRepository.findByTeacherId(t.getId()).size())) // Prefer
                                                                                                            // least
                                                                                                            // loaded
                        .orElse(null);

                if (substitute != null) {
                    conflict.setTeacher(substitute);
                    timetableRepository.save(conflict);
                    substituted++;
                    resolved = true;
                }
            }

            // --- Strategy 4: Try Room Change ---
            // Keep slot & teacher, swap only the room with a free one of same type.
            if (!resolved && conflict.getRoom() != null && !conflict.getRoom().isAvailable()) {
                String roomType = conflict.getRoom().getType();
                Room substituteRoom = availableRooms.stream()
                        .filter(r -> roomType != null && roomType.equals(r.getType()))
                        .filter(r -> !existsByRoomAndSlot(r, conflict.getTimeSlot()))
                        .max(java.util.Comparator.comparingInt(Room::getCapacity)) // Prefer largest room
                        .orElse(null);

                if (substituteRoom != null) {
                    conflict.setRoom(substituteRoom);
                    timetableRepository.save(conflict);
                    roomChanged++;
                    resolved = true;
                }
            }

            // --- Strategy 5: Backtracking + Cost Computation → Apply Best Solution ---
            // If all strategies fail, compute cost of each fallback option and pick the
            // minimum.
            if (!resolved) {
                // Cost = disruption score: higher is worse
                // 10 = full class lost | 5 = wrong dept teacher | 3 = wrong type room
                int bestCost = 10;

                Teacher anyTeacher = null;
                if (conflict.getTeacher() != null && !conflict.getTeacher().isAvailable()) {
                    anyTeacher = availableTeachers.stream()
                            .filter(t -> !existsByTeacherAndSlot(t, conflict.getTimeSlot()))
                            .findFirst().orElse(null);
                    if (anyTeacher != null)
                        bestCost = 5;
                }

                Room anyRoom = null;
                if (conflict.getRoom() != null && !conflict.getRoom().isAvailable()) {
                    anyRoom = availableRooms.stream()
                            .filter(r -> !existsByRoomAndSlot(r, conflict.getTimeSlot()))
                            .findFirst().orElse(null);
                    if (anyRoom != null && 3 < bestCost)
                        bestCost = 3;
                }

                // --- [Apply Best Solution] ---
                if (bestCost == 3 && anyRoom != null) {
                    conflict.setRoom(anyRoom);
                    timetableRepository.save(conflict);
                    backtracked++;
                    resolved = true;
                } else if (bestCost == 5 && anyTeacher != null) {
                    conflict.setTeacher(anyTeacher);
                    timetableRepository.save(conflict);
                    backtracked++;
                    resolved = true;
                } else {
                    // Last resort: remove entry (least disruptive option available)
                    timetableRepository.delete(conflict);
                    unresolved++;
                }
            }
        }

        return String.format(
                "Repair complete: %d reassigned | %d swapped | %d substituted | %d room-changed | %d backtracked | %d unresolved.",
                reassigned, swapped, substituted, roomChanged, backtracked, unresolved);
    }

    private boolean existsByTeacherAndSlot(Teacher teacher, TimeSlot slot) {
        if (slot == null || teacher == null)
            return false;
        return timetableRepository.existsByTeacher_IdAndTimeSlot_Id(teacher.getId(), slot.getId());
    }

    private boolean existsByRoomAndSlot(Room room, TimeSlot slot) {
        if (slot == null || room == null)
            return false;
        return timetableRepository.existsByRoom_IdAndTimeSlot_Id(room.getId(), slot.getId());
    }

    /**
     * AUTO-SEED: Create the standard 8-period academic day (9:00 - 17:15)
     * for Monday through Friday if time slots don't already exist.
     *
     * Schedule layout:
     * P1: 09:00-09:55 | P2: 10:00-10:55
     * Break: 10:55-11:10
     * P3: 11:10-12:05 | P4: 12:05-13:00
     * Lunch: 13:00-13:55
     * P5: 13:55-14:50 | P6: 14:55-15:50
     * Break: 15:50-16:05
     * P7: 16:05-17:00 | P8: 17:00-17:15 (short wrap-up / only if needed)
     */
    public String autoSeedTimeslots() {
        if (timeSlotRepository.count() > 0) {
            return "Time slots already exist. Clear them first to re-seed.";
        }
        String[][] periods = {
                { "09:00", "09:55" }, { "10:00", "10:55" },
                { "11:10", "12:05" }, { "12:10", "13:00" },
                { "13:55", "14:50" }, { "14:55", "15:50" },
                { "16:05", "17:00" }, { "17:00", "17:15" }
        };
        String[] days = { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday" };
        int count = 0;
        for (String day : days) {
            for (int i = 0; i < periods.length; i++) {
                TimeSlot slot = new TimeSlot();
                slot.setDayOfWeek(day);
                slot.setStartTime(periods[i][0]);
                slot.setEndTime(periods[i][1]);
                slot.setOrderIndex(i + 1);
                timeSlotRepository.save(slot);
                count++;
            }
        }
        return "Auto-seeded " + count + " time slots (8 periods/day × 5 days).";
    }

    /**
     * Generate a one-week timetable for a single class.
     * Each teacher's subject is allocated exactly 'credits' periods in the week.
     * Theory → credits periods (spread across different days)
     * Lab → 4 periods (first 2 back-to-back, then 2 single)
     * Integrated → 4 theory + 2 continuous lab = 6 periods
     */
    public String generateTimetable(String className, int studentCount) {
        // Auto-seed slots if none exist
        if (timeSlotRepository.count() == 0) {
            autoSeedTimeslots();
        }

        // Clear only this class's entries (keeps other classes intact)
        timetableRepository.findByClassName(className)
                .forEach(timetableRepository::delete);

        List<Teacher> teachers = teacherRepository.findAll()
                .stream().filter(Teacher::isAvailable).toList();
        List<Room> allRooms = roomRepository.findAll()
                .stream().filter(Room::isAvailable).toList();
        List<TimeSlot> timeSlots = timeSlotRepository.findAllByOrderByDayOfWeekAscOrderIndexAsc();

        int maxRoomCap = allRooms.stream().mapToInt(Room::getCapacity).max().orElse(0);
        int sectionsRequired = 1;
        if (studentCount > maxRoomCap && maxRoomCap > 0) {
            sectionsRequired = (int) Math.ceil((double) studentCount / maxRoomCap);
        }
        int requiredCapacity = studentCount / sectionsRequired;

        List<Room> rooms = allRooms.stream()
                .filter(r -> r.getCapacity() >= requiredCapacity).toList();

        if (teachers.isEmpty())
            return "No available teachers found. Add teachers with subjects.";
        if (rooms.isEmpty())
            return "No available rooms found for capacity " + requiredCapacity + ".";
        if (timeSlots.isEmpty())
            return "No time slots found. Use 'Seed 8-Period Day' on the Time Slots page.";

        int generatedCount = 0;

        for (Teacher teacher : teachers) {
            Subject subject = teacher.getHandledSubject();
            if (subject == null)
                continue;

            int theoryPeriods = 0;
            int labPeriods = 0;
            boolean needsDoubleLab = false;

            String type = subject.getType() != null ? subject.getType() : "Theory";
            int totalPeriods = subject.getPeriodsPerWeek();
            if (totalPeriods <= 0) totalPeriods = 1; // Fallback just in case

            if (type.equalsIgnoreCase("Integrated")) {
                labPeriods = Math.min(2, totalPeriods);
                theoryPeriods = totalPeriods - labPeriods;
            } else if (type.equalsIgnoreCase("Lab")) {
                labPeriods = totalPeriods;
            } else {
                theoryPeriods = totalPeriods;
            }

            int doubleBlocks = labPeriods / 2;
            int remainingLabSingles = labPeriods % 2;

            for (int i = 0; i < doubleBlocks; i++) {
                if (scheduleContinuous(className, teacher, subject, rooms, timeSlots, true, sectionsRequired)) {
                    generatedCount += 2;
                }
            }

            for (int i = 0; i < remainingLabSingles; i++) {
                if (scheduleSingle(className, teacher, subject, rooms, timeSlots, true, sectionsRequired)) {
                    generatedCount++;
                }
            }

            // Schedule theory periods
            for (int i = 0; i < theoryPeriods; i++) {
                if (scheduleSingle(className, teacher, subject, rooms, timeSlots, false, sectionsRequired)) {
                    generatedCount++;
                }
            }
        }
        return "Timetable generated for class '" + className + "'. Total periods assigned: " + generatedCount;
    }

    private boolean scheduleSingle(String className, Teacher teacher, Subject subject, List<Room> rooms,
            List<TimeSlot> timeSlots, boolean isLabPeriod, int sectionsRequired) {
        
        List<TimetableEntry> currentEntries = timetableRepository.findByClassName(className);
        
        // Shuffle timeSlots to randomly distribute the subjects across the week
        List<TimeSlot> shuffledSlots = new java.util.ArrayList<>(timeSlots);
        java.util.Collections.shuffle(shuffledSlots);
        
        // Pass 1: Try to find a day where this subject is NOT already scheduled
        for (TimeSlot slot : shuffledSlots) {
            boolean subjectAlreadyOnThisDay = currentEntries.stream()
                .anyMatch(e -> e.getSubject() != null && e.getSubject().getId().equals(subject.getId()) 
                               && e.getTimeSlot() != null 
                               && e.getTimeSlot().getDayOfWeek().equals(slot.getDayOfWeek()));
                               
            if (subjectAlreadyOnThisDay) continue;

            if (isClassBusy(className, slot, sectionsRequired)) continue;

            if (isLabPeriod) {
                long labsOnDay = currentEntries.stream()
                    .filter(e -> e.getTimeSlot() != null && e.getTimeSlot().getDayOfWeek().equals(slot.getDayOfWeek()))
                    .filter(e -> e.getRoom() != null && "Lab".equalsIgnoreCase(e.getRoom().getType()))
                    .count();
                if (labsOnDay >= 4 * sectionsRequired) continue; // Enforce max 4 lab periods per day
            }

            for (Room room : rooms) {
                if (isLabPeriod && (room.getType() == null || !room.getType().equalsIgnoreCase("Lab"))) continue;
                if (!isLabPeriod && room.getType() != null && room.getType().equalsIgnoreCase("Lab")) continue;

                if (!isConflict(teacher, room, slot)) {
                    saveEntry(className, teacher, subject, room, slot);
                    return true;
                }
            }
        }
        
        // Pass 2: Fallback (allow multiple periods on the same day if we couldn't spread it)
        for (TimeSlot slot : shuffledSlots) {
            if (isClassBusy(className, slot, sectionsRequired)) continue;

            if (isLabPeriod) {
                long labsOnDay = currentEntries.stream()
                    .filter(e -> e.getTimeSlot() != null && e.getTimeSlot().getDayOfWeek().equals(slot.getDayOfWeek()))
                    .filter(e -> e.getRoom() != null && "Lab".equalsIgnoreCase(e.getRoom().getType()))
                    .count();
                if (labsOnDay >= 6 * sectionsRequired) continue; // Max 6 labs as absolute fallback
            }

            for (Room room : rooms) {
                if (isLabPeriod && (room.getType() == null || !room.getType().equalsIgnoreCase("Lab"))) continue;
                if (!isLabPeriod && room.getType() != null && room.getType().equalsIgnoreCase("Lab")) continue;

                if (!isConflict(teacher, room, slot)) {
                    saveEntry(className, teacher, subject, room, slot);
                    return true;
                }
            }
        }
        return false;
    }

    private boolean scheduleContinuous(String className, Teacher teacher, Subject subject, List<Room> rooms,
            List<TimeSlot> timeSlots, boolean isLabPeriod, int sectionsRequired) {
        
        // 3 Passes to enforce strict constraints, then loosen them if necessary.
        for (int pass = 1; pass <= 3; pass++) {
            List<TimetableEntry> currentEntries = timetableRepository.findByClassName(className);
            
            for (int i = 0; i < timeSlots.size() - 1; i++) {
                TimeSlot s1 = timeSlots.get(i);
                TimeSlot s2 = timeSlots.get(i + 1);

                if (s1.getDayOfWeek().equals(s2.getDayOfWeek()) &&
                        s2.getOrderIndex() == s1.getOrderIndex() + 1 &&
                        !isClassBusy(className, s1, sectionsRequired) && !isClassBusy(className, s2, sectionsRequired)) {
                    
                    boolean subjectAlreadyOnThisDay = currentEntries.stream()
                        .anyMatch(e -> e.getSubject() != null && e.getSubject().getId().equals(subject.getId()) 
                                       && e.getTimeSlot() != null 
                                       && e.getTimeSlot().getDayOfWeek().equals(s1.getDayOfWeek()));
                    
                    if (pass == 1 && subjectAlreadyOnThisDay) continue; // Spread subjects

                    if (isLabPeriod) {
                        long labsOnDay = currentEntries.stream()
                            .filter(e -> e.getTimeSlot() != null && e.getTimeSlot().getDayOfWeek().equals(s1.getDayOfWeek()))
                            .filter(e -> e.getRoom() != null && "Lab".equalsIgnoreCase(e.getRoom().getType()))
                            .count();
                        
                        if (pass <= 2 && labsOnDay >= 4 * sectionsRequired) continue;
                        if (pass == 3 && labsOnDay >= 6 * sectionsRequired) continue;

                        // *** KEY FIX: Only allow valid break-aligned pairs ***
                        // Valid pairs: (P1,P2), (P3,P4), (P5,P6), (P7,P8)
                        // i.e., first slot of the pair must have ODD orderIndex (1,3,5,7)
                        int startPeriod = s1.getOrderIndex();
                        if (startPeriod % 2 == 0) continue; // Skip pairs like (2,3), (4,5), (6,7)

                        // Prevent adjacent labs logic
                        if (pass <= 2) {
                            TimeSlot s0 = (i > 0) ? timeSlots.get(i - 1) : null;
                            TimeSlot s3 = (i < timeSlots.size() - 2) ? timeSlots.get(i + 2) : null;
                            
                            boolean adjacentLab = false;
                            if (s0 != null && s0.getDayOfWeek().equals(s1.getDayOfWeek())) {
                                adjacentLab |= currentEntries.stream().anyMatch(e -> e.getTimeSlot() != null && e.getTimeSlot().getId().equals(s0.getId()) && e.getRoom() != null && "Lab".equalsIgnoreCase(e.getRoom().getType()));
                            }
                            if (s3 != null && s3.getDayOfWeek().equals(s1.getDayOfWeek())) {
                                adjacentLab |= currentEntries.stream().anyMatch(e -> e.getTimeSlot() != null && e.getTimeSlot().getId().equals(s3.getId()) && e.getRoom() != null && "Lab".equalsIgnoreCase(e.getRoom().getType()));
                            }
                            if (adjacentLab) continue; // Try to separate labs with theory periods
                        }
                    }

                    for (Room room : rooms) {
                        if (isLabPeriod && (room.getType() == null || !room.getType().equalsIgnoreCase("Lab"))) continue;
                        if (!isLabPeriod && room.getType() != null && room.getType().equalsIgnoreCase("Lab")) continue;

                        if (!isConflict(teacher, room, s1) && !isConflict(teacher, room, s2)) {
                            saveEntry(className, teacher, subject, room, s1);
                            saveEntry(className, teacher, subject, room, s2);
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    private boolean isClassBusy(String className, TimeSlot slot, int maxSections) {
        return timetableRepository.findByClassNameAndTimeSlot_Id(className, slot.getId()).size() >= maxSections;
    }

    private void saveEntry(String className, Teacher teacher, Subject subject, Room room, TimeSlot slot) {
        TimetableEntry entry = new TimetableEntry();
        entry.setClassName(className);
        entry.setTeacher(teacher);
        entry.setSubject(subject);
        entry.setRoom(room);
        entry.setTimeSlot(slot);
        timetableRepository.save(entry);
    }

    private boolean isConflict(Teacher teacher, Room room, TimeSlot slot) {
        if (timetableRepository.existsByTeacher_IdAndTimeSlot_Id(teacher.getId(), slot.getId())) {
            return true;
        }
        if (timetableRepository.existsByRoom_IdAndTimeSlot_Id(room.getId(), slot.getId())) {
            return true;
        }
        return false;
    }

    // =========================================================
    // MANUAL EDIT API: Validate and Update a single timetable entry
    // =========================================================

    @Autowired
    private SubjectRepository subjectRepository;

    /**
     * Validates and applies a manual edit to a timetable cell.
     * Returns null on success, or an error message string describing the conflict.
     */
    public String validateAndUpdateEntry(Long entryId, Long subjectId, Long teacherId, Long roomId, Long timeSlotId, String customLabel) {
        TimetableEntry entry = timetableRepository.findById(entryId).orElse(null);
        if (entry == null) return "Entry not found.";

        Teacher newTeacher = (teacherId != null) ? teacherRepository.findById(teacherId).orElse(entry.getTeacher()) : entry.getTeacher();
        Room newRoom = (roomId != null) ? roomRepository.findById(roomId).orElse(entry.getRoom()) : entry.getRoom();
        com.example.timetablescheduler.model.TimeSlot newSlot = (timeSlotId != null) ? timeSlotRepository.findById(timeSlotId).orElse(entry.getTimeSlot()) : entry.getTimeSlot();
        com.example.timetablescheduler.model.Subject newSubject = (subjectId != null) ? subjectRepository.findById(subjectId).orElse(entry.getSubject()) : entry.getSubject();

        // If a custom label is provided (e.g., NPTEL, LeetCode), skip subject checks
        if (customLabel != null && !customLabel.isBlank()) {
            entry.setSubject(null);
            entry.setTeacher(newTeacher);
            entry.setRoom(newRoom);
            entry.setTimeSlot(newSlot);
            entry.setCustomLabel(customLabel);
            timetableRepository.save(entry);
            return null;
        }

        // Conflict Check 1: Teacher double-booked at same slot (excluding this entry)
        if (newTeacher != null && newSlot != null) {
            boolean teacherBusy = timetableRepository.findAll().stream()
                .filter(e -> !e.getId().equals(entryId))
                .anyMatch(e -> e.getTeacher() != null && e.getTeacher().getId().equals(newTeacher.getId())
                           && e.getTimeSlot() != null && e.getTimeSlot().getId().equals(newSlot.getId()));
            if (teacherBusy) return "Conflict: Teacher '" + newTeacher.getName() + "' is already assigned to another class in this slot.";
        }

        // Conflict Check 2: Room double-booked at same slot (excluding this entry)
        if (newRoom != null && newSlot != null) {
            boolean roomBusy = timetableRepository.findAll().stream()
                .filter(e -> !e.getId().equals(entryId))
                .anyMatch(e -> e.getRoom() != null && e.getRoom().getId().equals(newRoom.getId())
                           && e.getTimeSlot() != null && e.getTimeSlot().getId().equals(newSlot.getId()));
            if (roomBusy) return "Conflict: Room '" + newRoom.getRoomNumber() + "' is already booked in this slot.";
        }

        // Conflict Check 3: Class already has another subject in the same slot
        if (newSlot != null) {
            boolean classBusy = timetableRepository.findByClassNameAndTimeSlot_Id(entry.getClassName(), newSlot.getId()).stream()
                .anyMatch(e -> !e.getId().equals(entryId));
            if (classBusy) return "Conflict: Class '" + entry.getClassName() + "' already has a period in this slot.";
        }

        // Conflict Check 4: Subject period count - warn if over-allocated
        if (newSubject != null) {
            long existingCount = timetableRepository.findByClassName(entry.getClassName()).stream()
                .filter(e -> !e.getId().equals(entryId))
                .filter(e -> e.getSubject() != null && e.getSubject().getId().equals(newSubject.getId()))
                .count();
            int required = newSubject.getPeriodsPerWeek();
            if (required > 0 && existingCount >= required) {
                return "Warning: '" + newSubject.getName() + "' already has " + existingCount + "/" + required + " periods allocated. Adding more will exceed the weekly quota.";
            }
        }

        // All checks passed — apply changes
        entry.setSubject(newSubject);
        entry.setTeacher(newTeacher);
        entry.setRoom(newRoom);
        entry.setTimeSlot(newSlot);
        entry.setCustomLabel(null);
        timetableRepository.save(entry);
        return null;
    }

    /**
     * Add a brand-new custom entry (e.g., NPTEL, Free Study) to a currently Free Period.
     */
    public String addCustomEntry(String className, Long timeSlotId, String customLabel, Long teacherId, Long roomId) {
        com.example.timetablescheduler.model.TimeSlot slot = timeSlotRepository.findById(timeSlotId).orElse(null);
        if (slot == null) return "Invalid time slot.";

        // Check not already occupied
        boolean slotTaken = !timetableRepository.findByClassNameAndTimeSlot_Id(className, timeSlotId).isEmpty();
        if (slotTaken) return "This slot is already occupied. Edit the existing entry instead.";

        TimetableEntry entry = new TimetableEntry();
        entry.setClassName(className);
        entry.setTimeSlot(slot);
        entry.setCustomLabel(customLabel);
        if (teacherId != null) entry.setTeacher(teacherRepository.findById(teacherId).orElse(null));
        if (roomId != null) entry.setRoom(roomRepository.findById(roomId).orElse(null));
        timetableRepository.save(entry);
        return null;
    }

    /**
     * Delete a single timetable entry (clear a period).
     */
    public void deleteEntry(Long entryId) {
        timetableRepository.deleteById(entryId);
    }
}
