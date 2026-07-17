package com.flowtrack.dto;

public class CommentRequest {
    private String content;
    private Long taskId;
    private Long userId;

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
}
