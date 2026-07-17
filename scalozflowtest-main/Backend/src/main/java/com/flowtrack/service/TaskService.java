package com.flowtrack.service;

import com.flowtrack.model.Task;
import com.flowtrack.model.User;
import com.flowtrack.model.Project;
import com.flowtrack.model.Sprint;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.UserRepository;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.SprintRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@org.springframework.transaction.annotation.Transactional
public class TaskService {
    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private TaskHistoryService taskHistoryService;

    @Autowired
    private TaskEmailService taskEmailService;

    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    public Task getTaskByProjectAndSequence(Long projectId, Long sequence) {
        List<Task> tasks = taskRepository.findByProjectIdAndProjectSequence(projectId, sequence);
        return tasks.isEmpty() ? null : tasks.get(0);
    }

    public List<Task> getTasksByProjectId(Long projectId) {
        return taskRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
    }

    public List<Task> getTasksByReporterId(Long reporterId) {
        return taskRepository.findByReporterIdOrderByCreatedAtDesc(reporterId);
    }

    public List<Task> getTasksByStatus(String status) {
        return taskRepository.findByStatusOrderByCreatedAtDesc(status);
    }

    public List<Task> getTasksByStatuses(java.util.Collection<String> statuses) {
        return taskRepository.findByStatusInOrderByCreatedAtDesc(statuses);
    }

    public List<Task> getPmReviewTasksByUserId(Long userId) {
        java.util.Collection<String> reviewStatuses = java.util.Arrays.asList(
            "Pending PM Review",
            "Awaiting Clarification",
            "Rejected",
            "Approved Awaiting Assignment"
        );
        return taskRepository.findPmReviewTasksByUserId(userId, reviewStatuses);
    }

    public Task createTask(Task task, Long projectId, Long assigneeId, Long sprintId) {
        return createTask(task, projectId, assigneeId, sprintId, null, null, null);
    }

    public Task createTask(Task task, Long projectId, Long assigneeId, Long sprintId, Long parentId) {
        return createTask(task, projectId, assigneeId, sprintId, parentId, null, null);
    }

    public Task createTask(Task task, Long projectId, Long assigneeId, Long sprintId, Long parentId,
            Long coAssigneeId) {
        return createTask(task, projectId, assigneeId, sprintId, parentId, coAssigneeId, null);
    }

    public Task createTask(Task task, Long projectId, Long assigneeId, Long sprintId, Long parentId, Long coAssigneeId,
            Long reporterId) {
        Project project = projectRepository.findById(projectId).orElseThrow();
        task.setProject(project);

        if (assigneeId != null) {
            User assignee = userRepository.findById(assigneeId).orElse(null);
            task.setAssignee(assignee);
        }

        if (coAssigneeId != null) {
            User coAssignee = userRepository.findById(coAssigneeId).orElse(null);
            task.setCoAssignee(coAssignee);
        }

        if (reporterId != null) {
            User reporter = userRepository.findById(reporterId).orElse(null);
            task.setReporter(reporter);
        } else {
            try {
                org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder
                        .getContext().getAuthentication();
                if (auth != null && auth.isAuthenticated()) {
                    String email = auth.getName();
                    User currentUser = userRepository.findByEmail(email).orElse(null);
                    if (currentUser != null) {
                        task.setReporter(currentUser);
                    }
                }
            } catch (Exception e) {
                // Ignore fallback if context or db error occurs
            }
        }

        if (parentId != null) {
            Task parent = taskRepository.findById(parentId).orElse(null);
            task.setParentTask(parent);
            if (sprintId == null && parent != null && parent.getSprint() != null) {
                sprintId = parent.getSprint().getId();
            }
        }

        // Project Type Logic
        boolean isScrum = "SCRUM".equalsIgnoreCase(project.getProjectType());

        // Task location logic (Sprint vs Backlog vs Board)
        if (sprintId != null) {
            Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
            if (sprint != null) {
                task.setSprint(sprint);
                task.setEnvironment("SPRINT");
                if (task.getStatus() == null || "Backlog".equalsIgnoreCase(task.getStatus())
                        || "TODO".equalsIgnoreCase(task.getStatus())) {
                    task.setStatus("To Do");
                }
            }
        } else if (isScrum) {
            // Scrum without sprint -> Backlog
            if (task.getEnvironment() == null) {
                task.setEnvironment("BACKLOG");
            }
            if (task.getStatus() == null) {
                task.setStatus("Backlog");
            }
        } else {
            // Kanban or other -> Board
            task.setEnvironment("BOARD");
            if (task.getStatus() == null || "Backlog".equalsIgnoreCase(task.getStatus())) {
                task.setStatus("To Do");
            }
            task.setSprint(null);
        }

        if (task.getColumnId() == null) {
            task.setColumnId(1L);
        }

        // Project-specific sequence number generation
        Long maxSeq = taskRepository.findMaxProjectSequenceByProjectId(projectId);
        task.setProjectSequence(maxSeq == null ? 1L : maxSeq + 1L);

        // Route to review queue for regular users.
        // Managers and Admins bypass this and tasks go straight to To Do / Backlog.
        boolean needsReview = true;
        try {
            org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated()) {
                if (auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_MANAGER") || a.getAuthority().equals("ROLE_ADMIN"))) {
                    needsReview = false;
                }
            }
        } catch (Exception e) {
            // Fallback to requiring review if auth context fails
            e.printStackTrace();
        }

