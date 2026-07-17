package com.flowtrack.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('MANAGER')")
public class AdminController {

    @org.springframework.beans.factory.annotation.Value("${spring.mail.username}")
    private String mailUser;

    private Map<String, String> emailConfig = new HashMap<>() {
        {
            put("host", "smtp.gmail.com");
            put("port", "587");
        }
    };

    @GetMapping("/config")
    public ResponseEntity<?> getConfig() {
        Map<String, String> currentConfig = new HashMap<>(emailConfig);
        currentConfig.put("username", mailUser);
        currentConfig.put("fromEmail", mailUser);
        return ResponseEntity.ok(currentConfig);
    }

    @PostMapping("/config")
    public ResponseEntity<?> updateConfig(@RequestBody Map<String, String> newConfig) {
        this.emailConfig.putAll(newConfig);
        return ResponseEntity.ok(Map.of("message", "Configuration synced successfully."));
    }
}
