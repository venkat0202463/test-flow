package com.flowtrack.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;
import com.flowtrack.model.Comment;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "tasks")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Task {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "order_index")
    private Integer orderIndex = 0;

    @Column(name = "column_id", nullable = false)
    private Long columnId = 1L; // Defaults to first column

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id", referencedColumnName = "emp_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "password" })
    private User assignee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "co_assignee_id", referencedColumnName = "emp_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "password" })
    private User coAssignee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id", referencedColumnName = "emp_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "password" })
    private User reporter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
    private Project project;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column
    private String priority = "MEDIUM";

    @Column(name = "status", length = 50)
    private String status = "TODO";

    @Column(name = "original_status", length = 50)
    private String originalStatus;

    @Column(name = "environment", length = 50)
    private String environment = "BACKLOG";

    @Column(name = "issue_type", length = 50)
    private String issueType = "TASK"; // TASK, BUG, STORY, EPIC

    @ElementCollection
    @CollectionTable(name = "task_tags", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "tag")
    private List<String> tags = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "task_attachments", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "attachment_url")
    private List<String> attachments = new ArrayList<>();

    @Column(name = "story_points")
    private Integer storyPoints = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sprint_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
    private Sprint sprint;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fix_version_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
    private Version fixVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "affects_version_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
    private Version affectsVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "subTasks" })
    private Task parentTask;

    @Column(name = "epic_color", length = 10)
    private String epicColor = "#6554C0";

    @Column(name = "project_sequence")
    private Long projectSequence;

    @OneToMany(mappedBy = "parentTask", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "parentTask" })
    private List<Task> subTasks = new ArrayList<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnoreProperties({ "task" })
    private List<Comment> comments = new ArrayList<>();

    @Column(name = "original_estimate", length = 50)
    private String originalEstimate;

    @Column(name = "original_estimate_seconds")
    private Long originalEstimateSeconds = 0L;

    @Column(name = "time_spent_seconds")
    private Long timeSpentSeconds = 0L;

    @Column(name = "remaining_estimate_seconds")
    private Long remainingEstimateSeconds = 0L;

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnoreProperties({ "task" })
    private List<WorkLog> workLogs = new ArrayList<>();

    public Task() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEpicColor() {
        return epicColor;
    }

    public void setEpicColor(String epicColor) {
        this.epicColor = epicColor;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getOrderIndex() {
        return orderIndex;
    }

    public void setOrderIndex(Integer orderIndex) {
        this.orderIndex = orderIndex;
    }

    public Long getColumnId() {
        return columnId;
    }

    public void setColumnId(Long columnId) {
        this.columnId = columnId;
    }

    public User getAssignee() {
        return assignee;
    }

    public void setAssignee(User assignee) {
        this.assignee = assignee;
    }

    public User getCoAssignee() {
        return coAssignee;
    }

    public void setCoAssignee(User coAssignee) {
        this.coAssignee = coAssignee;
    }

    public User getReporter() {
        return reporter;
    }

    public void setReporter(User reporter) {
        this.reporter = reporter;
    }

    public Project getProject() {
        return project;
    }

    public void setProject(Project project) {
        this.project = project;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getOriginalStatus() {
        return originalStatus;
    }

    public void setOriginalStatus(String originalStatus) {
        this.originalStatus = originalStatus;
    }

    public String getEnvironment() {
        return environment;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public List<String> getAttachments() {
        return attachments;
    }

    public void setAttachments(List<String> attachments) {
        this.attachments = attachments;
    }

    public Integer getStoryPoints() {
        return storyPoints;
    }

    public void setStoryPoints(Integer storyPoints) {
        this.storyPoints = storyPoints;
    }

    public Sprint getSprint() {
        return sprint;
    }

    public void setSprint(Sprint sprint) {
        this.sprint = sprint;
    }

    public String getIssueType() {
        return issueType;
    }

    public void setIssueType(String issueType) {
        this.issueType = issueType;
    }

    public Task getParentTask() {
        return parentTask;
    }

    public void setParentTask(Task parentTask) {
        this.parentTask = parentTask;
    }

    public List<Task> getSubTasks() {
        return subTasks;
    }

    public void setSubTasks(List<Task> subTasks) {
        this.subTasks = subTasks;
    }

    public List<Comment> getComments() {
        return comments;
    }

    public void setComments(List<Comment> comments) {
        this.comments = comments;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("sprintId")
    public Long getSprintIdProperty() {
        return sprint != null ? sprint.getId() : null;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("projectId")
    public Long getProjectIdProperty() {
        return project != null ? project.getId() : null;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("assigneeId")
    public Long getAssigneeIdProperty() {
        return assignee != null ? assignee.getId() : null;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("coAssigneeId")
    public Long getCoAssigneeIdProperty() {
        return coAssignee != null ? coAssignee.getId() : null;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("reporterId")
    public Long getReporterIdProperty() {
        return reporter != null ? reporter.getId() : null;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("parentId")
    public Long getParentIdProperty() {
        return parentTask != null ? parentTask.getId() : null;
    }

    public Version getFixVersion() { return fixVersion; }
    public void setFixVersion(Version fixVersion) { this.fixVersion = fixVersion; }

    public Version getAffectsVersion() { return affectsVersion; }
    public void setAffectsVersion(Version affectsVersion) { this.affectsVersion = affectsVersion; }

    @com.fasterxml.jackson.annotation.JsonProperty("fixVersionId")
    public Long getFixVersionIdProperty() {
        return fixVersion != null ? fixVersion.getId() : null;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("affectsVersionId")
    public Long getAffectsVersionIdProperty() {
        return affectsVersion != null ? affectsVersion.getId() : null;
    }

    public Long getProjectSequence() {
        return projectSequence;
    }

    public void setProjectSequence(Long projectSequence) {
        this.projectSequence = projectSequence;
    }

    public String getOriginalEstimate() {
        return originalEstimate;
    }

    public void setOriginalEstimate(String originalEstimate) {
        this.originalEstimate = originalEstimate;
        long secs = parseTimeToSeconds(originalEstimate);
        this.originalEstimateSeconds = secs;
        if (this.remainingEstimateSeconds == null || this.remainingEstimateSeconds == 0L) {
            this.remainingEstimateSeconds = secs;
        }
    }

    public Long getOriginalEstimateSeconds() {
        return originalEstimateSeconds;
    }

    public void setOriginalEstimateSeconds(Long originalEstimateSeconds) {
        this.originalEstimateSeconds = originalEstimateSeconds;
    }

    public Long getTimeSpentSeconds() {
        return timeSpentSeconds;
    }

    public void setTimeSpentSeconds(Long timeSpentSeconds) {
        this.timeSpentSeconds = timeSpentSeconds;
    }

    public Long getRemainingEstimateSeconds() {
        return remainingEstimateSeconds;
    }

    public void setRemainingEstimateSeconds(Long remainingEstimateSeconds) {
        this.remainingEstimateSeconds = remainingEstimateSeconds;
    }

    public List<WorkLog> getWorkLogs() {
        return workLogs;
    }

    public void setWorkLogs(List<WorkLog> workLogs) {
        this.workLogs = workLogs;
    }

    public static long parseTimeToSeconds(String timeStr) {
        if (timeStr == null || timeStr.trim().isEmpty()) {
            return 0L;
        }
        long totalSeconds = 0L;
        timeStr = timeStr.trim().toLowerCase();
        
        java.util.regex.Matcher dayMatcher = java.util.regex.Pattern.compile("(\\d+)\\s*d").matcher(timeStr);
        java.util.regex.Matcher hourMatcher = java.util.regex.Pattern.compile("(\\d+)\\s*h").matcher(timeStr);
        java.util.regex.Matcher minMatcher = java.util.regex.Pattern.compile("(\\d+)\\s*m").matcher(timeStr);
        
        if (dayMatcher.find()) {
            totalSeconds += Long.parseLong(dayMatcher.group(1)) * 8 * 3600; // 1d = 8h of work
        }
        if (hourMatcher.find()) {
            totalSeconds += Long.parseLong(hourMatcher.group(1)) * 3600;
        }
        if (minMatcher.find()) {
            totalSeconds += Long.parseLong(minMatcher.group(1)) * 60;
        }
        return totalSeconds;
    }

    public static String formatSecondsToTime(long seconds) {
        if (seconds <= 0) {
            return "0m";
        }
        StringBuilder sb = new StringBuilder();
        long days = seconds / (8 * 3600);
        long remaining = seconds % (8 * 3600);
        long hours = remaining / 3600;
        remaining = remaining % 3600;
        long minutes = remaining / 60;
        
        if (days > 0) {
            sb.append(days).append("d ");
        }
        if (hours > 0) {
            sb.append(hours).append("h ");
        }
        if (minutes > 0) {
            sb.append(minutes).append("m");
        }
        return sb.toString().trim();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
