package com.flowtrack.config;

import com.flowtrack.model.Role;
import com.flowtrack.model.User;
import com.flowtrack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @org.springframework.beans.factory.annotation.Value("${flowtrack.admin.email}")
    private String adminEmailConfig;

    @org.springframework.beans.factory.annotation.Value("${flowtrack.admin.password}")
    private String adminPassword;

    @org.springframework.beans.factory.annotation.Value("${flowtrack.admin.empId}")
    private String adminEmpIdConfig;

    @Override
    public void run(String... args) throws Exception {
        // Safe database clean-up of redundant duplicate tables
        try {
            jdbcTemplate.execute("DROP TABLE IF EXISTS task_history");
            System.out.println("CLEANUP: Checked and removed redundant 'task_history' table if present.");
        } catch (Exception e) {
            System.err.println("CLEANUP WARNING: Could not drop 'task_history' table: " + e.getMessage());
        }

        if (adminEmailConfig == null || adminEmailConfig.trim().isEmpty() ||
            adminPassword == null || adminPassword.trim().isEmpty() ||
            adminEmpIdConfig == null || adminEmpIdConfig.trim().isEmpty()) {
            System.out.println("ADMIN CONFIGURATION INCOMPLETE: Skipping production admin initialization.");
            return;
        }

        String adminEmail = adminEmailConfig;
        String adminEmpId = adminEmpIdConfig;
        
        // 1. Find ANY users that might conflict with the intended admin email or ID
        java.util.List<com.flowtrack.model.User> allUsers = userRepository.findAll();
        java.util.List<com.flowtrack.model.User> conflicts = allUsers.stream()
                .filter(u -> adminEmail.equalsIgnoreCase(u.getEmail()) || adminEmpId.equalsIgnoreCase(u.getEmpId()))
                .toList();

        com.flowtrack.model.User admin;
        if (conflicts.isEmpty()) {
            admin = new com.flowtrack.model.User();
            System.out.println("No existing admin found. Creating new.");
        } else {
            // Take the first conflicting user as the primary admin account
            admin = conflicts.get(0);
            System.out.println("Consolidating " + conflicts.size() + " existing accounts into primary admin.");
            
            // Delete other conflicting accounts to prevent integrity violations
            if (conflicts.size() > 1) {
                for (int i = 1; i < conflicts.size(); i++) {
                    userRepository.delete(conflicts.get(i));
                }
            }
        }

        // 2. Force set the correct production credentials and roles
        admin.setName("Project Manager");
        admin.setEmail(adminEmail);
        admin.setEmpId(adminEmpId);
        admin.setRole(Role.ADMIN);
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setLockoutExpiry(null);
        admin.setFailedLoginAttempts(0);
        admin.setPasswordResetRequired(false);
        
        try {
            userRepository.save(admin);
            System.out.println("PRODUCTION ADMIN SYNCED: " + adminEmail + " [" + adminEmpId + "]");
            
            // Reconcile existing users: Assign orphans to the primary manager
            Long adminId = admin.getId();
            userRepository.findAll().forEach(u -> {
                if (u.getOnboardedBy() == null && !u.getId().equals(adminId)) {
                    u.setOnboardedBy(adminId);
                    userRepository.save(u);
                }
            });
        } catch (Exception e) {
            System.err.println("CRITICAL ERROR DURING ADMIN SYNC: " + e.getMessage());
        }
    }
}
