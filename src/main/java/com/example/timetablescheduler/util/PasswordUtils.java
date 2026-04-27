package com.example.timetablescheduler.util;

import java.security.MessageDigest;
import java.util.Base64;

public class PasswordUtils {

    public static String hashPassword(String password) {
        if (password == null) return null;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(password.getBytes("UTF-8"));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception ex) {
            throw new RuntimeException("Error hashing password", ex);
        }
    }
}
