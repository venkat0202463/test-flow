package com.flowtrack.dto;

public class LoginRequest {
    private String identifier;
    private String password;

    public String getIdentifier() { return identifier; }
    public void setIdentifier(String identifier) { this.identifier = identifier; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    // Keep getEmail for backward compatibility if needed, but identifier is better
    public String getEmail() { return identifier; }
    public void setEmail(String email) { this.identifier = email; }
}
