package com.example.timetablescheduler.controller;

import com.example.timetablescheduler.service.TimetableService;
import com.example.timetablescheduler.repository.TeacherRepository;
import com.example.timetablescheduler.repository.SubjectRepository;
import com.example.timetablescheduler.repository.RoomRepository;
import com.example.timetablescheduler.repository.TimeSlotRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Controller
public class DashboardController {

    @Autowired
    private TimetableService timetableService;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private TimeSlotRepository timeSlotRepository;

    @GetMapping("/dashboard")
    public String dashboard(Model model) {
        model.addAttribute("entries", timetableService.getAllEntries());
        model.addAttribute("teachers", teacherRepository.findAll());
        model.addAttribute("teacherCount", teacherRepository.count());
        model.addAttribute("subjectCount", subjectRepository.count());
        model.addAttribute("roomCount", roomRepository.count());
        model.addAttribute("slotCount", timeSlotRepository.count());
        model.addAttribute("entryCount", timetableService.getAllEntries().size());
        return "dashboard";
    }

    @GetMapping("/generate")
    public String generate(@RequestParam(required = false, defaultValue = "CS-101") String className, @RequestParam(required = false, defaultValue = "60") int studentCount) {
        String result = timetableService.generateTimetable(className, studentCount);
        return "redirect:/dashboard?msg=" + java.net.URLEncoder.encode(result, java.nio.charset.StandardCharsets.UTF_8);
    }

    @GetMapping("/clear")
    public String clear() {
        timetableService.clearTimetable();
        String result = "Timetable cleared successfully.";
        return "redirect:/dashboard?msg=" + java.net.URLEncoder.encode(result, java.nio.charset.StandardCharsets.UTF_8);
    }

    @PostMapping("/substitute")
    public String substituteTeacher(@RequestParam Long absentTeacherId, @RequestParam Long substituteTeacherId) {
        String result = timetableService.substituteTeacher(absentTeacherId, substituteTeacherId);
        return "redirect:/dashboard?msg=" + java.net.URLEncoder.encode(result, java.nio.charset.StandardCharsets.UTF_8);
    }

    @GetMapping("/view")
    public String viewDashboard(Model model) {
        model.addAttribute("teachers", teacherRepository.findAll());
        return "student-dashboard"; // Use a dedicated page for student
    }

    private void populateGridData(Model model, java.util.List<com.example.timetablescheduler.model.TimetableEntry> entries) {
        java.util.List<com.example.timetablescheduler.model.TimeSlot> allSlots = timeSlotRepository.findAllByOrderByDayOfWeekAscOrderIndexAsc();
        java.util.List<String> days = allSlots.stream().map(s -> s.getDayOfWeek()).distinct().toList();
        
        // Custom sort for days of week
        java.util.List<String> sortedDays = new java.util.ArrayList<>();
        String[] weekDays = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"};
        for (String day : weekDays) {
            if (days.contains(day)) sortedDays.add(day);
        }
        
        java.util.List<Integer> periodIndices = allSlots.stream().map(s -> s.getOrderIndex()).distinct().sorted().toList();
        
        java.util.Map<Integer, String> periodTimes = new java.util.HashMap<>();
        for (com.example.timetablescheduler.model.TimeSlot s : allSlots) {
            periodTimes.put(s.getOrderIndex(), s.getStartTime() + " - " + s.getEndTime());
        }
        
        // Build 2D grid map: Day -> (PeriodIndex -> List<Entry>)
        java.util.Map<String, java.util.Map<Integer, java.util.List<com.example.timetablescheduler.model.TimetableEntry>>> gridMap = new java.util.HashMap<>();
        for (String day : sortedDays.isEmpty() ? days : sortedDays) {
            gridMap.put(day, new java.util.HashMap<>());
        }
        
        for (com.example.timetablescheduler.model.TimetableEntry e : entries) {
            if (e.getTimeSlot() != null) {
                String day = e.getTimeSlot().getDayOfWeek();
                int pIndex = e.getTimeSlot().getOrderIndex();
                gridMap.computeIfAbsent(day, k -> new java.util.HashMap<>())
                       .computeIfAbsent(pIndex, k -> new java.util.ArrayList<>())
                       .add(e);
            }
        }
        
        model.addAttribute("days", sortedDays.isEmpty() ? days : sortedDays);
        model.addAttribute("periodIndices", periodIndices);
        model.addAttribute("periodTimes", periodTimes);
        model.addAttribute("gridMap", gridMap);
    }

