package com.flowtrack.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "activity_logs")
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "user_name")
    private String userName;

    @Column(name = "action_type")
    private String actionType;

    @Column(name = "entity_type")
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(name = "entity_name")
    private String entityName;

    @Column(name = "from_value")
    private String fromValue;

    @Column(name = "to_value")
    private String toValue;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Transient
    private String debugInfo;

    public ActivityLog() {}

    public ActivityLog(Long projectId, String userId, String userName, String actionType, String entityType, Long entityId, String entityName, String fromValue, String toValue, String message) {
        this.projectId = projectId;
        this.userId = userId;
        this.userName = userName;
        this.actionType = actionType;
        this.entityType = entityType;
        this.entityId = entityId;
        this.entityName = entityName;
        this.fromValue = fromValue;
        this.toValue = toValue;
        this.message = message;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters with explicit JsonProperty for frontend mapping
    @JsonProperty("id")
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @JsonProperty("projectId")
    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    @JsonProperty("userId")
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    @JsonProperty("userName")
    @com.fasterxml.jackson.annotation.JsonAlias("performedBy")
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    @JsonProperty("actionType")
    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    @JsonProperty("entityType")
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    @JsonProperty("entityId")
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long entityId) { this.entityId = entityId; }

    @JsonProperty("entityName")
    public String getEntityName() { return entityName; }
    public void setEntityName(String entityName) { this.entityName = entityName; }

    @JsonProperty("fromValue")
    public String getFromValue() { return fromValue; }
    public void setFromValue(String fromValue) { this.fromValue = fromValue; }

    @JsonProperty("toValue")
    public String getToValue() { return toValue; }
    public void setToValue(String toValue) { this.toValue = toValue; }

    @JsonProperty("message")
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    @JsonProperty("createdAt")
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    @JsonProperty("debugInfo")
    public String getDebugInfo() { return debugInfo; }
    public void setDebugInfo(String debugInfo) { this.debugInfo = debugInfo; }
}
