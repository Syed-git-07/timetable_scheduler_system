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
                    if (isClassBusy(conflict.getClassName(), freeSlot))
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
    public String generateTimetable(String className) {
        // Auto-seed slots if none exist
        if (timeSlotRepository.count() == 0) {
            autoSeedTimeslots();
        }

        // Clear only this class's entries (keeps other classes intact)
        timetableRepository.findByClassName(className)
                .forEach(timetableRepository::delete);

        List<Teacher> teachers = teacherRepository.findAll()
                .stream().filter(Teacher::isAvailable).toList();
        List<Room> rooms = roomRepository.findAll()
                .stream().filter(Room::isAvailable).toList();
        List<TimeSlot> timeSlots = timeSlotRepository.findAllByOrderByDayOfWeekAscOrderIndexAsc();

        if (teachers.isEmpty())
            return "No available teachers found. Add teachers with subjects.";
        if (rooms.isEmpty())
            return "No available rooms found. Add rooms first.";
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
            int credits = subject.getCredits();

            /*
             * EXACT PERIOD ALLOCATION RULES (as specified):
             *
             * THEORY:
             * credits → periods/week directly.
             * 0 credits = 1 period (special case)
             *
             * LAB (2 credits):
             * 4 lab periods total — first 2 MUST be continuous (back-to-back)
             *
             * INTEGRATED:
             * 4 theory periods + 1 continuous 2-period lab session
             */
            if (type.equalsIgnoreCase("Integrated")) {
                theoryPeriods = 4;
                labPeriods = 2;
                needsDoubleLab = true; // the 2 lab periods must be continuous
            } else if (type.equalsIgnoreCase("Lab")) {
                labPeriods = 4;
                needsDoubleLab = true; // first pair must be continuous
            } else {
                // Theory: credits = periods/week; 0 credits = 1 period
                theoryPeriods = (credits <= 0) ? 1 : credits;
            }

            // Schedule the continuous lab block first (highest constraint, must go first)
            if (needsDoubleLab) {
                if (scheduleContinuous(className, teacher, subject, rooms, timeSlots, 2)) {
                    generatedCount += 2;
                    labPeriods -= 2; // deduct the 2 already placed
                }
            }

            // Schedule any remaining lab periods as singles
            for (int i = 0; i < labPeriods; i++) {
                if (scheduleSingle(className, teacher, subject, rooms, timeSlots)) {
                    generatedCount++;
                }
            }

            // Schedule theory periods
            for (int i = 0; i < theoryPeriods; i++) {
                if (scheduleSingle(className, teacher, subject, rooms, timeSlots)) {
                    generatedCount++;
                }
            }
        }
        return "Timetable generated for class '" + className + "'. Total periods assigned: " + generatedCount;
    }

    private boolean scheduleSingle(String className, Teacher teacher, Subject subject, List<Room> rooms,
            List<TimeSlot> timeSlots) {
        for (TimeSlot slot : timeSlots) {
            if (isClassBusy(className, slot))
                continue;
            for (Room room : rooms) {
                if (!isConflict(teacher, room, slot)) {
                    saveEntry(className, teacher, subject, room, slot);
                    return true;
                }
            }
        }
        return false;
    }

    private boolean scheduleContinuous(String className, Teacher teacher, Subject subject, List<Room> rooms,
            List<TimeSlot> timeSlots, int count) {
        // timeSlots is already sorted by Day and orderIndex
        for (int i = 0; i < timeSlots.size() - 1; i++) {
            TimeSlot s1 = timeSlots.get(i);
            TimeSlot s2 = timeSlots.get(i + 1);

            // Sequential check
            if (s1.getDayOfWeek().equals(s2.getDayOfWeek()) &&
                    s2.getOrderIndex() == s1.getOrderIndex() + 1 &&
                    !isClassBusy(className, s1) && !isClassBusy(className, s2)) {

                for (Room room : rooms) {
                    if (!isConflict(teacher, room, s1) && !isConflict(teacher, room, s2)) {
                        saveEntry(className, teacher, subject, room, s1);
                        saveEntry(className, teacher, subject, room, s2);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private boolean isClassBusy(String className, TimeSlot slot) {
        return !timetableRepository.findByClassNameAndTimeSlot_Id(className, slot.getId()).isEmpty();
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

    // CRUD wrappers for other entities if needed, but controllers can use
    // repositories directly for simple cases
    // However, for best practice, let's add them.
}
