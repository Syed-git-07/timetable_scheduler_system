package com.example.timetablescheduler.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String uri = request.getRequestURI();
        
        // Allow public paths
        if (uri.startsWith("/login") || uri.startsWith("/forgot-password") || uri.startsWith("/css/") || 
            uri.startsWith("/js/") || uri.startsWith("/images/") || uri.equals("/")) {
            return true;
        }

        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            response.sendRedirect("/login");
            return false;
        }

        String role = (String) session.getAttribute("role");
        
        // Admin only paths
        if (uri.startsWith("/dashboard") || uri.startsWith("/teachers") || uri.startsWith("/rooms") || 
            uri.startsWith("/subjects") || uri.startsWith("/timeslots")) {
            if (!"ADMIN".equals(role)) {
                response.sendRedirect("/view"); // Students trying to access admin dashboard redirect to view
                return false;
            }
        }
        
        return true;
    }
}
