package com.flowtrack.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "users")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "emp_id", nullable = false, unique = true)
    private String empId;

    @Column(nullable = false)
    @JsonIgnore
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private String department = "Engineering Ops";

    @JsonIgnore
    private Integer failedLoginAttempts = 0;
    
    @JsonIgnore
    private LocalDateTime lockoutExpiry;

    private boolean passwordResetRequired = false;
    
    @JsonIgnore
    private String resetToken;
    
    @JsonIgnore
    private LocalDateTime resetTokenExpiry;
    
    private Long onboardedBy;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "tenant_db_id")
    private Tenant tenant;

    @Column(name = "sync_status")
    private String syncStatus;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    @Column(name = "sync_error", columnDefinition = "TEXT")
    private String syncError;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "password_history", joinColumns = @JoinColumn(name = "user_id", referencedColumnName = "emp_id"))
    @Column(name = "password_hash")
    @JsonIgnore
    private java.util.List<String> passwordHistory = new java.util.ArrayList<>();

    private LocalDateTime passwordLastChangedDate = LocalDateTime.now();
    private String lastLoginIp;

    @Column(name = "last_user_agent", columnDefinition = "TEXT")
    private String lastUserAgent;

    public User() {}

    public String getLastLoginIp() { return lastLoginIp; }
    public void setLastLoginIp(String lastLoginIp) { this.lastLoginIp = lastLoginIp; }
    public String getLastUserAgent() { return lastUserAgent; }
    public void setLastUserAgent(String lastUserAgent) { this.lastUserAgent = lastUserAgent; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOnboardedBy() { return onboardedBy; }
    public void setOnboardedBy(Long onboardedBy) { this.onboardedBy = onboardedBy; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getEmpId() { return empId; }
    public void setEmpId(String empId) { this.empId = empId; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Integer getFailedLoginAttempts() { return failedLoginAttempts; }
    public void setFailedLoginAttempts(Integer failedLoginAttempts) { 
        this.failedLoginAttempts = failedLoginAttempts != null ? failedLoginAttempts : 0; 
    }

    public LocalDateTime getLockoutExpiry() { return lockoutExpiry; }
    public void setLockoutExpiry(LocalDateTime lockoutExpiry) { this.lockoutExpiry = lockoutExpiry; }

    public boolean isPasswordResetRequired() { return passwordResetRequired; }
    public void setPasswordResetRequired(boolean passwordResetRequired) { this.passwordResetRequired = passwordResetRequired; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getResetToken() { return resetToken; }
    public void setResetToken(String resetToken) { this.resetToken = resetToken; }

    public LocalDateTime getResetTokenExpiry() { return resetTokenExpiry; }
    public void setResetTokenExpiry(LocalDateTime resetTokenExpiry) { this.resetTokenExpiry = resetTokenExpiry; }

    public java.util.List<String> getPasswordHistory() { return passwordHistory; }
    public void setPasswordHistory(java.util.List<String> passwordHistory) { this.passwordHistory = passwordHistory; }

    public LocalDateTime getPasswordLastChangedDate() { return passwordLastChangedDate; }
    public void setPasswordLastChangedDate(LocalDateTime passwordLastChangedDate) { this.passwordLastChangedDate = passwordLastChangedDate; }

    public Tenant getTenant() { return tenant; }
    public void setTenant(Tenant tenant) { this.tenant = tenant; }

    public String getSyncStatus() { return syncStatus; }
    public void setSyncStatus(String syncStatus) { this.syncStatus = syncStatus; }

    public LocalDateTime getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(LocalDateTime lastSyncedAt) { this.lastSyncedAt = lastSyncedAt; }

    public String getSyncError() { return syncError; }
    public void setSyncError(String syncError) { this.syncError = syncError; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return id != null && id.equals(user.id);
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }
}
