
package com.flowtrack.controller;

import com.flowtrack.dto.JwtResponse;
import com.flowtrack.dto.LoginRequest;
import com.flowtrack.dto.SignupRequest;
import com.flowtrack.model.Role;
import com.flowtrack.model.User;
import com.flowtrack.repository.UserRepository;
import com.flowtrack.security.JwtUtils;
import com.flowtrack.security.LoginAttemptService;
import com.flowtrack.security.UserDetailsImpl;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.TaskRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.Keys;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UserRepository userRepository;

    @Autowired
    com.flowtrack.repository.TenantRepository tenantRepository;

    @Autowired
    ProjectRepository projectRepository;

    @Autowired
    TaskRepository taskRepository;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    private com.flowtrack.service.TaskEmailService taskEmailService;

    @Autowired
    org.springframework.mail.javamail.JavaMailSender mailSender;

    @Autowired
    JwtUtils jwtUtils;

    @Autowired
    LoginAttemptService loginAttemptService;

    @Autowired
    com.flowtrack.repository.NotificationRepository notificationRepository;

    @Autowired
    jakarta.servlet.http.HttpServletRequest request;

    @Autowired
    com.flowtrack.repository.LoginLogRepository loginLogRepository;

    @org.springframework.beans.factory.annotation.Value("${flowtrack.frontend.url}")
    private String frontendUrl;

    @org.springframework.beans.factory.annotation.Value("${spring.mail.username}")
    private String fromEmail;

    private static final int MAX_FAILED_ATTEMPTS = 3;
    private static final int LOCKOUT_DURATION_MINUTES = 15;
    private static final String COMPLEXITY_PATTERN = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!])(?=\\S+$).{8,}$";
    private static final java.util.Set<String> COMMON_PASSWORDS = java.util.Set.of(
        "password123", "12345678", "qwertyuiop", "password", "welcome123", "123456789", "flowtrack", "flowtrack123"
    );

    private boolean isCommonPassword(String password) {
        if (password == null) return false;
        String lower = password.toLowerCase();
        return COMMON_PASSWORDS.contains(lower);
    }

    /**
     * Returns true if the user has full administrative privileges.
     * This is determined purely by the ADMIN role — no hardcoded credentials.
     */
    private boolean isAdmin(User user) {
        if (user == null) return false;
        return user.getRole() == com.flowtrack.model.Role.ADMIN;
    }

    private String generateRandomPassword() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        java.util.Random rnd = new java.util.Random();
        StringBuilder sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++)
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        return sb.toString();
    }

    private void sendEmail(String to, String subject, String text) {
        if (mailSender == null)
            return;
        new Thread(() -> {
            try {
                org.springframework.mail.SimpleMailMessage msg = new org.springframework.mail.SimpleMailMessage();
                msg.setFrom(fromEmail);
                msg.setTo(to);
                msg.setSubject(subject);
                msg.setText(text);
                mailSender.send(msg);
            } catch (Exception e) {
                System.err.println("Failed to send email: " + e.getMessage());
            }
        }).start();
    }

    private boolean isPasswordReused(User user, String newPassword) {
        for (String oldHash : user.getPasswordHistory()) {
            if (encoder.matches(newPassword, oldHash)) {
                return true;
            }
        }
        return false;
    }

    private void updatePasswordHistory(User user, String newPasswordHash) {
        java.util.List<String> history = user.getPasswordHistory();
        history.add(newPasswordHash);
        if (history.size() > 5) {
            history.remove(0); // keep last 5
        }
        user.setPasswordHistory(history);
        user.setPasswordLastChangedDate(LocalDateTime.now());
    }

    private String getClientIP() {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null)
            return request.getRemoteAddr();
        return xfHeader.split(",")[0];
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestBody LoginRequest loginRequest) {
        String ip = getClientIP();
        if (loginAttemptService.isBlocked(ip)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("message", "Too many login attempts. Please try again after 15 minutes."));
        }

        Optional<User> userOpt = userRepository.findByEmailOrEmpId(loginRequest.getIdentifier(),
                loginRequest.getIdentifier());

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getLockoutExpiry() != null && user.getLockoutExpiry().isAfter(LocalDateTime.now())) {
                return ResponseEntity.status(HttpStatus.LOCKED)
                        .body(Map.of("message", "Invalid email or password"));
            }
            if (user.getPasswordLastChangedDate() != null
                    && user.getPasswordLastChangedDate().isBefore(LocalDateTime.now().minusDays(90))) {
                user.setPasswordResetRequired(true);
            }
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getIdentifier(), loginRequest.getPassword()));

            SecurityContextHolder.getContext().setAuthentication(authentication);
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            ResponseCookie jwtCookie = jwtUtils.generateJwtCookie(userDetails);

            // Reset failed attempts on success
            loginAttemptService.loginSucceeded(ip);
            User user = userOpt.get();
            user.setFailedLoginAttempts(0);
            user.setLockoutExpiry(null);
            userRepository.save(user);

            String userAgent = request.getHeader("User-Agent");
            boolean isNewDevice = user.getLastUserAgent() != null && !user.getLastUserAgent().equals(userAgent);

            if (isNewDevice) {
                sendEmail(user.getEmail(), "FlowTrack: Security Alert - New Device Detected",
                        "A new login was detected on your ScalozFlowaccount from a new device/browser.\n\n" +
                                "Device: " + userAgent + "\n" +
                                "IP Address: " + ip + "\n\n" +
                                "If this wasn't you, please reset your password immediately.");
            }

            user.setLastLoginIp(ip);
            user.setLastUserAgent(userAgent);
            userRepository.save(user);

            // Log successful login
            loginLogRepository
                    .save(new com.flowtrack.model.LoginLog(user.getEmpId(), user.getEmail(), ip, userAgent, true, null));

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, jwtCookie.toString())
                    .body(new JwtResponse(jwtCookie.getValue(),
                            userDetails.getId(),
                            userDetails.getName(),
                            userDetails.getEmail(),
                            userDetails.getRole(),
                            user.isPasswordResetRequired(),
                            user.getDepartment(),
                            user.getCreatedAt(),
                            user.getEmpId()));
        } catch (BadCredentialsException e) {
            loginAttemptService.loginFailed(ip);
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                int attempts = user.getFailedLoginAttempts() + 1;
                user.setFailedLoginAttempts(attempts);

                if (attempts >= MAX_FAILED_ATTEMPTS) {
                    user.setLockoutExpiry(LocalDateTime.now().plusMinutes(LOCKOUT_DURATION_MINUTES));
                    userRepository.save(user);
                    sendEmail(user.getEmail(), "FlowTrack: Account Locked",
                            "Your account has been locked due to 3 failed login attempts. It will automatically unlock in 15 minutes.");
                    return ResponseEntity.status(HttpStatus.LOCKED)
                            .body(Map.of("message", "Invalid email or password"));
                }
                userRepository.save(user);
                // Log failed login
                loginLogRepository.save(new com.flowtrack.model.LoginLog(user.getEmpId(), user.getEmail(), ip,
                        request.getHeader("User-Agent"), false, "Invalid Credentials"));
            } else {
                // Log failed login for non-existent user
                loginLogRepository.save(new com.flowtrack.model.LoginLog(null, loginRequest.getIdentifier(), ip,
                        request.getHeader("User-Agent"), false, "User Not Found"));
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid email or password"));
        } catch (Exception e) {
            System.err.println("CRITICAL: Authentication system error: " + e.getMessage());
            e.printStackTrace();
            loginAttemptService.loginFailed(ip);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "An internal error occurred. Please check system logs."));
        }
    }

    @Value("${scaloz.workspace.jwtSecret}")
    private String workspaceJwtSecret;

    @Value("${scaloz.workspace.allowedApps:}")
    private String allowedAppsProperty;

    @PostMapping("/sso")
    public ResponseEntity<?> authenticateSSO(@RequestBody Map<String, String> requestPayload) {
        String token = requestPayload.get("token");
        if (token == null || token.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "SSO token is required"));
        }

        try {
            byte[] secretBytes;
            String cleanSecret = workspaceJwtSecret.trim();
            if (cleanSecret.matches("^[0-9a-fA-F]+$") && cleanSecret.length() % 2 == 0) {
                secretBytes = java.util.HexFormat.of().parseHex(cleanSecret);
            } else {
                secretBytes = cleanSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            }
            Claims claims;
            try {
                javax.crypto.SecretKey key = Keys.hmacShaKeyFor(secretBytes);
                claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            } catch (JwtException | IllegalArgumentException firstEx) {
                // Fallback: try raw string bytes if hex parsing was used
                if (cleanSecret.matches("^[0-9a-fA-F]+$") && cleanSecret.length() % 2 == 0) {
                    System.out.println("[SSO Debug] Hex key validation failed, trying raw string key fallback...");
                    byte[] fallbackBytes = cleanSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    javax.crypto.SecretKey fallbackKey = Keys.hmacShaKeyFor(fallbackBytes);
                    claims = Jwts.parser().verifyWith(fallbackKey).build().parseSignedClaims(token).getPayload();
                } else {
                    throw firstEx;
                }
            }

            String email = claims.getSubject();
            String employeeId = claims.get("employeeId", String.class);

            System.out.println("[SSO Debug] Parsed claims: email=" + email + ", employeeId=" + employeeId);

            if (employeeId != null) {
                employeeId = employeeId.trim();
                String lowerEmpId = employeeId.toLowerCase();
                if (lowerEmpId.startsWith("xevyte-technologies_")) {
                    employeeId = "xevyte-0001_" + employeeId.substring("xevyte-technologies_".length());
                    System.out.println("[SSO Debug] Mapped employeeId to: " + employeeId);
                }
            }

            if ((email == null || email.trim().isEmpty()) && (employeeId == null || employeeId.trim().isEmpty())) {
                System.err.println("[SSO Debug] Error: both email and employeeId claims are null/empty.");
                return ResponseEntity.badRequest().body(Map.of("message", "Invalid SSO token claims"));
            }

            Optional<User> userOpt = Optional.empty();
            if (employeeId != null) {
                userOpt = userRepository.findByEmpId(employeeId);
                System.out.println("[SSO Debug] Lookup by empId (" + employeeId + ") found user: " + userOpt.isPresent());
            }
            if (!userOpt.isPresent() && email != null) {
                userOpt = userRepository.findByEmailIgnoreCase(email.trim());
                System.out.println("[SSO Debug] Lookup by email (" + email + ") found user: " + userOpt.isPresent());
            }

            User user;
            if (!userOpt.isPresent()) {
                System.out.println("[SSO Debug] User not found. Attempting auto-provisioning...");
                // Dynamically provision the user if they have access to the FlowTrack application
                boolean hasAppAccess = false;
                Object apps = claims.get("apps");
                System.out.println("[SSO Debug] Allowed apps in claim: " + apps);
                
                java.util.Set<String> allowedAppSet = new java.util.HashSet<>();
                if (allowedAppsProperty != null && !allowedAppsProperty.trim().isEmpty()) {
                    for (String app : allowedAppsProperty.split(",")) {
                        allowedAppSet.add(app.toLowerCase().replace("-", "").replace("_", "").trim());
                    }
                } else {
                    System.err.println("[SSO Debug] WARNING: scaloz.workspace.allowedApps property is empty/not configured. User app access checks will fail.");
                }

                if (apps instanceof java.util.List) {
                    java.util.List<?> appsList = (java.util.List<?>) apps;
                    for (Object appObj : appsList) {
                        if (appObj != null) {
                            String app = appObj.toString().toLowerCase().replace("-", "").replace("_", "").trim();
                            if (allowedAppSet.contains(app)) {
                                hasAppAccess = true;
                                break;
                            }
                        }
                    }
                } else if (apps instanceof String) {
                    String appsStr = (String) apps;
                    String[] appsArr = appsStr.split(",");
                    for (String appRaw : appsArr) {
                        String app = appRaw.toLowerCase().replace("-", "").replace("_", "").trim();
                        if (allowedAppSet.contains(app)) {
                            hasAppAccess = true;
                            break;
                        }
                    }
                }
                
                String roleStr = claims.get("role", String.class);
                boolean isWorkspaceAdmin = roleStr != null && (roleStr.equalsIgnoreCase("Admin") || 
                                                              roleStr.equalsIgnoreCase("SuperAdmin") || 
                                                              roleStr.equalsIgnoreCase("Super Admin") || 
                                                              roleStr.equalsIgnoreCase("SUPER_ADMIN"));
                
                if (hasAppAccess || isWorkspaceAdmin) {
                    System.out.println("SSO provisioning user: " + email + " / " + employeeId);
                    
                    String tenantId = claims.get("tenantId", String.class);
                    if (tenantId == null) tenantId = claims.get("tenant", String.class);
                    if (tenantId != null) {
                        tenantId = tenantId.trim();
                        if ("xevyte-technologies".equalsIgnoreCase(tenantId)) {
                            tenantId = "xevyte-0001";
                        }
                    }
                    String tenantName = claims.get("tenantName", String.class);
                    System.out.println("[SSO Debug] Provisioning details: tenantId=" + tenantId + ", tenantName=" + tenantName);
                    
                    com.flowtrack.model.Tenant tenant = null;
                    if (tenantId != null && !tenantId.trim().isEmpty()) {
                        final String finalTenantId = tenantId;
                        final String finalTenantName = tenantName;
                        tenant = tenantRepository.findByTenantId(tenantId)
                                .orElseGet(() -> {
                                    System.out.println("[SSO Debug] Tenant " + finalTenantId + " not found. Creating tenant...");
                                    com.flowtrack.model.Tenant newTenant = new com.flowtrack.model.Tenant();
                                    newTenant.setTenantId(finalTenantId);
                                    newTenant.setName(finalTenantName != null ? finalTenantName : finalTenantId);
                                    newTenant.setSyncStatus("SYNCED");
                                    newTenant.setLastSyncedAt(LocalDateTime.now());
                                    return tenantRepository.save(newTenant);
                                });
                    }

                    User newUser = new User();
                    newUser.setEmail(email);
                    newUser.setEmpId(employeeId != null ? employeeId : email);
                    String name = claims.get("name", String.class);
                    if (name == null) {
                        String fName = claims.get("firstName", String.class);
                        String lName = claims.get("lastName", String.class);
                        name = ((fName != null ? fName : "") + " " + (lName != null ? lName : "")).trim();
                        if (name.isEmpty()) name = "User";
                    }
                    newUser.setName(name);
                    newUser.setPassword(encoder.encode(UUID.randomUUID().toString()));
                    newUser.setPasswordResetRequired(false);
                    
                    // Map workspace role to FlowTrack role:
                    //   Workspace "Admin"/"SuperAdmin" → FlowTrack ADMIN  (full management access)
                    //   Workspace "Manager"/"SubAdmin" → FlowTrack MANAGER (onboard users, edit own)
                    //   Everything else               → FlowTrack USER
                    com.flowtrack.model.Role mappedRole = com.flowtrack.model.Role.USER;
                    if (roleStr != null && (roleStr.equalsIgnoreCase("Admin") ||
                                           roleStr.equalsIgnoreCase("SuperAdmin") ||
                                           roleStr.equalsIgnoreCase("Super Admin") ||
                                           roleStr.equalsIgnoreCase("SUPER_ADMIN"))) {
                        mappedRole = com.flowtrack.model.Role.ADMIN;
                    } else if (roleStr != null && (roleStr.equalsIgnoreCase("Manager") ||
                                                   roleStr.equalsIgnoreCase("SubAdmin"))) {
                        mappedRole = com.flowtrack.model.Role.MANAGER;
                    }
                    newUser.setRole(mappedRole);
                    newUser.setTenant(tenant);
                    newUser.setSyncStatus("SYNCED");
                    newUser.setLastSyncedAt(LocalDateTime.now());
                    
                    user = userRepository.save(newUser);
                    System.out.println("[SSO Debug] Successfully provisioned new user ID: " + user.getId());
                } else {
                    System.err.println("[SSO Debug] Unauthorized: User does not have access to Scaloz Flow product. apps=" + apps);
                    try {
                        String ip = getClientIP();
                        String userAgent = request.getHeader("User-Agent");
                        loginLogRepository.save(new com.flowtrack.model.LoginLog(
                                employeeId, email, ip, userAgent, false, "No access to Scaloz Flow product (allowed apps: " + apps + ")"
                        ));
                    } catch (Exception logEx) {
                        System.err.println("Failed to save login log: " + logEx.getMessage());
                    }
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("message", "User does not have access to Scaloz Flow product."));
                }
            } else {
                user = userOpt.get();
                System.out.println("[SSO Debug] User found: ID=" + user.getId() + ", Email=" + user.getEmail() + ", Role=" + user.getRole());
                
                // Sync the tenant on every SSO login in case it changed or was empty
                String tenantId = claims.get("tenantId", String.class);
                if (tenantId == null) tenantId = claims.get("tenant", String.class);
                if (tenantId != null) {
                    tenantId = tenantId.trim();
                    if ("xevyte-technologies".equalsIgnoreCase(tenantId)) {
                        tenantId = "xevyte-0001";
                    }
                    
                    final String finalTenantId = tenantId;
                    String tenantName = claims.get("tenantName", String.class);
                    final String finalTenantName = tenantName;
                    
                    com.flowtrack.model.Tenant tenant = tenantRepository.findByTenantId(tenantId)
                            .orElseGet(() -> {
                                System.out.println("[SSO Debug] Tenant " + finalTenantId + " not found. Creating tenant...");
                                com.flowtrack.model.Tenant newTenant = new com.flowtrack.model.Tenant();
                                newTenant.setTenantId(finalTenantId);
                                newTenant.setName(finalTenantName != null ? finalTenantName : finalTenantId);
                                newTenant.setSyncStatus("SYNCED");
                                newTenant.setLastSyncedAt(LocalDateTime.now());
                                return tenantRepository.save(newTenant);
                            });
                    
                    if (user.getTenant() == null || !user.getTenant().getId().equals(tenant.getId())) {
                        System.out.println("[SSO Debug] Syncing user tenant to " + tenant.getTenantId());
                        user.setTenant(tenant);
                    }
                }

                // SSO users authenticate via the workspace — they never set a local password.
                // Always clear passwordResetRequired so the frontend doesn't redirect them
                // to /reset-password (which bounces them back to the workspace in a loop).
                if (user.isPasswordResetRequired()) {
                    System.out.println("[SSO Debug] Clearing passwordResetRequired flag for SSO user: " + user.getEmail());
                    user.setPasswordResetRequired(false);
                }
                userRepository.save(user);
            }

            UserDetailsImpl userDetails = UserDetailsImpl.build(user);
            ResponseCookie jwtCookie = jwtUtils.generateJwtCookie(userDetails);

            String ip = getClientIP();
            String userAgent = request.getHeader("User-Agent");
            loginLogRepository.save(new com.flowtrack.model.LoginLog(
                    user.getEmpId(), user.getEmail(), ip, userAgent, true, "SSO Redirected from Scaloz Workspace"
            ));

            System.out.println("[SSO Debug] SSO Authentication successful for user: " + user.getEmail());

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, jwtCookie.toString())
                    .body(new JwtResponse(jwtCookie.getValue(),
                            userDetails.getId(),
                            userDetails.getName(),
                            userDetails.getEmail(),
                            userDetails.getRole(),
                            user.isPasswordResetRequired(),
                            user.getDepartment(),
                            user.getCreatedAt(),
                            user.getEmpId()));

        } catch (JwtException | IllegalArgumentException e) {
            System.err.println("[SSO Debug] SSO token validation failed: " + e.getMessage());
            e.printStackTrace();
            try {
                String ip = getClientIP();
                String userAgent = request.getHeader("User-Agent");
                loginLogRepository.save(new com.flowtrack.model.LoginLog(
                        null, "SSO_TOKEN_INVALID", ip, userAgent, false, "SSO token validation failed: " + e.getMessage()
                ));
            } catch (Exception logEx) {
                System.err.println("Failed to save login log: " + logEx.getMessage());
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid SSO token: " + e.getMessage()));
        } catch (Exception e) {
            System.err.println("[SSO Debug] SSO authentication encountered an unexpected error: " + e.getMessage());
            e.printStackTrace();
            try {
                String ip = getClientIP();
                String userAgent = request.getHeader("User-Agent");
                loginLogRepository.save(new com.flowtrack.model.LoginLog(
                        null, "SSO_SYSTEM_ERROR", ip, userAgent, false, "SSO system error: " + e.getMessage()
                ));
            } catch (Exception logEx) {
                System.err.println("Failed to save login log: " + logEx.getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "SSO internal error: " + e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logoutUser() {
        String token = jwtUtils.getJwtFromCookies(request);
        jwtUtils.blacklistToken(token);
        ResponseCookie cookie = jwtUtils.getCleanJwtCookie();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(Map.of("message", "You've been signed out!"));
    }


    @GetMapping("/system-stats")
    public ResponseEntity<?> getSystemStats() {
        long users = userRepository.count();
        long projects = projectRepository.count();
        long deliveredTasks = 0; // Simplified for migration

        return ResponseEntity.ok(Map.of(
                "members", users,
                "projects", projects,
                "deliveredTasks", deliveredTasks));
    }

    @PostMapping("/onboard")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<?> onboardUser(@RequestBody SignupRequest signupRequest) {
        if (userRepository.existsByEmail(signupRequest.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Collaborator already exists with this email."));
        }

        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> managerOpt = userRepository.findByEmail(currentEmail);
        if (managerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "User context error."));
        }
        User manager = managerOpt.get();

        String tenantPrefix = "";
        if (manager.getTenant() != null && manager.getTenant().getTenantId() != null) {
            tenantPrefix = manager.getTenant().getTenantId() + "_";
        }

        String inputEmpId = signupRequest.getEmpId();
        String finalEmpId = inputEmpId;
        if (!tenantPrefix.isEmpty() && !inputEmpId.startsWith(tenantPrefix)) {
            finalEmpId = tenantPrefix + inputEmpId;
        }

        if (userRepository.existsByEmpId(finalEmpId)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Collaborator already exists with this Employee ID."));
        }

        // Role assignment rules:
        //   ADMIN can onboard any role (ADMIN / MANAGER / USER)
        //   MANAGER can only onboard USER role
        String requestedRole = signupRequest.getRole();
        boolean currentIsAdmin = isAdmin(manager);

        if (!currentIsAdmin && !Role.USER.name().equals(requestedRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Managers can only onboard users. Only an Admin can onboard Managers or other Admins."));
        }

        String tempPassword = generateRandomPassword();
        User user = new User();
        user.setName(signupRequest.getName());
        user.setEmail(signupRequest.getEmail());
        user.setEmpId(finalEmpId);
        user.setRole(Role.valueOf(signupRequest.getRole()));
        user.setPassword(encoder.encode(tempPassword));
        user.setPasswordResetRequired(true);
        user.setOnboardedBy(manager.getId());
        user.setTenant(manager.getTenant());

        userRepository.save(user);

        // Create notification for the new user
        try {
            com.flowtrack.model.Notification welcomeNotif = new com.flowtrack.model.Notification(
                    user.getEmpId(),
                    "SYSTEM ACCESS",
                    "Welcome to ScalozFlow! Your account is active. Please reset your password to proceed.",
                    "info");
            notificationRepository.save(welcomeNotif);
        } catch (Exception e) {
            System.err.println("Failed to create welcome notification: " + e.getMessage());
        }

        // Refined Onboarding Sequence with ScalozFlowBranding
        new Thread(() -> {
            try {
                jakarta.mail.internet.MimeMessage mimeMessage = mailSender.createMimeMessage();
                org.springframework.mail.javamail.MimeMessageHelper helper = new org.springframework.mail.javamail.MimeMessageHelper(
                        mimeMessage, "utf-8");

                String htmlMsg = " <div style='font-family: \"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #172B4D; max-width: 600px; border: 2px solid #0052CC; border-radius: 16px; padding: 32px; margin: 20px auto; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>"
                        + "<h2 style='color: #0052CC; margin-top: 0;'>Welcome to ScalozFlow!</h2>"
                        + "<p>Dear <strong>" + user.getName() + "</strong>,</p>"
                        + "<p>Congratulations and welcome to <strong>ScalozFlow</strong>! We're excited to have you onboard.</p>"
                        + "<p>Your onboarding process has been successfully completed. Below are your credentials to access the <strong>ScalozFlow Project Management Portal</strong>:</p>"
                        + "<div style='background: #F4F5F7; padding: 24px; border-left: 4px solid #0052CC; border-radius: 8px; margin: 24px 0;'>"
                        + "<p style='margin: 8px 0; font-size: 14px;'><strong>Email:</strong> <span style='color: #0052CC;'>"
                        + user.getEmail() + "</span></p>"
                        + "<p style='margin: 8px 0; font-size: 14px;'><strong>Employee ID:</strong> <span style='color: #0052CC;'>"
                        + inputEmpId + "</span></p>"
                        + "<p style='margin: 8px 0; font-size: 14px;'><strong>Portal Link:</strong> <a href='"
                        + frontendUrl + "' style='color: #0052CC; text-decoration: none; font-weight: bold;'>"
                        + frontendUrl + "</a></p>"
                        + "<p style='margin: 8px 0; font-size: 14px;'><strong>Temporary Password:</strong> <code style='background: #EBECF0; padding: 4px 8px; border-radius: 4px; color: #BF2600; font-weight: bold;'>"
                        + tempPassword + "</code></p>"
                        + "</div>"
                        + "<p style='font-weight: bold; margin-bottom: 12px;'>👉 Next Steps:</p>"
                        + "<ol style='padding-left: 20px;'>"
                        + "<li style='margin-bottom: 8px;'>Log in to the portal using the credentials above.</li>"
                        + "<li style='margin-bottom: 8px;'>You'll be prompted to change your password for security purposes.</li>"
                        + "<li style='margin: 8px;'>Complete your remaining profile details and start managing your tasks, projects, and workflows efficiently.</li>"
                        + "</ol>"
                        + "<p style='margin-top: 24px; border-top: 1px solid #DFE1E6; pt: 16px; font-size: 13px; color: #5E6C84;'>"
                        + "If you face any login issues, please contact us at <a href='mailto:admin@xevyte.com' style='color: #0052CC;'>admin@xevyte.com</a>."
                        + "</p>"
                        + "<p style='margin-top: 16px; font-weight: bold;'>"
                        + "Best regards,<br>"
                        + "<span style='color: #0052CC;'>ScalozFlow Team</span>"
                        + "</p>"
                        + "</div>";

                helper.setText(htmlMsg, true);
                helper.setTo(user.getEmail());
                helper.setSubject("FlowTrack: Your Onboarding Credentials");
                helper.setFrom(fromEmail);

                mailSender.send(mimeMessage);
            } catch (Exception e) {
                System.err.println("Onboarding email failure: " + e.getMessage());
            }
        }).start();

        return ResponseEntity.ok(Map.of("message", "Collaborator onboarded and credentials transmitted."));
    }

    @GetMapping("/users")
    @org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getAllUsers(@RequestParam(required = false) Long projectId) {
        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> currentUserOpt = userRepository.findByEmail(currentEmail);
        if (currentUserOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "User context error."));
        }
        User currentUser = currentUserOpt.get();

        if (projectId != null) {
            Optional<com.flowtrack.model.Project> projectOpt = projectRepository.findById(projectId);
            if (projectOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            com.flowtrack.model.Project project = projectOpt.get();

            if (currentUser.getRole() == com.flowtrack.model.Role.USER) {
                boolean isMember = (project.getCreatedBy() != null && project.getCreatedBy().getId().equals(currentUser.getId())) ||
                                   project.getTeamMembers().stream().anyMatch(m -> m.getId().equals(currentUser.getId()));
                if (!isMember) {
                    return ResponseEntity.ok(java.util.Collections.emptyList());
                }
                java.util.Set<User> projectUsers = new java.util.HashSet<>();
                projectUsers.add(currentUser);
                projectUsers.addAll(project.getTeamMembers());
                if (project.getCreatedBy() != null) {
                    projectUsers.add(project.getCreatedBy());
                }

                // Also include all users in the same tenant (synced from Workspace)
                if (currentUser.getTenant() != null) {
                    java.util.List<User> tenantMates = userRepository.findByTenant_Id(currentUser.getTenant().getId());
                    projectUsers.addAll(tenantMates);
                }

                return ResponseEntity.ok(projectUsers);
            } else if (currentUser.getRole() == com.flowtrack.model.Role.MANAGER) {
                java.util.Set<Long> hierarchyIds = new java.util.HashSet<>();
                hierarchyIds.add(currentUser.getId());
                java.util.List<User> allDbUsers = userRepository.findAll();
                buildHierarchyRecursive(currentUser.getId(), allDbUsers, hierarchyIds);

                boolean hasAccess = (project.getCreatedBy() != null && project.getCreatedBy().getId().equals(currentUser.getId())) ||
                                     project.getTeamMembers().stream().anyMatch(m -> m.getId().equals(currentUser.getId())) ||
                                     (project.getCreatedBy() != null && hierarchyIds.contains(project.getCreatedBy().getId())) ||
                                     project.getTeamMembers().stream().anyMatch(m -> hierarchyIds.contains(m.getId()));

                if (!hasAccess) {
                    return ResponseEntity.ok(java.util.Collections.emptyList());
                }

                java.util.Set<User> projectUsers = new java.util.HashSet<>();
                projectUsers.addAll(project.getTeamMembers());
                if (project.getCreatedBy() != null) {
                    projectUsers.add(project.getCreatedBy());
                }

                // Also include all users in the same tenant (synced from Workspace)
                if (currentUser.getTenant() != null) {
                    java.util.List<User> tenantMates = userRepository.findByTenant_Id(currentUser.getTenant().getId());
                    projectUsers.addAll(tenantMates);
                }

                // Also include hierarchy users
                for (User u : allDbUsers) {
                    if (hierarchyIds.contains(u.getId())) {
                        projectUsers.add(u);
                    }
                }

                return ResponseEntity.ok(projectUsers);
            } else {
                // ADMIN role
                java.util.Set<User> projectUsers = new java.util.HashSet<>();
                projectUsers.addAll(project.getTeamMembers());
                if (project.getCreatedBy() != null) {
                    projectUsers.add(project.getCreatedBy());
                }

                // Also include all users in the same tenant (synced from Workspace)
                if (currentUser.getTenant() != null) {
                    java.util.List<User> tenantMates = userRepository.findByTenant_Id(currentUser.getTenant().getId());
                    projectUsers.addAll(tenantMates);
                } else {
                    projectUsers.addAll(userRepository.findAll());
                }

                return ResponseEntity.ok(projectUsers);
            }
        }

        if (currentUser.getRole() == com.flowtrack.model.Role.USER) {
            java.util.Set<User> visibleUsers = new java.util.HashSet<>();
            visibleUsers.add(currentUser);

            java.util.List<com.flowtrack.model.Project> userProjects = new java.util.ArrayList<>();
            userProjects.addAll(projectRepository.findByCreatedById(currentUser.getId()));
            userProjects.addAll(projectRepository.findByMemberId(currentUser.getId()));

            for (com.flowtrack.model.Project p : userProjects) {
                visibleUsers.addAll(p.getTeamMembers());
                if (p.getCreatedBy() != null) {
                    visibleUsers.add(p.getCreatedBy());
                }
            }

            // Also include all users in the same tenant (synced from Workspace)
            if (currentUser.getTenant() != null) {
                java.util.List<User> tenantMates = userRepository.findByTenant_Id(currentUser.getTenant().getId());
                visibleUsers.addAll(tenantMates);
            }

            return ResponseEntity.ok(visibleUsers);
        } else if (currentUser.getRole() == com.flowtrack.model.Role.MANAGER) {
            java.util.Set<Long> hierarchyIds = new java.util.HashSet<>();
            hierarchyIds.add(currentUser.getId());
            java.util.List<User> allDbUsers = userRepository.findAll();
            buildHierarchyRecursive(currentUser.getId(), allDbUsers, hierarchyIds);

            java.util.Set<User> visibleUsers = new java.util.HashSet<>();
            for (User u : allDbUsers) {
                if (hierarchyIds.contains(u.getId())) {
                    visibleUsers.add(u);
                }
            }

            // Also include all users in the same tenant (synced from Workspace)
            // so they appear in assignee/member dropdowns even without an onboardedBy link
            if (currentUser.getTenant() != null) {
                java.util.List<User> tenantMates = userRepository.findByTenant_Id(currentUser.getTenant().getId());
                visibleUsers.addAll(tenantMates);
            }

            java.util.List<com.flowtrack.model.Project> managerProjects = new java.util.ArrayList<>();
            for (Long hId : hierarchyIds) {
                managerProjects.addAll(projectRepository.findByCreatedById(hId));
                managerProjects.addAll(projectRepository.findByMemberId(hId));
            }

            for (com.flowtrack.model.Project p : managerProjects) {
                visibleUsers.addAll(p.getTeamMembers());
                if (p.getCreatedBy() != null) {
                    visibleUsers.add(p.getCreatedBy());
                }
            }

            return ResponseEntity.ok(visibleUsers);
        } else {
            // ADMIN role
            java.util.Set<User> visibleUsers = new java.util.HashSet<>();
            if (currentUser.getTenant() != null) {
                visibleUsers.addAll(userRepository.findByTenant_Id(currentUser.getTenant().getId()));
            } else {
                visibleUsers.addAll(userRepository.findAll());
            }
            return ResponseEntity.ok(visibleUsers);
        }
    }

    private void buildHierarchyRecursive(Long parentId, java.util.List<User> allUsers, java.util.Set<Long> hierarchyIds) {
        for (User u : allUsers) {
            if (u.getOnboardedBy() != null && parentId.equals(u.getOnboardedBy())) {
                if (hierarchyIds.add(u.getId())) {
                    buildHierarchyRecursive(u.getId(), allUsers, hierarchyIds);
                }
            }
        }
    }

    @DeleteMapping("/users/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        System.out.println("DELETION ATTEMPT BY: " + currentEmail + " ON USER ID: " + id);
        Optional<User> currentUserOpt = userRepository.findByEmail(currentEmail);
        Optional<User> targetUserOpt = userRepository.findById(id);

        if (targetUserOpt.isEmpty() || currentUserOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "User context error."));
        }

        User currentUser = currentUserOpt.get();
        User targetUser = targetUserOpt.get();

        // 1. Cannot delete yourself
        if (currentUser.getId().equals(targetUser.getId())) {
            return ResponseEntity.badRequest().body(Map.of("message", "You cannot delete your own account."));
        }

        // 2. Protect the root system admin (ADMIN role with no parent = created by DataInitializer)
        if (targetUser.getRole() == Role.ADMIN && targetUser.getOnboardedBy() == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "The primary system account cannot be removed."));
        }

        // 3. Only ADMIN role users can delete — already enforced by @PreAuthorize above
        // (no further check needed here)

        // Pre-deletion cleanup: unassign tasks assigned to this user
        taskRepository.findByAssigneeId(id).forEach(task -> {
            task.setAssignee(null);
            taskRepository.save(task);
        });

        // Remove user from all project team memberships
        projectRepository.findAll().forEach(project -> {
            if (project.getTeamMembers() != null && project.getTeamMembers().removeIf(m -> m.getId().equals(id))) {
                projectRepository.save(project);
            }
        });

        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User removed successfully."));
    }

    @PutMapping("/users/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody SignupRequest updateRequest) {
        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> currentUserOpt = userRepository.findByEmail(currentEmail);
        Optional<User> targetUserOpt = userRepository.findById(id);

        if (targetUserOpt.isEmpty() || currentUserOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "User not found."));
        }

        User currentUser = currentUserOpt.get();
        User targetUser = targetUserOpt.get();

        String tenantPrefix = "";
        if (currentUser.getTenant() != null && currentUser.getTenant().getTenantId() != null) {
            tenantPrefix = currentUser.getTenant().getTenantId() + "_";
        }

        String inputEmpId = updateRequest.getEmpId();
        String finalEmpId = inputEmpId;
        if (!tenantPrefix.isEmpty() && !inputEmpId.startsWith(tenantPrefix)) {
            finalEmpId = tenantPrefix + inputEmpId;
        }

        Optional<User> existingWithEmpId = userRepository.findByEmpId(finalEmpId);
        if (existingWithEmpId.isPresent() && !existingWithEmpId.get().getId().equals(targetUser.getId())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Collaborator already exists with this Employee ID."));
        }

        Role oldRole = targetUser.getRole();
        targetUser.setName(updateRequest.getName());
        targetUser.setEmpId(finalEmpId);
        targetUser.setRole(Role.valueOf(updateRequest.getRole()));

        userRepository.save(targetUser);

        if (oldRole != targetUser.getRole()) {
            try {
                com.flowtrack.model.Project mockProject = new com.flowtrack.model.Project();
                mockProject.setName("Global Workspace");
                taskEmailService.sendRoleChangedEmail(targetUser, mockProject, oldRole.name(), targetUser.getRole().name());
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return ResponseEntity.ok(Map.of("message", "User record updated successfully."));
    }

    @PutMapping("/profile-update")
    @org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> profileUpdate(@RequestBody Map<String, Object> requestData) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (requestData.containsKey("name"))
                user.setName((String) requestData.get("name"));
            if (requestData.containsKey("department"))
                user.setDepartment((String) requestData.get("department"));
            com.flowtrack.model.Role oldRole = user.getRole();
            if (requestData.containsKey("role")) {
                try {
                    user.setRole(com.flowtrack.model.Role.valueOf((String) requestData.get("role")));
                } catch (Exception e) {
                }
            }
            if (requestData.containsKey("password")) {
                String newPass = (String) requestData.get("password");
                if (isCommonPassword(newPass)) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("message", "This password is too common and easily guessed. Please choose a more secure password."));
                }
                if (isPasswordReused(user, newPass)) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("message", "You cannot reuse your last 5 passwords."));
                }
                String encoded = encoder.encode(newPass);
                user.setPassword(encoded);
                updatePasswordHistory(user, encoded);
                sendEmail(user.getEmail(), "FlowTrack: Password Changed", "Your password was successfully changed.");
            }
            if (requestData.containsKey("passwordResetRequired")) {
                Object val = requestData.get("passwordResetRequired");
                if (val instanceof Boolean) {
                    user.setPasswordResetRequired((Boolean) val);
                } else {
                    user.setPasswordResetRequired(Boolean.parseBoolean(val.toString()));
                }
            }
            userRepository.save(user);

            if (requestData.containsKey("role") && oldRole != user.getRole()) {
                try {
                    com.flowtrack.model.Project mockProject = new com.flowtrack.model.Project();
                    mockProject.setName("Global Workspace");
                    taskEmailService.sendRoleChangedEmail(user, mockProject, oldRole.name(), user.getRole().name());
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            return ResponseEntity.ok(Map.of(
                    "message", "Profile updated successfully.",
                    "name", user.getName(),
                    "department", user.getDepartment(),
                    "role", user.getRole().name()));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "User not found."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> requestData) {
        String token = requestData.get("token");
        String newPassword = requestData.get("newPassword");

        if (token == null || newPassword == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Token and new password are required."));
        }

        if (isCommonPassword(newPassword)) {
            return ResponseEntity.badRequest().body(Map.of("message", "This password is too common. Please choose a more unique one."));
        }

        if (!Pattern.matches(COMPLEXITY_PATTERN, newPassword)) {
            return ResponseEntity.badRequest().body(Map.of("message",
                    "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character."));
        }

        Optional<User> userOpt = userRepository.findByResetToken(token);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
                return ResponseEntity.status(HttpStatus.GONE).body(Map.of("message", "Reset token has expired."));
            }

            if (isPasswordReused(user, newPassword)) {
                return ResponseEntity.badRequest().body(Map.of("message", "You cannot reuse your last 5 passwords."));
            }

            String encoded = encoder.encode(newPassword);
            user.setPassword(encoded);
            updatePasswordHistory(user, encoded);
            user.setPasswordResetRequired(false);
            user.setResetToken(null);
            user.setResetTokenExpiry(null);
            userRepository.save(user);
            sendEmail(user.getEmail(), "FlowTrack: Password Changed", "Your password was successfully changed.");
            return ResponseEntity.ok(Map.of("message", "Password has been reset successfully."));
        }

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Invalid reset token."));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> requestData) {
        String email = requestData.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required."));
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            String token = UUID.randomUUID().toString();
            user.setResetToken(token);
            user.setResetTokenExpiry(LocalDateTime.now().plusHours(1));
            userRepository.save(user);

            new Thread(() -> {
                try {
                    jakarta.mail.internet.MimeMessage mimeMessage = mailSender.createMimeMessage();
                    org.springframework.mail.javamail.MimeMessageHelper helper = new org.springframework.mail.javamail.MimeMessageHelper(
                            mimeMessage, "utf-8");

                    String resetUrl = frontendUrl + "/reset-password?token=" + token;

                    String htmlMsg = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e4e8; border-radius: 10px;'>"
                            +
                            "<h2 style='color: #2b64f3;'>Password Reset Request</h2>" +
                            "<p>Hello " + user.getName() + ",</p>" +
                            "<p>We received a request to reset your ScalozFlowpassword. Click the button below to proceed:</p>"
                            +
                            "<div style='text-align: center; margin: 30px 0;'>" +
                            "<a href='" + resetUrl
                            + "' style='background-color: #2b64f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;'>Reset Password</a>"
                            +
                            "</div>" +
                            "<p>Or copy and paste this link into your browser:</p>" +
                            "<p style='word-break: break-all; color: #2b64f3;'>" + resetUrl + "</p>" +
                            "<p>This link will expire in 1 hour.</p>" +
                            "<p>If you did not request a password reset, please ignore this email.</p>" +
                            "<hr style='border: 0; border-top: 1px solid #eee; margin: 20px 0;'>" +
                            "<p style='font-size: 12px; color: #666;'>ScalozFlowSecurity Team</p>" +
                            "</div>";

                    helper.setText(htmlMsg, true);
                    helper.setTo(email);
                    helper.setSubject("FlowTrack: Password Reset Request");
                    helper.setFrom(fromEmail);

                    mailSender.send(mimeMessage);
                } catch (Exception e) {
                    System.err.println("SMTP error during password reset: " + e.getMessage());
                }
            }).start();
        }

        // Guidelines suggest returning success even if email doesn't exist for security
        return ResponseEntity.ok(
                Map.of("message", "If an account with that email exists, a reset link has been sent."));
    }
}
