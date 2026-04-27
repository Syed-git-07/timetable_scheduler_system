package com.example.timetablescheduler.controller;

import com.example.timetablescheduler.model.AppUser;
import com.example.timetablescheduler.repository.AppUserRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.Optional;
import java.util.UUID;

@Controller
public class AuthController {

    @Autowired
    private AppUserRepository appUserRepository;

    @GetMapping("/")
    public String index(HttpSession session) {
        String role = (String) session.getAttribute("role");
        if ("ADMIN".equals(role)) {
            return "redirect:/dashboard";
        } else if ("STUDENT".equals(role)) {
            return "redirect:/view";
        }
        return "redirect:/login";
    }

    @GetMapping("/login")
    public String loginPage(HttpSession session) {
        if (session.getAttribute("user") != null) {
            return "redirect:/";
        }
        return "login";
    }

    @PostMapping("/login")
    public String login(
            @RequestParam("username") String username,
            @RequestParam("password") String password,
            HttpSession session,
            RedirectAttributes redirectAttributes) {
        
        Optional<AppUser> userOpt = appUserRepository.findByUsername(username);
        
        if (userOpt.isPresent() && userOpt.get().getPassword().equals(password)) {
            AppUser user = userOpt.get();
            session.setAttribute("user", user.getUsername());
            session.setAttribute("role", user.getRole());
            
            if ("ADMIN".equals(user.getRole())) {
                return "redirect:/dashboard";
            } else {
                return "redirect:/view";
            }
        }
        
        redirectAttributes.addFlashAttribute("error", "Invalid username or password");
        return "redirect:/login";
    }

    @GetMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/login";
    }

    @GetMapping("/forgot-password")
    public String forgotPasswordPage() {
        return "forgot-password";
    }

    @PostMapping("/forgot-password")
    public String handleForgotPassword(@RequestParam("username") String username, RedirectAttributes redirectAttributes) {
        Optional<AppUser> userOpt = appUserRepository.findByUsername(username);
        if (userOpt.isPresent()) {
            // Mocking email sending
            String token = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
            // In a real application, you would send this token to the user's email and store it.
            // For now, we will just show it in the flash message so they can "verify" or use it to login.
            // Let's just reset the password to this token for simplicity in the demo.
            AppUser user = userOpt.get();
            user.setPassword(token);
            appUserRepository.save(user);
            
            redirectAttributes.addFlashAttribute("success", "Password reset successful! Your new temporary password is: " + token);
            return "redirect:/login";
        }
        redirectAttributes.addFlashAttribute("error", "Username not found.");
        return "redirect:/forgot-password";
    }
}
