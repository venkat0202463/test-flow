package com.flowtrack.service;

import com.flowtrack.model.ActivityLog;
import com.flowtrack.model.User;
import com.flowtrack.repository.ActivityLogRepository;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import java.util.List;
import java.util.Optional;

@Service
public class ActivityLogService {

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    public void log(Long projectId, String userId, String actionType, String entityType, Long entityId, String entityName, String fromValue, String toValue, String message) {
        String finalUserName = "System";
        String resolvedUserId = userId;
        
        // Resolve User Name from context
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()) {
            String email = auth.getName();
            Optional<User> user = userRepository.findByEmailIgnoreCase(email);
            if (user.isPresent()) {
                finalUserName = user.get().getName();
                if (resolvedUserId == null) {
                    resolvedUserId = user.get().getEmpId();
                }
            } else {
                finalUserName = email;
            }
        } else if (resolvedUserId != null) {
            finalUserName = userRepository.findByEmpId(resolvedUserId).map(User::getName).orElse("System");
        }

        ActivityLog logToSave = new ActivityLog(projectId, resolvedUserId, finalUserName, actionType, entityType, entityId, entityName, fromValue, toValue, message);
        activityLogRepository.saveAndFlush(logToSave);
    }

    public List<ActivityLog> getRecentActivities() {
        List<ActivityLog> logs = activityLogRepository.findTop20ByOrderByCreatedAtDesc();
        resolveUserNames(logs);
        return logs;
    }

    public List<ActivityLog> getProjectActivities(Long projectId) {
        List<ActivityLog> logs = activityLogRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        resolveUserNames(logs);
        return logs;
    }

    private void resolveUserNames(List<ActivityLog> logs) {
        if (logs == null) return;
        java.util.Map<String, String> nameCache = new java.util.HashMap<>();
        logs.forEach(log -> {
            try {
                // Resolve Task Entity Names to [KEY-ID] if not already set
                if ("TASK".equals(log.getEntityType()) && log.getEntityId() != null) {
                    taskRepository.findById(log.getEntityId()).ifPresent(task -> {
                        String key = "TASK";
                        log.setEntityName(key + "-" + task.getId());
                    });
                }

                String currentName = log.getUserName();
                if (currentName != null && currentName.contains("@")) {
                    String emailKey = currentName.toLowerCase().trim();
                    if (!nameCache.containsKey(emailKey)) {
                        userRepository.findByEmailIgnoreCase(emailKey).ifPresent(u -> nameCache.put(emailKey, u.getName()));
                    }
                    if (nameCache.containsKey(emailKey)) {
                        log.setUserName(nameCache.get(emailKey));
                    }
                }
                
                if (log.getUserName() == null) log.setUserName("Someone");
                
                String by = log.getUserName();
                String entity = log.getEntityName() != null ? log.getEntityName() : "item";
                String type = (log.getActionType() != null ? log.getActionType() : "").toUpperCase();
                
                if (type.contains("MOVE") || (log.getFromValue() != null && log.getToValue() != null)) {
                    log.setActionType("MOVE");
                    log.setMessage(by + " moved " + entity + " from " + (log.getFromValue() != null ? log.getFromValue().toUpperCase() : "BACKLOG") + " to " + (log.getToValue() != null ? log.getToValue().toUpperCase() : "DONE"));
                } else if (type.contains("ASSIGN")) {
                    log.setActionType("ASSIGN");
                    log.setMessage(by + " assigned " + entity + " to " + (log.getToValue() != null ? log.getToValue() : "someone"));
                } else if (type.contains("PRIORITY")) {
                    log.setActionType("PRIORITY_CHANGE");
                    log.setMessage(by + " changed priority of " + entity + " to " + (log.getToValue() != null ? log.getToValue().toUpperCase() : "NORMAL"));
                } else if (type.contains("COMMENT")) {
                    log.setActionType("COMMENT");
                    log.setMessage(by + " added comment to " + entity);
                } else if (type.contains("CREATE")) {
                    log.setActionType("CREATE");
                    log.setMessage(by + " created " + (log.getEntityType() != null ? log.getEntityType().toLowerCase() : "item") + " " + entity);
                } else {
                    if (log.getMessage() == null) log.setMessage(by + " updated " + entity);
                }
            } catch (Exception e) {
                if (log.getMessage() == null) log.setMessage("System updated item");
            }
        });
    }
}