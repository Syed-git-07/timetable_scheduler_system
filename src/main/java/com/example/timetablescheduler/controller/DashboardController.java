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

    @GetMapping("/")
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
        return "redirect:/?msg=" + java.net.URLEncoder.encode(result, java.nio.charset.StandardCharsets.UTF_8);
    }

    @GetMapping("/clear")
    public String clear() {
        timetableService.clearTimetable();
        String result = "Timetable cleared successfully.";
        return "redirect:/?msg=" + java.net.URLEncoder.encode(result, java.nio.charset.StandardCharsets.UTF_8);
    }

    @GetMapping("/repair")
    public String repair() {
        String result = timetableService.repairAffectedSlots();
        return "redirect:/?msg=" + java.net.URLEncoder.encode(result, java.nio.charset.StandardCharsets.UTF_8);
    }

    @GetMapping("/view/class")
    public String viewByClass(@RequestParam String className, Model model) {
        model.addAttribute("entries", timetableService.getByClassName(className));
        model.addAttribute("viewType", "Class: " + className);
        return "view";
    }

    @GetMapping("/view/teacher")
    public String viewByTeacher(@RequestParam Long teacherId, Model model) {
        model.addAttribute("entries", timetableService.getByTeacher(teacherId));
        model.addAttribute("viewType", "Teacher View");
        return "view";
    }
}
