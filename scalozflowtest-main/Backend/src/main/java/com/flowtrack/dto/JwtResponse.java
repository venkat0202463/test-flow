package com.flowtrack.dto;

import java.time.LocalDateTime;

public class JwtResponse {
    private String token;
    private Long id;
    private String name;
    private String email;
    private String role;
    private boolean passwordResetRequired;
    private String department;
    private LocalDateTime createdAt;
    private String empId;

    public JwtResponse(String token, Long id, String name, String email, com.flowtrack.model.Role role, boolean passwordResetRequired, String department, LocalDateTime createdAt, String empId) {
        this.token = token;
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role != null ? role.name() : null;
        this.passwordResetRequired = passwordResetRequired;
        this.department = department;
        this.createdAt = createdAt;
        this.empId = empId;
    }

    public JwtResponse(String token, Long id, String name, String email, String role, boolean passwordResetRequired, String department, LocalDateTime createdAt, String empId) {
        this.token = token;
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.passwordResetRequired = passwordResetRequired;
        this.department = department;
        this.createdAt = createdAt;
        this.empId = empId;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public boolean isPasswordResetRequired() { return passwordResetRequired; }
    public void setPasswordResetRequired(boolean passwordResetRequired) { this.passwordResetRequired = passwordResetRequired; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getEmpId() { return empId; }
    public void setEmpId(String empId) { this.empId = empId; }
}

