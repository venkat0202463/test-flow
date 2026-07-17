package com.flowtrack.dto;

import com.flowtrack.model.Task;

public class TaskRequest {
    private Task task;
    private Long projectId;
    private Long assigneeId;
    private Long sprintId;
    private Long parentId;
    private Long coAssigneeId;

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public Long getAssigneeId() {
        return assigneeId;
    }

    public void setAssigneeId(Long assigneeId) {
        this.assigneeId = assigneeId;
    }

    public Long getSprintId() {
        return sprintId;
    }

    public void setSprintId(Long sprintId) {
        this.sprintId = sprintId;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public Long getCoAssigneeId() {
        return coAssigneeId;
    }

    public void setCoAssigneeId(Long coAssigneeId) {
        this.coAssigneeId = coAssigneeId;
    }

    private Long reporterId;
    private Long fixVersionId;
    private Long affectsVersionId;

    public Long getReporterId() {
        return reporterId;
    }

    public void setReporterId(Long reporterId) {
        this.reporterId = reporterId;
    }

    public Long getFixVersionId() {
        return fixVersionId;
    }

    public void setFixVersionId(Long fixVersionId) {
        this.fixVersionId = fixVersionId;
    }

    public Long getAffectsVersionId() {
        return affectsVersionId;
    }

    public void setAffectsVersionId(Long affectsVersionId) {
        this.affectsVersionId = affectsVersionId;
    }
}