        // Force all subtasks to go through PM approval regardless of the creator's role,
        // EXCEPT if the subtask is of issue type BUG!
        if (parentId != null) {
            if ("BUG".equalsIgnoreCase(task.getIssueType())) {
                needsReview = false;
            } else {
                needsReview = true;
            }
        }

        if (needsReview) {
            task.setOriginalStatus(task.getStatus());
            task.setStatus("Pending PM Review");
            // DO NOT wipe the assignee. If the developer assigned it to themselves (or someone else),
            // the Manager should be able to see who they wanted to assign it to during the review!
        }

        Task saved = taskRepository.saveAndFlush(task);
        
        if (saved.getParentTask() != null && saved.getAssignee() != null) {
            try {
                String assigneeEmail = saved.getAssignee().getEmail();
                String assigneeName = saved.getAssignee().getName();
                String projectName = saved.getProject() != null ? saved.getProject().getName() : "Unknown Project";
                String parentKey = getTaskKey(saved.getParentTask());
                String parentTitle = saved.getParentTask().getTitle();
                String subtaskKey = getTaskKey(saved);
                String subtaskTitle = saved.getTitle();
                String priority = saved.getPriority() != null ? saved.getPriority() : "MEDIUM";
                
                taskEmailService.sendSubtaskCreatedEmail(
                    assigneeEmail,
                    assigneeName,
                    projectName,
                    parentKey,
                    parentTitle,
                    subtaskKey,
                    subtaskTitle,
                    priority,
                    saved.getIssueType()
                );
            } catch (Exception e) {
                System.err.println("Failed to send subtask email: " + e.getMessage());
                e.printStackTrace();
            }
        }
        
        if (saved.getParentTask() == null && saved.getAssignee() != null) {
            try {
                taskEmailService.sendTaskCreatedEmail(saved.getAssignee(), saved);
            } catch (Exception e) {
                System.err.println("Failed to send task created email: " + e.getMessage());
                e.printStackTrace();
            }
        }
        
        if (needsReview) {
            try {
                taskEmailService.sendPendingReviewEmail(saved);
            } catch (Exception e) {
                System.err.println("Failed to send email: " + e.getMessage());
            }
        }

        // Log task lifecycle creation and initial assignments
        taskHistoryService.log(saved.getId(), "CREATED", null, saved.getStatus());

        activityLogService.log(
                projectId,
                null,
                "TASK_CREATED",
                "TASK",
                saved.getId(),
                "TASK-" + saved.getId(),
                null,
                saved.getStatus(),
                "Task created: " + saved.getTitle());

        // Notify all PMs (Managers and Admins) about the submission
        try {
            java.util.Set<User> pms = new java.util.HashSet<>();
            if (project != null) {
                if (project.getCreatedBy() != null) {
                    pms.add(project.getCreatedBy());
                }
            }
            for (User pm : pms) {
                notificationService.createNotification(
                    pm.getEmpId(),
                    "New Task Submitted",
                    "A new task '" + saved.getTitle() + "' in project " + project.getName() + " has been submitted and is pending PM review.",
                    "TASK_SUBMIT"
                );
            }
        } catch (Exception e) {
            System.err.println("Failed to notify PMs: " + e.getMessage());
        }

        // Sync parent epic if it exists
        if (saved.getParentTask() != null) {
            taskRepository.flush();
            syncEpicStatus(saved.getParentTask().getId());
        }

