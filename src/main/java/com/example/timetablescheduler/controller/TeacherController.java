package com.example.timetablescheduler.controller;

import com.example.timetablescheduler.model.Teacher;
import com.example.timetablescheduler.repository.TeacherRepository;
import com.example.timetablescheduler.repository.SubjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping("/teachers")
public class TeacherController {

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @GetMapping
    public String listTeachers(Model model) {
        model.addAttribute("teachers", teacherRepository.findAll());
        model.addAttribute("teacher", new Teacher());
        model.addAttribute("subjects", subjectRepository.findAll());
        return "teachers";
    }

    @PostMapping("/add")
    public String addTeacher(@ModelAttribute Teacher teacher,
            @RequestParam(name = "subjectId", required = false) String subjectId) {
        if (subjectId != null && !subjectId.trim().isEmpty()) {
            try {
                Long id = Long.parseLong(subjectId);
                subjectRepository.findById(id).ifPresent(teacher::setHandledSubject);
            } catch (NumberFormatException ignored) {
            }
        }
        teacherRepository.save(teacher);
        return "redirect:/teachers";
    }

    @PostMapping("/edit")
    public String editTeacher(@ModelAttribute Teacher teacher,
            @RequestParam(name = "subjectId", required = false) String subjectId) {
        if (subjectId != null && !subjectId.trim().isEmpty()) {
            try {
                Long id = Long.parseLong(subjectId);
                subjectRepository.findById(id).ifPresent(teacher::setHandledSubject);
            } catch (NumberFormatException ignored) {
            }
        }
        teacherRepository.save(teacher);
        return "redirect:/teachers";
    }

    @GetMapping("/toggle/{id}")
    public String toggleTeacher(@PathVariable Long id) {
        teacherRepository.findById(id).ifPresent(t -> {
            t.setAvailable(!t.isAvailable());
            teacherRepository.save(t);
        });
        return "redirect:/teachers";
    }

    @GetMapping("/delete/{id}")
    public String deleteTeacher(@PathVariable Long id) {
        teacherRepository.deleteById(id);
        return "redirect:/teachers";
    }
}
