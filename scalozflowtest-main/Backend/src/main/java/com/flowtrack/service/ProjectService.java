package com.flowtrack.service;

import com.flowtrack.model.Project;
import com.flowtrack.model.User;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.UserRepository;
import com.flowtrack.repository.BoardColumnRepository;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.SprintRepository;
import com.flowtrack.model.BoardColumn;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional
public class ProjectService {
    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BoardColumnRepository columnRepository;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private TaskEmailService taskEmailService;

    @jakarta.annotation.PostConstruct
    public void fixDatabaseSchema() {
        try {
            jdbcTemplate.execute("ALTER TABLE project_members MODIFY role_in_project VARCHAR(255) DEFAULT 'MEMBER'");
        } catch (Exception e) {
            // Schema may already be correct — safe to ignore
        }
        try {
            jdbcTemplate.execute("ALTER TABLE projects DROP COLUMN project_key");
        } catch (Exception e) {
            // Already dropped
        }
        try {
            jdbcTemplate.execute("ALTER TABLE projects DROP COLUMN governance");
        } catch (Exception e) {
            // Already dropped
        }
        try {
            jdbcTemplate.execute("ALTER TABLE projects DROP COLUMN visibility");
        } catch (Exception e) {
            // Already dropped
        }
    }

    public List<Project> getAllProjects(Long userId, String role) {
        if ("ADMIN".equalsIgnoreCase(role) || "ROLE_ADMIN".equalsIgnoreCase(role)) {
            return projectRepository.findAll();
        }
        Set<Project> allProjects = new HashSet<>();

        allProjects.addAll(projectRepository.findByCreatedById(userId));
        allProjects.addAll(projectRepository.findByMemberId(userId));

        return new ArrayList<>(allProjects);
    }

    private void buildHierarchyRecursive(Long parentId, List<User> allUsers, Set<Long> hierarchyIds) {
        for (User u : allUsers) {
            if (u.getOnboardedBy() != null && parentId.equals(u.getOnboardedBy())) {
                if (hierarchyIds.add(u.getId())) {
                    buildHierarchyRecursive(u.getId(), allUsers, hierarchyIds);
                }
            }
        }
    }

    public Project createProject(Project project, Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        project.setCreatedBy(user);

        if (project.getTeamMembers() != null && !project.getTeamMembers().isEmpty()) {
            Set<User> members = new HashSet<>();
            for (User member : project.getTeamMembers()) {
                if (member.getId() != null) {
                    userRepository.findById(member.getId()).ifPresent(members::add);
                }
            }
            project.setTeamMembers(members);
        }

        Project savedProject = projectRepository.save(project);

        String[] defaultColumns = new String[] { "To Do", "In Progress", "In Review", "Done" };

        for (int i = 0; i < defaultColumns.length; i++) {
            BoardColumn column = new BoardColumn();
            column.setProject(savedProject);
            column.setName(defaultColumns[i]);
            column.setOrderIndex(i);
            columnRepository.save(column);
        }

        String empId = null;
        if (userId != null) {
            empId = userRepository.findById(userId).map(User::getEmpId).orElse(null);
        }

        activityLogService.log(
                savedProject.getId(),
                empId,
                "PROJECT_CREATED",
                "PROJECT",
                savedProject.getId(),
                savedProject.getName(),
                null,
                null,
                "Project successfully established: " + savedProject.getName());

        // Notify Creator
        notificationService.createNotification(empId, "Project successfully established: " + savedProject.getName(),
                "PROJECT_CREATE");

        if (savedProject.getTeamMembers() != null) {
            for (User member : savedProject.getTeamMembers()) {
                if (!member.getId().equals(userId)) {
                    notificationService.createNotification(member.getEmpId(),
                            "You were added to the project: " + savedProject.getName(), "PROJECT_ASSIGN");
                }
            }
        }

        return savedProject;
    }

    public Optional<Project> getProjectById(Long id) {
        return projectRepository.findById(id);
    }

