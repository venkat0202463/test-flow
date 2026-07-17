package com.flowtrack.controller;

import com.flowtrack.model.Notification;
import com.flowtrack.model.User;
import com.flowtrack.repository.NotificationRepository;
import com.flowtrack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        
        if (userOpt.isPresent()) {
            long count = notificationRepository.countByUserIdAndIsReadFalse(userOpt.get().getEmpId());
            return ResponseEntity.ok(Map.of("count", count));
        }
        return ResponseEntity.status(404).body(Map.of("message", "User not found"));
    }

    @GetMapping
    public ResponseEntity<?> getMyNotifications() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        
        if (userOpt.isPresent()) {
            List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userOpt.get().getEmpId());
            return ResponseEntity.ok(notifications);
        }
        return ResponseEntity.status(404).body(Map.of("message", "User not found"));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long id) {
        Optional<Notification> notificationOpt = notificationRepository.findById(id);
        if (notificationOpt.isPresent()) {
            Notification notification = notificationOpt.get();
            notification.setRead(true);
            notificationRepository.save(notification);
            return ResponseEntity.ok(Map.of("message", "Marked as read"));
        }
        return ResponseEntity.status(404).body(Map.of("message", "Notification not found"));
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<?> markAllAsRead() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        
        if (userOpt.isPresent()) {
            List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userOpt.get().getEmpId());
            for (Notification n : notifications) {
                n.setRead(true);
            }
            notificationRepository.saveAll(notifications);
            return ResponseEntity.ok(Map.of("message", "All marked as read"));
        }
        return ResponseEntity.status(404).body(Map.of("message", "User not found"));
    }

    @DeleteMapping("/clear-all")
    public ResponseEntity<?> clearAll() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        
        if (userOpt.isPresent()) {
            notificationRepository.deleteByUserId(userOpt.get().getEmpId());
            return ResponseEntity.ok(Map.of("message", "All notifications cleared"));
        }
        return ResponseEntity.status(404).body(Map.of("message", "User not found"));
    }
}