        return saved;
    }

    public Task updateTask(Long id, Task taskDetails, Long assigneeId, Long sprintId) {
        return updateTask(id, taskDetails, assigneeId, sprintId, null, null, null);
    }

    public Task updateTask(Long id, Task taskDetails, Long assigneeId, Long sprintId, Long parentId) {
        return updateTask(id, taskDetails, assigneeId, sprintId, parentId, null, null);
    }

    public Task updateTask(Long id, Task taskDetails, Long assigneeId, Long sprintId, Long parentId,
            Long coAssigneeId) {
        return updateTask(id, taskDetails, assigneeId, sprintId, parentId, coAssigneeId, null);
    }

    public Task updateTask(Long id, Task taskDetails, Long assigneeId, Long sprintId, Long parentId, Long coAssigneeId,
            Long reporterId) {
        Task task = taskRepository.findById(id).orElseThrow();

        // Capture old values for notification triggers
        User oldAssignee = task.getAssignee();
        User oldCoAssignee = task.getCoAssignee();
        String oldStatus = task.getStatus();
        String oldPriority = task.getPriority();
        java.time.LocalDate oldDueDate = task.getDueDate();
        String oldIssueType = task.getIssueType();
        String oldTitle = task.getTitle();
        String oldDescription = task.getDescription();

        // Lock and validate review-phase tasks status changes
        if (taskDetails.getStatus() != null && !taskDetails.getStatus().equalsIgnoreCase(oldStatus)) {
            java.util.List<String> reviewStatuses = java.util.Arrays.asList("Pending PM Review", "Awaiting Clarification", "Rejected");
            
            // Allow auto-transition from Awaiting Clarification to Pending PM Review when updating
            boolean isAllowedClarificationResubmit = "Awaiting Clarification".equalsIgnoreCase(oldStatus) 
                && "Pending PM Review".equalsIgnoreCase(taskDetails.getStatus());
            
            if (reviewStatuses.contains(oldStatus) && !isAllowedClarificationResubmit) {
                throw new IllegalStateException("Task is in review phase (" + oldStatus + ") and cannot be moved or transitioned manually.");
            }
            
            // Block manually moving any active task into a review status via standard updateTask
            if (reviewStatuses.contains(taskDetails.getStatus())) {
                throw new IllegalStateException("Cannot manually transition task into review status: " + taskDetails.getStatus());
            }
        }

        // If task is in Awaiting Clarification, editing it automatically transitions it back to Pending PM Review
        if ("Awaiting Clarification".equalsIgnoreCase(task.getStatus())) {
            if (taskDetails.getStatus() == null || "Awaiting Clarification".equalsIgnoreCase(taskDetails.getStatus())) {
                task.setStatus("Pending PM Review");
                taskDetails.setStatus("Pending PM Review");
                
                try {
                    taskEmailService.sendPendingReviewEmail(task);
                } catch (Exception e) {
                    System.err.println("Failed to send email: " + e.getMessage());
                }
                
                try {
                    java.util.Set<User> pms = new java.util.HashSet<>();
                    Project project = task.getProject();
                    if (project != null) {
                        if (project.getCreatedBy() != null) {
                            pms.add(project.getCreatedBy());
                        }
                    }
                    for (User pm : pms) {
                        notificationService.createNotification(
                            pm.getEmpId(),
                            "Clarification Provided",
                            "The reporter has updated task '" + task.getTitle() + "' with clarification details.",
                            "TASK_SUBMIT"
                        );
                    }
                } catch (Exception e) {
                    System.err.println("Failed to notify PMs: " + e.getMessage());
                }
            }
        }

        if (taskDetails.getTitle() != null)
            task.setTitle(taskDetails.getTitle());
        if (taskDetails.getDescription() != null)
            task.setDescription(taskDetails.getDescription());
        if (taskDetails.getColumnId() != null) {
            task.setColumnId(taskDetails.getColumnId());
        }
        task.setDueDate(taskDetails.getDueDate());
        if (taskDetails.getOriginalEstimate() != null) {
            task.setOriginalEstimate(taskDetails.getOriginalEstimate());
            // Recalculate remaining estimate based on updated original estimate and existing spent effort
            long spent = task.getTimeSpentSeconds() != null ? task.getTimeSpentSeconds() : 0L;
            long original = task.getOriginalEstimateSeconds() != null ? task.getOriginalEstimateSeconds() : 0L;
            task.setRemainingEstimateSeconds(Math.max(0L, original - spent));
        } else if (taskDetails.getRemainingEstimateSeconds() != null) {
            task.setRemainingEstimateSeconds(taskDetails.getRemainingEstimateSeconds());
        }
        if (taskDetails.getOrderIndex() != null)
            task.setOrderIndex(taskDetails.getOrderIndex());

        if (taskDetails.getStatus() != null && !taskDetails.getStatus().equalsIgnoreCase(oldStatus)) {
            if ("DONE".equalsIgnoreCase(oldStatus) || "Done".equalsIgnoreCase(oldStatus)) {
                throw new IllegalStateException("Task is already in DONE state and cannot be moved to any other state.");
            }
            // Block moving to DONE if there are uncompleted subtasks
            if ("DONE".equalsIgnoreCase(taskDetails.getStatus()) || "Done".equalsIgnoreCase(taskDetails.getStatus())) {
                List<Task> children = taskRepository.findByParentTaskId(id);
                boolean hasIncomplete = children.stream()
                        .anyMatch(child -> !"DONE".equalsIgnoreCase(child.getStatus())
                                && !"Done".equalsIgnoreCase(child.getStatus()));
                if (hasIncomplete) {
                    throw new IllegalStateException("Cannot complete task because there are uncompleted subtasks");
                }
            }
            task.setStatus(taskDetails.getStatus());
        }

        if (taskDetails.getPriority() != null)
            task.setPriority(taskDetails.getPriority());
        if (taskDetails.getTags() != null)
            task.setTags(taskDetails.getTags());
        if (taskDetails.getAttachments() != null)
            task.setAttachments(taskDetails.getAttachments());
        if (taskDetails.getStoryPoints() != null)
            task.setStoryPoints(taskDetails.getStoryPoints());
        if (taskDetails.getIssueType() != null)
            task.setIssueType(taskDetails.getIssueType());
        if (taskDetails.getEpicColor() != null)
            task.setEpicColor(taskDetails.getEpicColor());

        if (assigneeId != null) {
            User assignee = userRepository.findById(assigneeId).orElse(null);
            task.setAssignee(assignee);

            // Notify if newly assigned
            if (assignee != null && (oldAssignee == null || !oldAssignee.getId().equals(assignee.getId()))) {
                notificationService.createNotification(assignee.getEmpId(),
                        "You were assigned a ticket: " + task.getTitle(), "TASK_ASSIGN");
            }
        } else {
            task.setAssignee(null);
        }

        if (coAssigneeId != null) {
            User coAssignee = userRepository.findById(coAssigneeId).orElse(null);
            task.setCoAssignee(coAssignee);

            // Notify if newly assigned
            if (coAssignee != null && (oldCoAssignee == null || !oldCoAssignee.getId().equals(coAssignee.getId()))) {
                notificationService.createNotification(coAssignee.getEmpId(),
                        "You were assigned as co-assignee on a ticket: " + task.getTitle(), "TASK_ASSIGN");
            }
        } else {
            task.setCoAssignee(null);
        }

        if (sprintId != null) {
            Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
            task.setSprint(sprint);
        } else {
            task.setSprint(null);
        }

        if (parentId != null) {
            Task parent = taskRepository.findById(parentId).orElse(null);
            task.setParentTask(parent);
        }

        if (reporterId != null) {
            User reporter = userRepository.findById(reporterId).orElse(null);
            task.setReporter(reporter);
        }

        // Final Environment sync based on state
        if (task.getSprint() != null) {
            task.setEnvironment("SPRINT");
        } else if ("SCRUM".equalsIgnoreCase(task.getProject().getProjectType())) {
            if ("Backlog".equalsIgnoreCase(task.getStatus())) {
                task.setEnvironment("BACKLOG");
            } else {
                task.setEnvironment("BOARD");
            }
        } else {
            task.setEnvironment("BOARD");
        }

        Task saved = taskRepository.save(task);

        // Log transition history
        // Status change & Email notifications (Task completed / reopened / status updated)
        if (!java.util.Objects.equals(saved.getStatus(), oldStatus)) {
            taskHistoryService.log(saved.getId(), "STATUS_CHANGE", oldStatus, saved.getStatus());
            
            boolean wasDone = "DONE".equalsIgnoreCase(oldStatus) || "Done".equalsIgnoreCase(oldStatus);
            boolean isDone = "DONE".equalsIgnoreCase(saved.getStatus()) || "Done".equalsIgnoreCase(saved.getStatus());
            
            if (isDone && !wasDone) {
                if (saved.getAssignee() != null) {
                    try { taskEmailService.sendTaskCompletedEmail(saved.getAssignee(), saved); } catch (Exception e) { e.printStackTrace(); }
                }
                if (saved.getReporter() != null && (saved.getAssignee() == null || !saved.getReporter().getId().equals(saved.getAssignee().getId()))) {
                    try { taskEmailService.sendTaskCompletedEmail(saved.getReporter(), saved); } catch (Exception e) { e.printStackTrace(); }
                }
                Project proj = saved.getProject();
                if (proj != null && proj.getCreatedBy() != null) {
                    if ((saved.getAssignee() == null || !proj.getCreatedBy().getId().equals(saved.getAssignee().getId())) &&
                        (saved.getReporter() == null || !proj.getCreatedBy().getId().equals(saved.getReporter().getId()))) {
                        try { taskEmailService.sendTaskCompletedEmail(proj.getCreatedBy(), saved); } catch (Exception e) { e.printStackTrace(); }
                    }
                }
            } else if (wasDone && !isDone) {
                if (saved.getAssignee() != null) {
                    try { taskEmailService.sendTaskReopenedEmail(saved.getAssignee(), saved, "Task moved back to active columns."); } catch (Exception e) { e.printStackTrace(); }
                }
                if (saved.getReporter() != null && (saved.getAssignee() == null || !saved.getReporter().getId().equals(saved.getAssignee().getId()))) {
                    try { taskEmailService.sendTaskReopenedEmail(saved.getReporter(), saved, "Task moved back to active columns."); } catch (Exception e) { e.printStackTrace(); }
                }
                Project proj = saved.getProject();
                if (proj != null && proj.getCreatedBy() != null) {
                    if ((saved.getAssignee() == null || !proj.getCreatedBy().getId().equals(saved.getAssignee().getId())) &&
                        (saved.getReporter() == null || !proj.getCreatedBy().getId().equals(saved.getReporter().getId()))) {
                        try { taskEmailService.sendTaskReopenedEmail(proj.getCreatedBy(), saved, "Task moved back to active columns."); } catch (Exception e) { e.printStackTrace(); }
                    }
                }
            } else {
                User updatedBy = null;
                try {
                    String curEmail = SecurityContextHolder.getContext().getAuthentication().getName();
                    updatedBy = userRepository.findByEmail(curEmail).orElse(null);
                } catch (Exception e) {
                    // Fallback if no auth context
                }
                try {
                    taskEmailService.sendTaskStatusChangedEmail(saved.getAssignee(), saved.getReporter(), saved, oldStatus, saved.getStatus(), updatedBy);
                } catch (Exception e) {
                    System.err.println("Failed to send status change email: " + e.getMessage());
                }
            }
        }

        // Assignee transfer/reassignment
        String oldAssName = (oldAssignee != null && oldAssignee.getName() != null) ? oldAssignee.getName()
                : "Unassigned";
        String newAssName = (saved.getAssignee() != null && saved.getAssignee().getName() != null)
                ? saved.getAssignee().getName()
                : "Unassigned";
        if (!java.util.Objects.equals(oldAssName, newAssName)) {
            taskHistoryService.log(saved.getId(), "ASSIGNEE_CHANGE", oldAssName, newAssName);
            if (saved.getAssignee() != null) {
                try {
                    taskEmailService.sendTaskAssignedEmail(saved.getAssignee(), oldAssignee, saved);
                } catch (Exception e) {
                    System.err.println("Failed to send task assigned email: " + e.getMessage());
                }
            }
        }

        // Partner / Co-assignee change
        String oldCoAssName = (oldCoAssignee != null && oldCoAssignee.getName() != null) ? oldCoAssignee.getName()
                : "No Partner";
        String newCoAssName = (saved.getCoAssignee() != null && saved.getCoAssignee().getName() != null)
                ? saved.getCoAssignee().getName()
                : "No Partner";
        if (!java.util.Objects.equals(oldCoAssName, newCoAssName)) {
            taskHistoryService.log(saved.getId(), "CO_ASSIGNEE_CHANGE", oldCoAssName, newCoAssName);
        }

        // Priority change
        if (!java.util.Objects.equals(saved.getPriority(), oldPriority)) {
            taskHistoryService.log(saved.getId(), "PRIORITY_CHANGE", oldPriority, saved.getPriority());
        }

        if (!java.util.Objects.equals(saved.getDueDate(), oldDueDate)) {
            taskHistoryService.log(saved.getId(), "DUE_DATE_CHANGE", oldDueDate != null ? oldDueDate.toString() : "None", saved.getDueDate() != null ? saved.getDueDate().toString() : "None");
        }

        if (!java.util.Objects.equals(saved.getIssueType(), oldIssueType)) {
            taskHistoryService.log(saved.getId(), "ISSUE_TYPE_CHANGE", oldIssueType, saved.getIssueType());
        }

        if (!java.util.Objects.equals(saved.getTitle(), oldTitle)) {
            taskHistoryService.log(saved.getId(), "TITLE_CHANGE", oldTitle, saved.getTitle());
        }

        if (!java.util.Objects.equals(saved.getDescription(), oldDescription)) {
            taskHistoryService.log(saved.getId(), "DESCRIPTION_CHANGE", "Previous description", "Updated description");
        }

        if (!java.util.Objects.equals(saved.getStatus(), oldStatus)) {

            activityLogService.log(
                    saved.getProject().getId(),
                    null,
                    "TASK_MOVED",
                    "TASK",
                    saved.getId(),
                    "TASK-" + saved.getId(),
                    oldStatus,
                    saved.getStatus(),
                    "Task moved to " + saved.getStatus());

            // Notify Assignee
            if (saved.getAssignee() != null) {
                notificationService.createNotification(saved.getAssignee().getEmpId(),
                        "Your ticket moved to " + saved.getStatus() + ": " + saved.getTitle(), "TASK_UPDATE");
            }

            // Notify Project Lead/Manager
            Project project = saved.getProject();
            if (project != null && project.getCreatedBy() != null) {
                // Avoid duplicate notification if Lead is also the Assignee
                if (saved.getAssignee() == null
                        || !project.getCreatedBy().getId().equals(saved.getAssignee().getId())) {
                    notificationService.createNotification(project.getCreatedBy().getEmpId(),
                            "Ticket moved to " + saved.getStatus() + ": " + saved.getTitle(), "TASK_UPDATE");
                }
            }
        }

        // Sync parent epic if it exists
        if (saved.getParentTask() != null) {
            taskRepository.flush();
            syncEpicStatus(saved.getParentTask().getId());
        }

        return saved;
    }

    public Task getTaskById(Long id) {
        return taskRepository.findById(id).orElseThrow();
    }

    public List<Task> getTasksBySprintId(Long sprintId) {
        return taskRepository.findBySprintIdOrderByOrderIndexAsc(sprintId);
    }

    public List<Task> getTasksByAssigneeId(Long assigneeId) {
        return taskRepository.findByAssigneeId(assigneeId);
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteTask(Long id) {
        Task task = taskRepository.findById(id).orElseThrow();
        Long parentId = task.getParentTask() != null ? task.getParentTask().getId() : null;

        // Defensive: Clear collections and relationships to avoid FK issues
        task.setSprint(null);
        task.setAssignee(null);

        // If it's a parent, detach children to avoid recursive delete failures
        if (task.getSubTasks() != null) {
            for (Task sub : task.getSubTasks()) {
                sub.setParentTask(null);
                taskRepository.save(sub);
            }
            task.getSubTasks().clear();
        }

        // Explicitly clear comments if any
        if (task.getComments() != null) {
            task.getComments().clear();
        }

        taskRepository.saveAndFlush(task);
        taskRepository.delete(task);
        taskRepository.flush();

        if (parentId != null) {
            syncEpicStatus(parentId);
        }
    }

    public void syncEpicStatus(Long epicId) {
        if (epicId == null)
            return;
        Task epic = taskRepository.findById(epicId).orElse(null);
        if (epic == null || !"EPIC".equalsIgnoreCase(epic.getIssueType()))
            return;

        List<Task> children = taskRepository.findByParentTaskId(epicId);
        if (children.isEmpty())
            return;

        long total = children.size();
        long done = children.stream().filter(t -> "DONE".equalsIgnoreCase(t.getStatus())).count();
        long todo = children.stream().filter(t -> {
            String s = t.getStatus();
            return s == null || "TODO".equalsIgnoreCase(s) || "BACKLOG".equalsIgnoreCase(s)
                    || "TO DO".equalsIgnoreCase(s);
        }).count();

        String newStatus;
        if (done == total) {
            newStatus = "DONE";
        } else if (todo == total) {
            newStatus = "TODO";
        } else {
            newStatus = "IN PROGRESS";
        }

        if (!newStatus.equalsIgnoreCase(epic.getStatus())) {
            epic.setStatus(newStatus);
            taskRepository.save(epic);

            // Log epic movement
            activityLogService.log(
                    epic.getProject().getId(),
                    null,
                    "TASK_MOVED",
                    "EPIC",
                    epic.getId(),
                    "EPIC-" + epic.getId(),
                    null,
                    newStatus,
                    "Epic status automatically updated to " + newStatus + " based on child tasks");
        }
    }

    @jakarta.annotation.PostConstruct
    public void backfillProjectSequences() {
        try {
            List<Task> allTasks = taskRepository.findAll();
            java.util.Map<Long, List<Task>> tasksByProject = allTasks.stream()
                .filter(t -> t.getProject() != null)
                .collect(java.util.stream.Collectors.groupingBy(t -> t.getProject().getId()));

            for (java.util.Map.Entry<Long, List<Task>> entry : tasksByProject.entrySet()) {
                List<Task> projectTasks = entry.getValue();
                projectTasks.sort(java.util.Comparator.comparing(Task::getId));
                
                long currentSeq = 1;
                boolean needsSave = false;
                for (Task t : projectTasks) {
                    if (t.getProjectSequence() == null || t.getProjectSequence() == 0) {
                        t.setProjectSequence(currentSeq);
                        needsSave = true;
                    }
                    currentSeq = Math.max(currentSeq, t.getProjectSequence()) + 1;
                }
                if (needsSave) {
                    taskRepository.saveAll(projectTasks);
                    taskRepository.flush();
                }
            }
        } catch (Exception e) {
            System.err.println("Error backfilling project sequences: " + e.getMessage());
        }
    }

    public Task approveTask(Long taskId, String comment) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        String oldStatus = task.getStatus();
        
        // Route to Approved Awaiting Assignment if unassigned.
        // If assigned, restore original status if valid, else fallback to To Do.
        String newStatus;
        if (task.getAssignee() == null) {
            newStatus = "Approved Awaiting Assignment";
        } else if (task.getOriginalStatus() != null && !task.getOriginalStatus().equalsIgnoreCase("Pending PM Review")) {
            newStatus = task.getOriginalStatus();
        } else {
            newStatus = "To Do";
        }
        
        task.setStatus(newStatus);
        Task saved = taskRepository.save(task);
        
        if (saved.getParentTask() != null && saved.getAssignee() != null) {
            try {
                String assigneeEmail = saved.getAssignee().getEmail();
                String assigneeName = saved.getAssignee().getName();
                String projectName = saved.getProject() != null ? saved.getProject().getName() : "Unknown Project";
                String parentKey = getTaskKey(saved.getParentTask());
                String parentTitle = saved.getParentTask().getTitle();
                String subtaskKey = getTaskKey(saved);
                String subtaskTitle = saved.getTitle();
                String priority = saved.getPriority() != null ? saved.getPriority() : "MEDIUM";
                
                taskEmailService.sendSubtaskCreatedEmail(
                    assigneeEmail,
                    assigneeName,
                    projectName,
                    parentKey,
                    parentTitle,
                    subtaskKey,
                    subtaskTitle,
                    priority,
                    saved.getIssueType()
                );
            } catch (Exception e) {
                System.err.println("Failed to send subtask approval email: " + e.getMessage());
                e.printStackTrace();
            }
        }
        
        taskHistoryService.log(taskId, "STATUS_CHANGE", oldStatus, newStatus, comment);
        
        if (saved.getReporter() != null) {
            notificationService.createNotification(
                saved.getReporter().getEmpId(),
                "Task Approved",
                "Your task '" + saved.getTitle() + "' has been approved by the Project Manager.",
                "TASK_APPROVE"
            );
            try {
                taskEmailService.sendTaskApprovedEmail(saved);
            } catch (Exception e) {
                System.err.println("Failed to send email: " + e.getMessage());
            }
        }
        return saved;
    }

    public Task rejectTask(Long taskId, String comment) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        String oldStatus = task.getStatus();
        String newStatus = "Rejected";
        
        task.setStatus(newStatus);
        Task saved = taskRepository.save(task);
        
        taskHistoryService.log(taskId, "STATUS_CHANGE", oldStatus, newStatus, comment);
        
        if (saved.getReporter() != null) {
            notificationService.createNotification(
                saved.getReporter().getEmpId(),
                "Task Rejected",
                "Your task '" + saved.getTitle() + "' has been rejected. PM Comment: " + comment,
                "TASK_REJECT"
            );
            try {
                taskEmailService.sendTaskRejectedEmail(saved, comment);
            } catch (Exception e) {
                System.err.println("Failed to send email: " + e.getMessage());
            }
        }
        return saved;
    }

    public Task requestClarification(Long taskId, String comment) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        String oldStatus = task.getStatus();
        String newStatus = "Awaiting Clarification";
        
        task.setStatus(newStatus);
        Task saved = taskRepository.save(task);
        
        taskHistoryService.log(taskId, "STATUS_CHANGE", oldStatus, newStatus, comment);
        
        if (saved.getReporter() != null) {
            notificationService.createNotification(
                saved.getReporter().getEmpId(),
                "Clarification Requested",
                "Clarification has been requested for your task '" + saved.getTitle() + "'. PM Comment: " + comment,
                "TASK_CLARIFY"
            );
            try {
                taskEmailService.sendClarificationEmail(saved, comment);
            } catch (Exception e) {
                System.err.println("Failed to send email: " + e.getMessage());
            }
        }
        return saved;
    }

    public Task convertWorkItemType(Long taskId, String newType) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        String oldType = task.getIssueType();
        task.setIssueType(newType.toUpperCase());
        Task saved = taskRepository.save(task);
        
        taskHistoryService.log(taskId, "ISSUE_TYPE_CHANGE", oldType, newType.toUpperCase(), "Work item type converted by PM");
        return saved;
    }

    public Task assignDeveloper(Long taskId, Long assigneeId, Long coAssigneeId) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        String oldStatus = task.getStatus();
        String newStatus = "TO DO";
        
        if (assigneeId != null) {
            User assignee = userRepository.findById(assigneeId).orElse(null);
            task.setAssignee(assignee);
            if (assignee != null) {
                notificationService.createNotification(
                    assignee.getEmpId(),
                    "New Task Assigned",
                    "You have been assigned to task: " + task.getTitle(),
                    "TASK_ASSIGN"
                );
            }
        }
        
        if (coAssigneeId != null) {
            User coAssignee = userRepository.findById(coAssigneeId).orElse(null);
            task.setCoAssignee(coAssignee);
            if (coAssignee != null) {
                notificationService.createNotification(
                    coAssignee.getEmpId(),
                    "Assigned as Partner",
                    "You have been assigned as co-assignee to task: " + task.getTitle(),
                    "TASK_ASSIGN"
                );
            }
        }
        
        task.setStatus(newStatus);
        task.setEnvironment("BOARD");
        task.setColumnId(1L); // Reset to first column of the board (To Do)
        
        Task saved = taskRepository.save(task);
        
        taskHistoryService.log(taskId, "STATUS_CHANGE", oldStatus, newStatus, "Developer assigned by PM.");
        if (saved.getReporter() != null) {
            notificationService.createNotification(
                saved.getReporter().getEmpId(),
                "Task Ready for Development",
                "Your task '" + saved.getTitle() + "' is now ready for development.",
                "TASK_READY"
            );
        }
        return saved;
    }

    private String getTaskKey(Task task) {
        if (task.getProject() == null || task.getProject().getName() == null) return "FT-" + task.getId();
        String clean = task.getProject().getName().trim();
        if (clean.isEmpty()) return "FT-" + task.getId();

        String[] words = clean.split("[\\s\\-_]+");
        String prefix;
        if (words.length >= 2) {
            StringBuilder sb = new StringBuilder();
            for (String w : words) {
                if (!w.isEmpty()) sb.append(Character.toUpperCase(w.charAt(0)));
            }
            prefix = sb.length() > 3 ? sb.substring(0, 3) : sb.toString();
        } else if (clean.length() >= 2) {
            prefix = clean.substring(0, 2).toUpperCase();
        } else {
            prefix = clean.toUpperCase();
        }
        
        Long seq = task.getProjectSequence() != null ? task.getProjectSequence() : task.getId();
        return prefix + "-" + seq;
    }
}