    public Project updateProject(Long id, Project projectDetails) {
        Project project = projectRepository.findById(id).orElseThrow();
        project.setName(projectDetails.getName());
        project.setDescription(projectDetails.getDescription());
        project.setObjective(projectDetails.getObjective());
        project.setTeamSize(projectDetails.getTeamSize());
        project.setDeadline(projectDetails.getDeadline());
        String oldProjectType = project.getProjectType();
        project.setProjectType(projectDetails.getProjectType());
        project.setCategory(projectDetails.getCategory());

        // Detect project type change and reset columns if needed
        if (projectDetails.getProjectType() != null && !projectDetails.getProjectType().equalsIgnoreCase(oldProjectType)) {
            // Delete old columns
            columnRepository.deleteByProjectId(project.getId());
            
            // Create new default columns
            String[] defaultColumns = new String[] { "To Do", "In Progress", "In Review", "Done" };

            BoardColumn firstColumn = null;
            for (int i = 0; i < defaultColumns.length; i++) {
                BoardColumn column = new BoardColumn();
                column.setProject(project);
                column.setName(defaultColumns[i]);
                column.setOrderIndex(i);
                BoardColumn savedCol = columnRepository.save(column);
                if (i == 0) firstColumn = savedCol;
            }

            // Reassign existing tasks to the first column of the NEW workflow
            if (firstColumn != null) {
                jdbcTemplate.update("UPDATE tasks SET column_id = ? WHERE project_id = ?", firstColumn.getId(), project.getId());
            }
            
            activityLogService.log(
                project.getId(),
                null, // System update
                "PROJECT_TEMPLATE_CHANGE",
                "PROJECT",
                project.getId(),
                project.getName(),
                oldProjectType,
                project.getProjectType(),
                "Project template migrated from " + oldProjectType + " to " + project.getProjectType()
            );
        }

        Set<User> oldMembers = new HashSet<>(project.getTeamMembers());

        if (projectDetails.getTeamMembers() != null) {
            Set<User> members = new HashSet<>();
            for (User member : projectDetails.getTeamMembers()) {
                if (member.getId() != null) {
                    userRepository.findById(member.getId()).ifPresent(members::add);
                }
            }
            project.getTeamMembers().clear();
            project.getTeamMembers().addAll(members);

            // Notify new members
            User inviter = null;
            try {
                String curEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
                inviter = userRepository.findByEmail(curEmail).orElse(null);
            } catch (Exception e) {
                // Fallback
            }
            for (User member : members) {
                if (!oldMembers.contains(member)) {
                    notificationService.createNotification(member.getEmpId(),
                            "You were added to the project: " + project.getName(), "PROJECT_ASSIGN");
                    try {
                        taskEmailService.sendProjectInvitationEmail(member, project, member.getRole().name(), inviter);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }

        Project savedProject = projectRepository.save(project);
        activityLogService.log(
                savedProject.getId(),
                null,
                "PROJECT_UPDATED",
                "PROJECT",
                savedProject.getId(),
                savedProject.getName(),
                null,
                null,
                "Project settings updated: " + savedProject.getName());

        return savedProject;
    }

    @Autowired
    private TaskService taskService;

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private TaskRepository taskRepository;

    public void deleteProject(Long id) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return;

        // 1. Delete all tasks of this project using taskService (which cleans up comments/subtasks/etc.)
        List<com.flowtrack.model.Task> tasks = taskRepository.findByProjectIdOrderByOrderIndexAsc(id);
        for (com.flowtrack.model.Task task : tasks) {
            taskService.deleteTask(task.getId());
        }

        // 2. Delete all sprints of this project
        List<com.flowtrack.model.Sprint> sprints = sprintRepository.findByProjectId(id);
        for (com.flowtrack.model.Sprint sprint : sprints) {
            sprintRepository.delete(sprint);
        }

        // 3. Delete all columns of this project
        columnRepository.deleteByProjectId(id);

        // 4. Clear the project_members relationship and save
        project.getTeamMembers().clear();
        projectRepository.saveAndFlush(project);

        // 5. Finally, delete the project
        projectRepository.delete(project);
    }
}
