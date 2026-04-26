package com.example.timetablescheduler.controller;

import com.example.timetablescheduler.service.TimetableService;
import com.example.timetablescheduler.repository.TeacherRepository;
import com.example.timetablescheduler.repository.SubjectRepository;
import com.example.timetablescheduler.repository.RoomRepository;
import com.example.timetablescheduler.repository.TimeSlotRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

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
    public String generate(@RequestParam(required = false, defaultValue = "CS-101") String className) {
        String result = timetableService.generateTimetable(className);
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
        
        // Build 2D grid map: Day -> (PeriodIndex -> Entry)
        java.util.Map<String, java.util.Map<Integer, com.example.timetablescheduler.model.TimetableEntry>> gridMap = new java.util.HashMap<>();
        for (String day : sortedDays.isEmpty() ? days : sortedDays) {
            gridMap.put(day, new java.util.HashMap<>());
        }
        
        for (com.example.timetablescheduler.model.TimetableEntry e : entries) {
            if (e.getTimeSlot() != null) {
                String day = e.getTimeSlot().getDayOfWeek();
                int pIndex = e.getTimeSlot().getOrderIndex();
                gridMap.computeIfAbsent(day, k -> new java.util.HashMap<>()).put(pIndex, e);
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
        populateGridData(model, entries);
        return "view";
    }

    @GetMapping("/view/teacher")
    public String viewByTeacher(@RequestParam Long teacherId, Model model) {
        java.util.List<com.example.timetablescheduler.model.TimetableEntry> entries = timetableService.getByTeacher(teacherId);
        model.addAttribute("entries", entries);
        model.addAttribute("viewType", "Teacher View");
        populateGridData(model, entries);
        return "view";
    }
}
