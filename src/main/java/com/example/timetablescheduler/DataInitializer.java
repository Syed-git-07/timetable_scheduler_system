package com.example.timetablescheduler;

import com.example.timetablescheduler.model.AppUser;
import com.example.timetablescheduler.repository.AppUserRepository;
import com.example.timetablescheduler.util.PasswordUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        try {
            jdbcTemplate.execute("ALTER TABLE subject ADD COLUMN periods_per_week INTEGER DEFAULT 0");
        } catch (Exception e) {
            // Ignore if column already exists
        }

        // Migrate plain-text passwords to secure hashes (BCrypt / SHA-256)
        List<AppUser> allUsers = appUserRepository.findAll();
        for (AppUser u : allUsers) {
            if (u.getPassword() != null && u.getPassword().length() < 30) {
                u.setPassword(PasswordUtils.hashPassword(u.getPassword()));
                appUserRepository.save(u);
            }
        }

        if (appUserRepository.count() == 0) {
            AppUser admin = new AppUser();
            admin.setUsername("admin");
            admin.setPassword(PasswordUtils.hashPassword("admin123"));
            admin.setRole("ADMIN");
            admin.setEmail("admin@example.com");
            appUserRepository.save(admin);

            AppUser student = new AppUser();
            student.setUsername("student");
            student.setPassword(PasswordUtils.hashPassword("student123"));
            student.setRole("STUDENT");
            student.setEmail("student@example.com");
            appUserRepository.save(student);
        }
    }
}
