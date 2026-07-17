package com.flowtrack.service;

import com.flowtrack.model.Sprint;
import com.flowtrack.model.Project;
import com.flowtrack.model.User;
import com.flowtrack.repository.SprintRepository;
import com.flowtrack.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@org.springframework.transaction.annotation.Transactional
public class SprintService {

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private com.flowtrack.repository.TaskRepository taskRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private TaskService taskService;

    @Autowired
    private com.flowtrack.repository.ActivityLogRepository activityLogRepository;

    @Autowired
    private TaskEmailService taskEmailService;

    public List<Sprint> getSprintsByProject(Long projectId) {
        return sprintRepository.findByProjectId(projectId);
    }

    public List<Sprint> getActiveSprintsByProject(Long projectId) {
        return sprintRepository.findByProjectIdAndStatus(projectId, "ACTIVE");
    }

    public Sprint createSprint(Long projectId, Sprint sprint) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        sprint.setProject(project);
        Sprint saved = sprintRepository.save(sprint);

        activityLogService.log(
                projectId,
                null,
                "SPRINT_CREATED",
                "SPRINT",
                saved.getId(),
                saved.getName(),
                null,
                saved.getStatus(),
                "New " + (saved.getName().toLowerCase().contains("kanban") ? "kanban" : "sprint")
                        + " cycle initialized: " + saved.getName());

        // Notify Lead
        if (project.getCreatedBy() != null) {
            notificationService.createNotification(
                    project.getCreatedBy().getEmpId(),
                    "New " + (saved.getName().toLowerCase().contains("kanban") ? "kanban" : "sprint")
                            + " cycle initialized: " + saved.getName(),
                    "PROJECT_UPDATE");
        }

