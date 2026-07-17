package com.flowtrack.controller;

import com.flowtrack.model.ActivityLog;
import com.flowtrack.repository.ActivityLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/activities")
public class ActivityLogController {

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private com.flowtrack.repository.UserRepository userRepository;

    @GetMapping
    public List<ActivityLog> getGlobalActivities() {
        List<ActivityLog> logs = activityLogRepository.findTop20ByOrderByCreatedAtDesc();
        
        // Cache for user names to avoid redundant DB hits
        java.util.Map<String, String> nameCache = new java.util.HashMap<>();

        logs.forEach(log -> {
            String currentName = log.getUserName();
            
            // If it's an email, try to resolve it to a real name
            if (currentName != null && currentName.contains("@")) {
                if (!nameCache.containsKey(currentName)) {
                    userRepository.findByEmail(currentName).ifPresent(u -> nameCache.put(currentName, u.getName()));
                }
                if (nameCache.containsKey(currentName)) {
                    log.setUserName(nameCache.get(currentName));
                }
            }

            // Fallbacks for legacy/broken rows
            if (log.getUserName() == null) log.setUserName("Someone");
            if (log.getActionType() == null) log.setActionType("UPDATED");
            if (log.getEntityName() == null) log.setEntityName("Workspace");
        });
        return logs;
    }

    @GetMapping("/project/{projectId}")
    public List<ActivityLog> getProjectActivities(@PathVariable Long projectId) {
        return activityLogRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
    }
}
