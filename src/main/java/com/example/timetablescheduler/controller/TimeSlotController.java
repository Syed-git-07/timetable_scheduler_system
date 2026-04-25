package com.example.timetablescheduler.controller;

import com.example.timetablescheduler.model.TimeSlot;
import com.example.timetablescheduler.repository.TimeSlotRepository;
import com.example.timetablescheduler.service.TimetableService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping("/timeslots")
public class TimeSlotController {

    @Autowired
    private TimeSlotRepository timeSlotRepository;

    @Autowired
    private TimetableService timetableService;

    @GetMapping
    public String listTimeSlots(Model model) {
        model.addAttribute("timeslots", timeSlotRepository.findAll());
        model.addAttribute("timeslot", new TimeSlot());
        return "timeslots";
    }

    @PostMapping("/add")
    public String addTimeSlot(@ModelAttribute TimeSlot timeslot) {
        timeSlotRepository.save(timeslot);
        return "redirect:/timeslots";
    }

    @GetMapping("/delete/{id}")
    public String deleteTimeSlot(@PathVariable Long id) {
        timeSlotRepository.deleteById(id);
        return "redirect:/timeslots";
    }

    @GetMapping("/seed")
    public String seed() {
        timetableService.autoSeedTimeslots();
        return "redirect:/timeslots";
    }

    @GetMapping("/clear")
    public String clearAll() {
        timeSlotRepository.deleteAll();
        return "redirect:/timeslots";
    }
}
