package com.flowtrack.controller;

import com.flowtrack.model.Role;
import com.flowtrack.model.Tenant;
import com.flowtrack.model.User;
import com.flowtrack.repository.TenantRepository;
import com.flowtrack.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

@RestController
@RequestMapping("/api/integration/sync")
public class IntegrationController {

    private static final Logger log = LoggerFactory.getLogger(IntegrationController.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private PasswordEncoder encoder;

    @Value("${flowtrack.integration.api-key}")
    private String expectedApiKey;

    private boolean isValidApiKey(String apiKey) {
        if (apiKey == null) {
            return false;
        }
        return apiKey.trim().equals(expectedApiKey.trim());
    }

    private String generateRandomPassword() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        Random rnd = new Random();
        StringBuilder sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++) {
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        return sb.toString();
    }

    @PostMapping("/tenant")
    public ResponseEntity<?> syncTenant(
            @RequestHeader(value = "X-API-Key", required = false) String apiKey,
            @RequestBody Map<String, Object> payload) {
        
        log.info("[Integration] Received tenant sync request. Payload: {}", payload);

        if (!isValidApiKey(apiKey)) {
            log.warn("[Integration] Invalid API key provided: {}", apiKey);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Invalid integration API Key"));
        }

        String tenantId = (String) payload.get("tenantId");
        String tenantName = (String) payload.get("tenantName");

        if (tenantId == null || tenantId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "tenantId is required"));
        }

        try {
            Tenant tenant = tenantRepository.findByTenantId(tenantId)
                    .orElse(new Tenant());

            tenant.setTenantId(tenantId);
            tenant.setName(tenantName != null && !tenantName.trim().isEmpty() ? tenantName : tenantId);
            tenant.setSyncStatus("SYNCED");
            tenant.setLastSyncedAt(LocalDateTime.now());
            tenant.setSyncError(null);

            tenantRepository.save(tenant);
            log.info("[Integration] Tenant synced successfully. Tenant ID: {}", tenantId);
            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "message", "Tenant synced successfully",
                    "tenantId", tenantId
            ));
        } catch (Exception e) {
            log.error("[Integration] Failed to sync tenant: " + tenantId, e);
            
            // Attempt to log failure in tenant database record if tenant was loaded
            try {
                Optional<Tenant> existingTenant = tenantRepository.findByTenantId(tenantId);
                if (existingTenant.isPresent()) {
                    Tenant tenant = existingTenant.get();
                    tenant.setSyncStatus("FAILED");
                    tenant.setLastSyncedAt(LocalDateTime.now());
                    tenant.setSyncError(e.getMessage());
                    tenantRepository.save(tenant);
                }
            } catch (Exception ignored) {}

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error syncing tenant: " + e.getMessage()));
        }
    }

    @PostMapping("/user")
    public ResponseEntity<?> syncUser(
            @RequestHeader(value = "X-API-Key", required = false) String apiKey,
            @RequestBody Map<String, Object> payload) {
        
        log.info("[Integration] Received user sync request. Payload: {}", payload);

        if (!isValidApiKey(apiKey)) {
            log.warn("[Integration] Invalid API key provided: {}", apiKey);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Invalid integration API Key"));
        }

        String empId = (String) payload.get("employeeId");
        String email = (String) payload.get("email");
        String firstName = (String) payload.getOrDefault("firstName", "");
        String lastName = (String) payload.getOrDefault("lastName", "");
        String roleStr = (String) payload.get("role");
        String tenantCode = (String) payload.get("tenantCode");
        String tenantName = (String) payload.get("tenantName");
        String rawPassword = (String) payload.get("password");

        if (empId == null || empId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "employeeId is required"));
        }
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "email is required"));
        }

        try {
            // Find or dynamically create/link Tenant
            Tenant tenant = null;
            if (tenantCode != null && !tenantCode.trim().isEmpty()) {
                tenant = tenantRepository.findByTenantId(tenantCode)
                        .orElseGet(() -> {
                            log.info("[Integration] Tenant {} not found, creating on the fly during user sync", tenantCode);
                            Tenant newTenant = new Tenant();
                            newTenant.setTenantId(tenantCode);
                            newTenant.setName(tenantName != null && !tenantName.trim().isEmpty() ? tenantName : tenantCode);
                            newTenant.setSyncStatus("SYNCED");
                            newTenant.setLastSyncedAt(LocalDateTime.now());
                            return tenantRepository.save(newTenant);
                        });
            }

            // Find existing user by empId or email
            User user = userRepository.findByEmpId(empId)
                    .orElseGet(() -> userRepository.findByEmail(email).orElse(new User()));

            String mergedName = (firstName.trim() + " " + lastName.trim()).trim();
            if (mergedName.isEmpty()) {
                mergedName = (String) payload.getOrDefault("name", "User");
            }

            user.setName(mergedName);
            user.setEmail(email);
            user.setEmpId(empId);
            
            // Set/Update role (only for new users)
            if (user.getId() == null) {
                Role mappedRole = Role.USER;
                if (roleStr != null && (roleStr.equalsIgnoreCase("Admin") || 
                                        roleStr.equalsIgnoreCase("Manager") || 
                                        roleStr.equalsIgnoreCase("SubAdmin") || 
                                        roleStr.equalsIgnoreCase("MANAGER"))) {
                    mappedRole = Role.MANAGER;
                }
                if (tenantCode != null && (tenantCode.equals("flow-0002") || tenantCode.equals("flow-0005"))) {
                    mappedRole = Role.MANAGER;
                }
                user.setRole(mappedRole);
            }

            // Set password if provided
            if (rawPassword != null && !rawPassword.trim().isEmpty()) {
                user.setPassword(encoder.encode(rawPassword));
            } else if (user.getPassword() == null) {
                user.setPassword(encoder.encode(generateRandomPassword()));
            }

            // Map Tenant
            user.setTenant(tenant);

            // Set onboardedBy to the MANAGER of this tenant so the user appears in
            // hierarchy-based assignee/member dropdowns (buildHierarchyRecursive).
            // Only set this on new users (i.e., onboardedBy is still null) to avoid
            // overwriting intentional manual assignments.
            if (user.getOnboardedBy() == null && tenant != null) {
                List<User> tenantUsers = userRepository.findByTenant_Id(tenant.getId());
                Optional<User> tenantManager = tenantUsers.stream()
                        .filter(u -> u.getRole() == Role.MANAGER && !u.getEmpId().equals(empId))
                        .findFirst();
                if (tenantManager.isPresent()) {
                    user.setOnboardedBy(tenantManager.get().getId());
                } else {
                    userRepository.findFirstByRoleAndOnboardedByIsNull(Role.ADMIN)
                            .ifPresent(sysAdmin -> user.setOnboardedBy(sysAdmin.getId()));
                }
            }

            // Tracking sync status
            user.setSyncStatus("SYNCED");
            user.setLastSyncedAt(LocalDateTime.now());
            user.setSyncError(null);

            userRepository.save(user);
            log.info("[Integration] User {} synced successfully", empId);

            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "message", "User synced successfully",
                    "employeeId", empId
            ));

        } catch (Exception e) {
            log.error("[Integration] Failed to sync user: " + empId, e);

            // Attempt to track sync failure for existing user
            try {
                Optional<User> existingUser = userRepository.findByEmpId(empId);
                if (existingUser.isPresent()) {
                    User user = existingUser.get();
                    user.setSyncStatus("FAILED");
                    user.setLastSyncedAt(LocalDateTime.now());
                    user.setSyncError(e.getMessage());
                    userRepository.save(user);
                }
            } catch (Exception ignored) {}

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error syncing user: " + e.getMessage()));
        }
    }
}
