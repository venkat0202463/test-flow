package com.flowtrack.controller;

import com.flowtrack.model.Task;
import com.flowtrack.model.User;
import com.flowtrack.model.WorkLog;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.UserRepository;
import com.flowtrack.repository.WorkLogRepository;
import com.flowtrack.service.ActivityLogService;
import com.flowtrack.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class WorkLogController {

    @Autowired
    private WorkLogRepository workLogRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private NotificationService notificationService;

    @GetMapping("/tasks/{taskId}/work-logs")
    public List<WorkLog> getWorkLogsByTask(@PathVariable Long taskId) {
        return workLogRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }

    @PostMapping("/tasks/{taskId}/work-logs")
    public ResponseEntity<?> addWorkLog(
            @PathVariable Long taskId,
            @RequestBody Map<String, Object> body,
            Principal principal) {
        
        String email = principal.getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        Task task = taskRepository.findById(taskId).orElseThrow();

        // Enforce permissions: Assignee, Project Members, Managers, Admins
        boolean isAdminOrManager = "ADMIN".equalsIgnoreCase(currentUser.getRole().name())
                || "MANAGER".equalsIgnoreCase(currentUser.getRole().name());
        boolean isAssignee = task.getAssignee() != null && task.getAssignee().getId().equals(currentUser.getId());
        boolean isCoAssignee = task.getCoAssignee() != null && task.getCoAssignee().getId().equals(currentUser.getId());
        
        boolean isMember = false;
        if (task.getProject() != null && task.getProject().getTeamMembers() != null) {
            isMember = task.getProject().getTeamMembers().stream()
                    .anyMatch(u -> u.getId().equals(currentUser.getId()));
        }

        if (!isAdminOrManager && !isAssignee && !isCoAssignee && !isMember) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "You do not have permission to log work on this task."));
        }

        String timeSpentStr = (String) body.get("timeSpent");
        if (timeSpentStr == null || timeSpentStr.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Time spent is required."));
        }

        long seconds = Task.parseTimeToSeconds(timeSpentStr);
        if (seconds <= 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid time spent format. Use 2d, 3h, 30m."));
        }

        String workDateStr = (String) body.get("workDate");
        LocalDate workDate = LocalDate.now();
        if (workDateStr != null && !workDateStr.isEmpty()) {
            try {
                workDate = LocalDate.parse(workDateStr);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("message", "Invalid work date format. Use YYYY-MM-DD."));
            }
        }

        String comment = (String) body.get("comment");

        WorkLog workLog = new WorkLog();
        workLog.setTask(task);
        workLog.setUser(currentUser);
        workLog.setTimeSpent(timeSpentStr);
        workLog.setTimeSpentSeconds(seconds);
        workLog.setWorkDate(workDate);
        workLog.setComment(comment);

        WorkLog saved = workLogRepository.save(workLog);

        // Recalculate Task Effort
        recalculateTaskTime(task);

        // Log to Activity Log
        activityLogService.log(
                task.getProject() != null ? task.getProject().getId() : null,
                null,
                "WORK_LOGGED",
                "TASK",
                task.getId(),
                "TASK-" + task.getId(),
                null,
                task.getStatus(),
                currentUser.getName() + " logged " + timeSpentStr + " of work on task '" + task.getTitle() + "'."
        );

        // Notify reporter / manager
        try {
            if (task.getReporter() != null && !task.getReporter().getEmpId().equals(currentUser.getEmpId())) {
                notificationService.createNotification(
                        task.getReporter().getEmpId(),
                        "Work Logged on Task: " + task.getTitle(),
                        currentUser.getName() + " logged " + timeSpentStr + " of work on '" + task.getTitle() + "'.",
                        "WORK_LOGGED"
                );
            }
        } catch (Exception e) {
            System.err.println("Failed to send notification: " + e.getMessage());
        }

        return ResponseEntity.ok(saved);
    }

    @PutMapping("/work-logs/{id}")
    public ResponseEntity<?> updateWorkLog(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Principal principal) {
        
        String email = principal.getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        WorkLog workLog = workLogRepository.findById(id).orElseThrow();
        Task task = workLog.getTask();

        // Enforce permissions: Log creator, Task Assignee, Managers, Admins
        boolean isAdminOrManager = "ADMIN".equalsIgnoreCase(currentUser.getRole().name())
                || "MANAGER".equalsIgnoreCase(currentUser.getRole().name());
        boolean isCreator = workLog.getUser().getId().equals(currentUser.getId());
        boolean isAssignee = task.getAssignee() != null && task.getAssignee().getId().equals(currentUser.getId());

        if (!isAdminOrManager && !isCreator && !isAssignee) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "You do not have permission to modify this work log."));
        }

        String timeSpentStr = (String) body.get("timeSpent");
        if (timeSpentStr != null && !timeSpentStr.trim().isEmpty()) {
            long seconds = Task.parseTimeToSeconds(timeSpentStr);
            if (seconds <= 0) {
                return ResponseEntity.badRequest().body(Map.of("message", "Invalid time spent format."));
            }
            workLog.setTimeSpent(timeSpentStr);
            workLog.setTimeSpentSeconds(seconds);
        }

        String workDateStr = (String) body.get("workDate");
        if (workDateStr != null && !workDateStr.isEmpty()) {
            try {
                workLog.setWorkDate(LocalDate.parse(workDateStr));
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("message", "Invalid work date format."));
            }
        }

        if (body.containsKey("comment")) {
            workLog.setComment((String) body.get("comment"));
        }

        WorkLog saved = workLogRepository.save(workLog);

        // Recalculate Task Effort
        recalculateTaskTime(task);

        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/work-logs/{id}")
    public ResponseEntity<?> deleteWorkLog(
            @PathVariable Long id,
            Principal principal) {
        
        String email = principal.getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        WorkLog workLog = workLogRepository.findById(id).orElseThrow();
        Task task = workLog.getTask();

        // Enforce permissions: Log creator, Task Assignee, Managers, Admins
        boolean isAdminOrManager = "ADMIN".equalsIgnoreCase(currentUser.getRole().name())
                || "MANAGER".equalsIgnoreCase(currentUser.getRole().name());
        boolean isCreator = workLog.getUser().getId().equals(currentUser.getId());
        boolean isAssignee = task.getAssignee() != null && task.getAssignee().getId().equals(currentUser.getId());

        if (!isAdminOrManager && !isCreator && !isAssignee) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "You do not have permission to delete this work log."));
        }

        workLogRepository.delete(workLog);

        // Recalculate Task Effort
        recalculateTaskTime(task);

        return ResponseEntity.ok(Map.of("status", "Deleted"));
    }

    private void recalculateTaskTime(Task task) {
        List<WorkLog> logs = workLogRepository.findByTaskIdOrderByCreatedAtDesc(task.getId());
        long totalSpent = logs.stream().mapToLong(WorkLog::getTimeSpentSeconds).sum();
        task.setTimeSpentSeconds(totalSpent);
        
        long original = task.getOriginalEstimateSeconds() != null ? task.getOriginalEstimateSeconds() : 0L;
        task.setRemainingEstimateSeconds(Math.max(0L, original - totalSpent));
        
        taskRepository.save(task);
    }
}