    @GetMapping("/view/class")
    public String viewByClass(@RequestParam String className, Model model) {
        java.util.List<com.example.timetablescheduler.model.TimetableEntry> entries = timetableService.getByClassName(className);
        model.addAttribute("entries", entries);
        model.addAttribute("viewType", "Class: " + className);
        model.addAttribute("className", className);
        model.addAttribute("subjects", subjectRepository.findAll());
        model.addAttribute("teachers", teacherRepository.findAll());
        model.addAttribute("rooms", roomRepository.findAll());
        model.addAttribute("slots", timeSlotRepository.findAllByOrderByDayOfWeekAscOrderIndexAsc());
        populateGridData(model, entries);
        return "view";
    }

    @GetMapping("/view/teacher")
    public String viewByTeacher(@RequestParam Long teacherId, Model model) {
        java.util.List<com.example.timetablescheduler.model.TimetableEntry> entries = timetableService.getByTeacher(teacherId);
        model.addAttribute("entries", entries);
        model.addAttribute("viewType", "Teacher View");
        model.addAttribute("subjects", subjectRepository.findAll());
        model.addAttribute("teachers", teacherRepository.findAll());
        model.addAttribute("rooms", roomRepository.findAll());
        populateGridData(model, entries);
        return "view";
    }

    // ─────────────────────────────────────────────
    // REST API for in-place timetable cell editing
    // ─────────────────────────────────────────────

    /** Update an existing timetable cell (subject, teacher, room, or custom label). */
    @PostMapping("/api/timetable/update")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateEntry(@RequestBody Map<String, Object> body) {
        Long entryId   = Long.valueOf(body.get("entryId").toString());
        Long subjectId = body.get("subjectId") != null ? Long.valueOf(body.get("subjectId").toString()) : null;
        Long teacherId = body.get("teacherId") != null ? Long.valueOf(body.get("teacherId").toString()) : null;
        Long roomId    = body.get("roomId")    != null ? Long.valueOf(body.get("roomId").toString())    : null;
        Long slotId    = body.get("slotId")    != null ? Long.valueOf(body.get("slotId").toString())    : null;
        String custom  = body.get("customLabel") != null ? body.get("customLabel").toString() : null;

        String error = timetableService.validateAndUpdateEntry(entryId, subjectId, teacherId, roomId, slotId, custom);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", error));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Entry updated successfully."));
    }

    /** Add a custom entry (NPTEL, Free Study, etc.) to an empty timetable slot. */
    @PostMapping("/api/timetable/add-custom")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> addCustomEntry(@RequestBody Map<String, Object> body) {
        String className  = body.get("className").toString();
        Long   slotId     = Long.valueOf(body.get("slotId").toString());
        String label      = body.get("label").toString();
        Long   teacherId  = body.get("teacherId") != null ? Long.valueOf(body.get("teacherId").toString()) : null;
        Long   roomId     = body.get("roomId")    != null ? Long.valueOf(body.get("roomId").toString())    : null;

        String error = timetableService.addCustomEntry(className, slotId, label, teacherId, roomId);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", error));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Custom period added."));
    }

    /** Delete a single timetable entry (make it a Free Period). */
    @DeleteMapping("/api/timetable/delete/{id}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteEntry(@PathVariable Long id) {
        timetableService.deleteEntry(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Period cleared."));
    }
}
