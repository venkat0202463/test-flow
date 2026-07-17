package com.flowtrack.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "task_histories")
public class TaskHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(name = "change_type")
    private String changeType;

    @Column(name = "from_value")
    private String fromValue;

    @Column(name = "to_value")
    private String toValue;

    @Column(name = "performed_by")
    private String performedBy;

    @Column(name = "comment", length = 1000)
    private String comment;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public TaskHistory() {}

    public TaskHistory(Long taskId, String changeType, String fromValue, String toValue) {
        this.taskId = taskId;
        this.changeType = changeType;
        this.fromValue = fromValue;
        this.toValue = toValue;
        this.performedBy = "System";
        this.createdAt = LocalDateTime.now();
    }

    public TaskHistory(Long taskId, String changeType, String fromValue, String toValue, String performedBy) {
        this.taskId = taskId;
        this.changeType = changeType;
        this.fromValue = fromValue;
        this.toValue = toValue;
        this.performedBy = performedBy;
        this.createdAt = LocalDateTime.now();
    }

    public TaskHistory(Long taskId, String changeType, String fromValue, String toValue, String performedBy, String comment) {
        this.taskId = taskId;
        this.changeType = changeType;
        this.fromValue = fromValue;
        this.toValue = toValue;
        this.performedBy = performedBy;
        this.comment = comment;
        this.createdAt = LocalDateTime.now();
    }

    @JsonProperty("id")
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @JsonProperty("taskId")
    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }

    @JsonProperty("changeType")
    public String getChangeType() { return changeType; }
    public void setChangeType(String changeType) { this.changeType = changeType; }

    @JsonProperty("fromValue")
    public String getFromValue() { return fromValue; }
    public void setFromValue(String fromValue) { this.fromValue = fromValue; }

    @JsonProperty("toValue")
    public String getToValue() { return toValue; }
    public void setToValue(String toValue) { this.toValue = toValue; }

    @JsonProperty("performedBy")
    public String getPerformedBy() { return performedBy; }
    public void setPerformedBy(String performedBy) { this.performedBy = performedBy; }

    @JsonProperty("comment")
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    @JsonProperty("createdAt")
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
