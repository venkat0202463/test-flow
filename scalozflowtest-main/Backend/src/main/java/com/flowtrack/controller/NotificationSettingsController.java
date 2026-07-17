package com.flowtrack.controller;

import com.flowtrack.model.EmailNotificationLog;
import com.flowtrack.model.GlobalNotificationSetting;
import com.flowtrack.model.User;
import com.flowtrack.model.UserNotificationPreference;
import com.flowtrack.repository.EmailNotificationLogRepository;
import com.flowtrack.repository.GlobalNotificationSettingRepository;
import com.flowtrack.repository.UserRepository;
import com.flowtrack.repository.UserNotificationPreferenceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationSettingsController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserNotificationPreferenceRepository userPreferenceRepository;

    @Autowired
    private GlobalNotificationSettingRepository globalSettingRepository;

    @Autowired
    private EmailNotificationLogRepository emailLogRepository;

    @Autowired
    private com.flowtrack.service.TaskEmailService taskEmailService;

    // Retrieve or initialize current user's email preferences
    @GetMapping("/preferences")
    public ResponseEntity<?> getUserPreferences() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not found");
        }
        User user = userOpt.get();
        UserNotificationPreference pref = userPreferenceRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    UserNotificationPreference newPref = new UserNotificationPreference(user.getId());
                    return userPreferenceRepository.save(newPref);
                });
        return ResponseEntity.ok(pref);
    }

    // Save user's email preferences
    @PostMapping("/preferences")
    public ResponseEntity<?> saveUserPreferences(@RequestBody UserNotificationPreference preferences) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not found");
        }
        User user = userOpt.get();
        UserNotificationPreference existing = userPreferenceRepository.findByUserId(user.getId())
                .orElse(new UserNotificationPreference(user.getId()));

        existing.setTaskCreated(preferences.isTaskCreated());
        existing.setTaskAssigned(preferences.isTaskAssigned());
        existing.setTaskReviewDecision(preferences.isTaskReviewDecision());
        existing.setTaskStatusChanged(preferences.isTaskStatusChanged());
        existing.setCommentAdded(preferences.isCommentAdded());
        existing.setUserMentioned(preferences.isUserMentioned());
        existing.setDueDateReminder(preferences.isDueDateReminder());
        existing.setTaskOverdue(preferences.isTaskOverdue());
        existing.setSprintStarted(preferences.isSprintStarted());
        existing.setSprintCompleted(preferences.isSprintCompleted());
        existing.setTaskCompleted(preferences.isTaskCompleted());
        existing.setTaskReopened(preferences.isTaskReopened());
        existing.setProjectInvitation(preferences.isProjectInvitation());
        existing.setRoleChanged(preferences.isRoleChanged());

        UserNotificationPreference saved = userPreferenceRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    // List all global switches, initializing defaults if database is empty
    @GetMapping("/global")
    public ResponseEntity<?> getGlobalSettings() {
        List<String> defaultKeys = Arrays.asList(
            "TASK_CREATED", "TASK_ASSIGNED", "TASK_REVIEW_DECISION", "TASK_STATUS_CHANGED",
            "COMMENT_ADDED", "USER_MENTIONED", "DUE_DATE_REMINDER", "TASK_OVERDUE",
            "SPRINT_STARTED", "SPRINT_COMPLETED", "TASK_COMPLETED", "TASK_REOPENED",
            "PROJECT_INVITATION", "ROLE_CHANGED"
        );

        List<GlobalNotificationSetting> currentSettings = globalSettingRepository.findAll();
        if (currentSettings.size() < defaultKeys.size()) {
            for (String key : defaultKeys) {
                if (globalSettingRepository.findBySettingKey(key).isEmpty()) {
                    globalSettingRepository.save(new GlobalNotificationSetting(key, true));
                }
            }
            currentSettings = globalSettingRepository.findAll();
        }
        
        // Sort alphabetically by settingKey for uniform layout in UI
        currentSettings.sort(Comparator.comparing(GlobalNotificationSetting::getSettingKey));
        return ResponseEntity.ok(currentSettings);
    }

    // Toggle global settings (Requires Admin / Manager roles)
    @PostMapping("/global")
    public ResponseEntity<?> saveGlobalSetting(@RequestBody GlobalNotificationSetting setting) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not found");
        }
        User user = userOpt.get();
        if (!"ADMIN".equalsIgnoreCase(user.getRole().name()) && !"MANAGER".equalsIgnoreCase(user.getRole().name())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only administrators and managers can toggle global notifications.");
        }

        GlobalNotificationSetting existing = globalSettingRepository.findBySettingKey(setting.getSettingKey())
                .orElse(new GlobalNotificationSetting(setting.getSettingKey(), true));
        existing.setEnabled(setting.isEnabled());
        GlobalNotificationSetting saved = globalSettingRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    // Get email logs (Requires Admin / Manager roles for transparency)
    @GetMapping("/logs")
    public ResponseEntity<?> getEmailLogs() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not found");
        }
        User user = userOpt.get();
        if (!"ADMIN".equalsIgnoreCase(user.getRole().name()) && !"MANAGER".equalsIgnoreCase(user.getRole().name())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only administrators and managers can view email logs.");
        }

        List<EmailNotificationLog> logs = emailLogRepository.findAll();
        // Sort newest first
        logs.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/logs/retry/{id}")
    public ResponseEntity<?> retryLog(@PathVariable Long id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not found");
        }
        User user = userOpt.get();
        if (!"ADMIN".equalsIgnoreCase(user.getRole().name()) && !"MANAGER".equalsIgnoreCase(user.getRole().name())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only administrators and managers can trigger retries.");
        }

        EmailNotificationLog log = emailLogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Log not found"));
        log.setRetryCount(0);
        log.setStatus("PENDING");
        EmailNotificationLog saved = emailLogRepository.save(log);

        // Instantly invoke async sending
        taskEmailService.sendEmailLogRecord(saved);

        return ResponseEntity.ok(Map.of("message", "Retry triggered successfully.", "log", saved));
    }
}
