package com.flowtrack.controller;

import com.flowtrack.model.Task;
import com.flowtrack.model.TaskHistory;
import com.flowtrack.model.Project;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.dto.TaskRequest;
import com.flowtrack.service.TaskService;
import com.flowtrack.service.TaskHistoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    @Autowired
    private TaskService taskService;

    @Autowired
    private TaskHistoryService taskHistoryService;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private com.flowtrack.repository.UserRepository userRepository;

    @GetMapping
    public List<Task> getAllTasks(@RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long sprintId,
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) Long reporterId,
            @RequestParam(required = false) String status) {
        if (reporterId != null) {
            return taskService.getTasksByReporterId(reporterId);
        }
        if (status != null) {
            return taskService.getTasksByStatus(status);
        }
        if (assigneeId != null) {
            return taskService.getTasksByAssigneeId(assigneeId);
        }
        if (sprintId != null) {
            return taskService.getTasksBySprintId(sprintId);
        }
        if (projectId != null) {
            return taskService.getTasksByProjectId(projectId);
        }
        return taskService.getAllTasks();
    }

    @GetMapping("/review-queue")
    public List<Task> getReviewQueueTasks(java.security.Principal principal) {
        String email = principal.getName();
        com.flowtrack.model.User user = userRepository.findByEmail(email).orElseThrow();
        return taskService.getPmReviewTasksByUserId(user.getId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Task> getTaskById(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.getTaskById(id));
    }

    private String getProjectPrefix(String projectName) {
        if (projectName == null || projectName.trim().isEmpty()) {
            return "FT";
        }
        String clean = projectName.trim();
        String[] words = clean.split("[\\s\\-_]+");
        if (words.length >= 2) {
            StringBuilder prefixBuilder = new StringBuilder();
            for (String word : words) {
                if (!word.isEmpty()) {
                    prefixBuilder.append(Character.toUpperCase(word.charAt(0)));
                }
            }
            if (prefixBuilder.length() > 3) {
                return prefixBuilder.substring(0, 3);
            }
            return prefixBuilder.toString();
        }

        if (clean.length() >= 2) {
            return clean.substring(0, 2).toUpperCase();
        }
        return clean.toUpperCase();
    }

    @GetMapping("/code/{prefix}/{sequence}")
    public ResponseEntity<Task> getTaskByCode(@PathVariable String prefix, @PathVariable Long sequence) {
        List<Project> projects = projectRepository.findAll();
        Project matchedProject = null;
        for (Project p : projects) {
            String name = p.getName();
            if (name != null) {
                String pfx = getProjectPrefix(name);
                if (pfx.equals(prefix.toUpperCase())) {
                    matchedProject = p;
                    break;
                }
            }
        }
        if (matchedProject == null) {
            return ResponseEntity.notFound().build();
        }
        
        Task task = taskService.getTaskByProjectAndSequence(matchedProject.getId(), sequence);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(task);
    }

    @GetMapping("/{taskId}/history")
    public List<TaskHistory> getTaskHistory(@PathVariable Long taskId) {
        return taskHistoryService.getHistoryForTask(taskId);
    }

    @PostMapping
    public Task createTask(@RequestBody TaskRequest taskRequest) {
        if (taskRequest.getTask() != null && "TODO".equalsIgnoreCase(taskRequest.getTask().getStatus())) {
            taskRequest.getTask().setStatus("To Do");
        }
        Task created = taskService.createTask(taskRequest.getTask(), taskRequest.getProjectId(), taskRequest.getAssigneeId(),
                taskRequest.getSprintId(), taskRequest.getParentId(), taskRequest.getCoAssigneeId(),
                taskRequest.getReporterId());
                
        boolean needsUpdate = false;
        // If it's a normal task, created by an admin (so it skipped PM review and went to To Do), 
        // but it is unassigned, it should go to Approved Awaiting Assignment for the PM dashboard!
        if (taskRequest.getParentId() == null && created.getAssignee() == null && "To Do".equalsIgnoreCase(created.getStatus())) {
            created.setStatus("Approved Awaiting Assignment");
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            Long assigneeId = created.getAssignee() != null ? created.getAssignee().getId() : null;
            Long coAssigneeId = created.getCoAssignee() != null ? created.getCoAssignee().getId() : null;
            Long sprintId = created.getSprint() != null ? created.getSprint().getId() : null;
            created = taskService.updateTask(created.getId(), created, assigneeId, sprintId, taskRequest.getParentId(), coAssigneeId, taskRequest.getReporterId());
        }
        
        return created;
    }

    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable Long id, @RequestBody TaskRequest taskRequest) {
        return ResponseEntity.ok(taskService.updateTask(id, taskRequest.getTask(), taskRequest.getAssigneeId(),
                taskRequest.getSprintId(), taskRequest.getParentId(), taskRequest.getCoAssigneeId(),
                taskRequest.getReporterId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id);
        return ResponseEntity.ok().build();
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasRole('MANAGER')")
    @PostMapping("/{id}/approve")
    public ResponseEntity<Task> approveTask(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body) {
        String comment = (body != null) ? body.get("comment") : "";
        return ResponseEntity.ok(taskService.approveTask(id, comment));
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasRole('MANAGER')")
    @PostMapping("/{id}/reject")
    public ResponseEntity<Task> rejectTask(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body) {
        String comment = (body != null) ? body.get("comment") : "";
        return ResponseEntity.ok(taskService.rejectTask(id, comment));
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasRole('MANAGER')")
    @PostMapping("/{id}/request-clarification")
    public ResponseEntity<Task> requestClarification(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body) {
        String comment = (body != null) ? body.get("comment") : "";
        return ResponseEntity.ok(taskService.requestClarification(id, comment));
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasRole('MANAGER')")
    @PostMapping("/{id}/convert")
    public ResponseEntity<Task> convertWorkItemType(@PathVariable Long id, @RequestBody java.util.Map<String, String> body) {
        String newType = body != null ? body.get("newType") : null;
        if (newType == null && body != null) {
            newType = body.get("issueType");
        }
        return ResponseEntity.ok(taskService.convertWorkItemType(id, newType));
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasRole('MANAGER')")
    @PostMapping("/{id}/assign-developer")
    public ResponseEntity<Task> assignDeveloper(@PathVariable Long id, @RequestBody java.util.Map<String, Object> body) {
        Long assigneeId = null;
        Long coAssigneeId = null;
        if (body != null) {
            if (body.get("assigneeId") != null) assigneeId = Long.valueOf(body.get("assigneeId").toString());
            if (body.get("coAssigneeId") != null) coAssigneeId = Long.valueOf(body.get("coAssigneeId").toString());
        }
        return ResponseEntity.ok(taskService.assignDeveloper(id, assigneeId, coAssigneeId));
    }
}
