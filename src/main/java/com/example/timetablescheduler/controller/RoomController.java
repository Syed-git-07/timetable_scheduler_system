package com.example.timetablescheduler.controller;

import com.example.timetablescheduler.model.Room;
import com.example.timetablescheduler.repository.RoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping("/rooms")
public class RoomController {

    @Autowired
    private RoomRepository roomRepository;

    @GetMapping
    public String listRooms(Model model) {
        model.addAttribute("rooms", roomRepository.findAll());
        model.addAttribute("room", new Room());
        return "rooms";
    }

    @PostMapping("/add")
    public String addRoom(@ModelAttribute Room room) {
        roomRepository.save(room);
        return "redirect:/rooms";
    }

    @GetMapping("/toggle/{id}")
    public String toggleRoom(@PathVariable Long id) {
        roomRepository.findById(id).ifPresent(r -> {
            r.setAvailable(!r.isAvailable());
            roomRepository.save(r);
        });
        return "redirect:/rooms";
    }

    @GetMapping("/delete/{id}")
    public String deleteRoom(@PathVariable Long id) {
        roomRepository.deleteById(id);
        return "redirect:/rooms";
    }
}
