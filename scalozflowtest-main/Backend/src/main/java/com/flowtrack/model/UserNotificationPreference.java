package com.flowtrack.model;

import jakarta.persistence.*;

@Entity
@Table(name = "user_notification_preferences")
public class UserNotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    private boolean taskCreated = true;
    private boolean taskAssigned = true;
    private boolean taskReviewDecision = true;
    private boolean taskStatusChanged = true;
    private boolean commentAdded = true;
    private boolean userMentioned = true;
    private boolean dueDateReminder = true;
    private boolean taskOverdue = true;
    private boolean sprintStarted = true;
    private boolean sprintCompleted = true;
    private boolean taskCompleted = true;
    private boolean taskReopened = true;
    private boolean projectInvitation = true;
    private boolean roleChanged = true;

    public UserNotificationPreference() {}

    public UserNotificationPreference(Long userId) {
        this.userId = userId;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public boolean isTaskCreated() { return taskCreated; }
    public void setTaskCreated(boolean taskCreated) { this.taskCreated = taskCreated; }

    public boolean isTaskAssigned() { return taskAssigned; }
    public void setTaskAssigned(boolean taskAssigned) { this.taskAssigned = taskAssigned; }

    public boolean isTaskReviewDecision() { return taskReviewDecision; }
    public void setTaskReviewDecision(boolean taskReviewDecision) { this.taskReviewDecision = taskReviewDecision; }

    public boolean isTaskStatusChanged() { return taskStatusChanged; }
    public void setTaskStatusChanged(boolean taskStatusChanged) { this.taskStatusChanged = taskStatusChanged; }

    public boolean isCommentAdded() { return commentAdded; }
    public void setCommentAdded(boolean commentAdded) { this.commentAdded = commentAdded; }

    public boolean isUserMentioned() { return userMentioned; }
    public void setUserMentioned(boolean userMentioned) { this.userMentioned = userMentioned; }

    public boolean isDueDateReminder() { return dueDateReminder; }
    public void setDueDateReminder(boolean dueDateReminder) { this.dueDateReminder = dueDateReminder; }

    public boolean isTaskOverdue() { return taskOverdue; }
    public void setTaskOverdue(boolean taskOverdue) { this.taskOverdue = taskOverdue; }

    public boolean isSprintStarted() { return sprintStarted; }
    public void setSprintStarted(boolean sprintStarted) { this.sprintStarted = sprintStarted; }

    public boolean isSprintCompleted() { return sprintCompleted; }
    public void setSprintCompleted(boolean sprintCompleted) { this.sprintCompleted = sprintCompleted; }

    public boolean isTaskCompleted() { return taskCompleted; }
    public void setTaskCompleted(boolean taskCompleted) { this.taskCompleted = taskCompleted; }

    public boolean isTaskReopened() { return taskReopened; }
    public void setTaskReopened(boolean taskReopened) { this.taskReopened = taskReopened; }

    public boolean isProjectInvitation() { return projectInvitation; }
    public void setProjectInvitation(boolean projectInvitation) { this.projectInvitation = projectInvitation; }

    public boolean isRoleChanged() { return roleChanged; }
    public void setRoleChanged(boolean roleChanged) { this.roleChanged = roleChanged; }
}