        return saved;
    }

    public Sprint updateSprint(Long id, Sprint sprintDetails) {
        Sprint sprint = sprintRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        String oldStatus = sprint.getStatus();
        if (sprintDetails.getName() != null) sprint.setName(sprintDetails.getName());
        if (sprintDetails.getStartDate() != null) sprint.setStartDate(sprintDetails.getStartDate());
        if (sprintDetails.getEndDate() != null) sprint.setEndDate(sprintDetails.getEndDate());
        if (sprintDetails.getStatus() != null) sprint.setStatus(sprintDetails.getStatus());
        if (sprintDetails.getType() != null) sprint.setType(sprintDetails.getType());

        if ("ACTIVE".equalsIgnoreCase(sprintDetails.getStatus())) {
            List<com.flowtrack.model.Task> tasks = taskRepository.findBySprintIdOrderByOrderIndexAsc(id);
            for (com.flowtrack.model.Task t : tasks) {
                // Transition tasks from Backlog state to Active Sprint state
                if ("BACKLOG".equalsIgnoreCase(t.getEnvironment()) 
                        || "Backlog".equalsIgnoreCase(t.getStatus())
                        || "Overdue".equalsIgnoreCase(t.getStatus())) {
                    t.setEnvironment("SPRINT");
                    if ("Backlog".equalsIgnoreCase(t.getStatus()) || "Overdue".equalsIgnoreCase(t.getStatus())) {
                        if (t.getOriginalStatus() != null && !t.getOriginalStatus().trim().isEmpty()) {
                            t.setStatus(t.getOriginalStatus());
                        } else {
                            t.setStatus("To Do");
                        }
                    }
                    taskRepository.save(t);
                }
            }

            // Notify when started
            if (!"ACTIVE".equalsIgnoreCase(oldStatus)) {

                activityLogService.log(
                        sprint.getProject().getId(),
                        null,
                        "SPRINT_STARTED",
                        "SPRINT",
                        sprint.getId(),
                        sprint.getName(),
                        oldStatus,
                        "ACTIVE",
                        "Sprint " + sprint.getName() + " started");

                Project project = sprint.getProject();
                if (project != null && project.getCreatedBy() != null) {
                    notificationService.createNotification(
                            project.getCreatedBy().getEmpId(),
                            "Project Cycle Started: " + sprint.getName() + " is now active.",
                            "PROJECT_UPDATE");
                }
                
                if (project != null) {
                    java.util.Set<User> members = new java.util.HashSet<>(project.getTeamMembers());
                    if (project.getCreatedBy() != null) members.add(project.getCreatedBy());
                    for (User member : members) {
                        try {
                            taskEmailService.sendSprintStartedEmail(member, sprint);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        } else if ("COMPLETED".equalsIgnoreCase(sprintDetails.getStatus())
                && !"COMPLETED".equalsIgnoreCase(oldStatus)) {
            List<com.flowtrack.model.Task> tasks = taskRepository.findBySprintIdOrderByOrderIndexAsc(id);
            for (com.flowtrack.model.Task t : tasks) {
                String status = t.getStatus() != null ? t.getStatus().trim().toLowerCase() : "";
                boolean isDone = status.startsWith("done") || status.startsWith("complete") || status.startsWith("closed") || status.startsWith("resolved") || status.equals("finish");
                
                if (isDone || "BOARD".equalsIgnoreCase(t.getEnvironment())) {
                    // Task is done or already on board, keep it associated with this sprint for historical history
                    t.setEnvironment("BOARD");
                } else {
                    // Not done, move back to backlog and explicitly mark as Overdue
                    t.setOriginalStatus(t.getStatus());
                    t.setStatus("Overdue");
                    t.setEnvironment("BACKLOG");
                    t.setSprint(null);
                }
            }
            taskRepository.saveAllAndFlush(tasks);

            // Sync epics for all tasks in the sprint
            java.util.Set<Long> epicIdsToSync = new java.util.HashSet<>();
            for (com.flowtrack.model.Task t : tasks) {
                if (t.getParentTask() != null && "EPIC".equalsIgnoreCase(t.getParentTask().getIssueType())) {
                    epicIdsToSync.add(t.getParentTask().getId());
                }
            }
            for (Long epicId : epicIdsToSync) {
                taskService.syncEpicStatus(epicId);
            }

            // Notify when completed

            activityLogService.log(
                    sprint.getProject().getId(),
                    null,
                    "SPRINT_COMPLETED",
                    "SPRINT",
                    sprint.getId(),
                    sprint.getName(),
                    "ACTIVE",
                    "COMPLETED",
                    "Sprint " + sprint.getName() + " completed");

            Project project = sprint.getProject();
            if (project != null && project.getCreatedBy() != null) {
                notificationService.createNotification(
                        project.getCreatedBy().getEmpId(),
                        "Project Cycle Completed: " + sprint.getName() + " has been closed.",
                        "PROJECT_UPDATE");
            }

            if (project != null) {
                int completedTasksCount = 0;
                int incompleteTasksCount = 0;
                for (com.flowtrack.model.Task t : tasks) {
                    String status = t.getStatus() != null ? t.getStatus().trim().toLowerCase() : "";
                    boolean isDone = status.startsWith("done") || status.startsWith("complete") || status.startsWith("closed") || status.startsWith("resolved") || status.equals("finish");
                    if (isDone) {
                        completedTasksCount++;
                    } else {
                        incompleteTasksCount++;
                    }
                }

                java.util.Set<User> members = new java.util.HashSet<>(project.getTeamMembers());
                if (project.getCreatedBy() != null) members.add(project.getCreatedBy());
                for (User member : members) {
                    try {
                        taskEmailService.sendSprintCompletedEmail(member, sprint, completedTasksCount, incompleteTasksCount);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }

        return sprintRepository.save(sprint);
    }

    public void deleteSprint(Long id) {
        // Decouple tasks before deletion to prevent constraint violation
        List<com.flowtrack.model.Task> sprintTasks = taskRepository.findBySprintIdOrderByOrderIndexAsc(id);
        for (com.flowtrack.model.Task task : sprintTasks) {
            task.setSprint(null);
            taskRepository.save(task);
        }
        sprintRepository.deleteById(id);
    }

    public Sprint getSprintById(Long id) {
        return sprintRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));
    }

    public void autoExpireSprints(java.time.LocalDate currentDate) {
        List<Sprint> expiredSprints = sprintRepository.findByStatusAndEndDateBefore("ACTIVE", currentDate);
        for (Sprint sprint : expiredSprints) {
            List<com.flowtrack.model.Task> tasks = taskRepository.findBySprintIdOrderByOrderIndexAsc(sprint.getId());
            for (com.flowtrack.model.Task t : tasks) {
                String status = t.getStatus() != null ? t.getStatus().trim().toLowerCase() : "";
                boolean isDone = status.startsWith("done") || status.startsWith("complete") || status.startsWith("closed") || status.startsWith("resolved") || status.equals("finish");
                
                if (isDone || "BOARD".equalsIgnoreCase(t.getEnvironment())) {
                    // Task is done or already on board, keep it associated with this sprint for historical history
                    t.setEnvironment("BOARD");
                } else {
                    // Not done, move back to backlog and explicitly mark as Overdue
                    t.setOriginalStatus(t.getStatus());
                    t.setStatus("Overdue");
                    t.setEnvironment("BACKLOG");
                    t.setSprint(null);
                }
            }
            taskRepository.saveAllAndFlush(tasks);

            // Sync epics for all tasks in the sprint
            java.util.Set<Long> epicIdsToSync = new java.util.HashSet<>();
            for (com.flowtrack.model.Task t : tasks) {
                if (t.getParentTask() != null && "EPIC".equalsIgnoreCase(t.getParentTask().getIssueType())) {
                    epicIdsToSync.add(t.getParentTask().getId());
                }
            }
            for (Long epicId : epicIdsToSync) {
                taskService.syncEpicStatus(epicId);
            }

            // Mark sprint as completed
            sprint.setStatus("COMPLETED");
            sprintRepository.save(sprint);

            activityLogService.log(
                    sprint.getProject().getId(),
                    null,
                    "SPRINT_EXPIRED",
                    "SPRINT",
                    sprint.getId(),
                    sprint.getName(),
                    "ACTIVE",
                    "COMPLETED",
                    "Sprint " + sprint.getName() + " automatically expired and completed");

            Project project = sprint.getProject();
            if (project != null && project.getCreatedBy() != null) {
                notificationService.createNotification(
                        project.getCreatedBy().getEmpId(),
                        "Project Cycle Expired: " + sprint.getName() + " reached its deadline and was auto-closed.",
                        "PROJECT_UPDATE");
            }

            if (project != null) {
                int completedTasksCount = 0;
                int incompleteTasksCount = 0;
                for (com.flowtrack.model.Task t : tasks) {
                    String status = t.getStatus() != null ? t.getStatus().trim().toLowerCase() : "";
                    boolean isDone = status.startsWith("done") || status.startsWith("complete") || status.startsWith("closed") || status.startsWith("resolved") || status.equals("finish");
                    if (isDone) {
                        completedTasksCount++;
                    } else {
                        incompleteTasksCount++;
                    }
                }

                java.util.Set<User> members = new java.util.HashSet<>(project.getTeamMembers());
                if (project.getCreatedBy() != null) members.add(project.getCreatedBy());
                for (User member : members) {
                    try {
                        taskEmailService.sendSprintCompletedEmail(member, sprint, completedTasksCount, incompleteTasksCount);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }
    }
}
