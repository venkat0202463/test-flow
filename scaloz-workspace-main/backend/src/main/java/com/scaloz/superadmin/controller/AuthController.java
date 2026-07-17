package com.scaloz.superadmin.controller;

import com.scaloz.superadmin.model.Tenant;
import com.scaloz.superadmin.model.TenantModule;
import com.scaloz.superadmin.model.TenantUser;
import com.scaloz.superadmin.model.PasswordResetToken;
import com.scaloz.superadmin.model.Product;
import com.scaloz.superadmin.model.ProductModule;
import com.scaloz.superadmin.repository.TenantRepository;
import com.scaloz.superadmin.repository.TenantModuleRepository;
import com.scaloz.superadmin.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import java.time.LocalDateTime;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.internet.MimeMessage;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class AuthController {

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private TenantModuleRepository tenantModuleRepository;

    @Autowired
    private com.scaloz.superadmin.repository.ProductRepository productRepository;

    @Autowired
    private com.scaloz.superadmin.repository.TenantUserRepository tenantUserRepository;

    @Autowired
    private TenantUserController tenantUserController;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private com.scaloz.superadmin.repository.PasswordResetTokenRepository passwordResetTokenRepository;

    @Value("${spring.mail.username:noreply@scaloz.com}")
    private String fromEmail;

    private final org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder passwordEncoder = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(AuthController.class);

    // ─────────────────────────────────────────────────────────────────
    // LOOKUP — safe public endpoint (no auth required, no passwords)
    // GET /api/auth/lookup?email=user@company.com
    // Returns: tenant name, domain, logo, products list
    // ─────────────────────────────────────────────────────────────────
    @GetMapping("/lookup")
    public ResponseEntity<?> lookupTenant(
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "code", required = false) String code) {

        Optional<Tenant> tenantOpt = Optional.empty();
        String domain = "";

        if (code != null && !code.trim().isEmpty()) {
            String searchCode = code.trim().toLowerCase();
            tenantOpt = tenantRepository.findByCode(searchCode);

            // If not found by code, try finding by sanitized tenant name (slug)
            if (!tenantOpt.isPresent()) {
                List<Tenant> allTenants = tenantRepository.findAll();
                for (Tenant t : allTenants) {
                    if (t.getName() == null)
                        continue;
                    String sanitizedName = t.getName().toLowerCase()
                            .replaceAll("[^a-z0-9]", "-")
                            .replaceAll("-+", "-")
                            .replaceAll("^-|-$", "");
                    if (sanitizedName.equals(searchCode)) {
                        tenantOpt = Optional.of(t);
                        break;
                    }
                }
            }

            if (tenantOpt.isPresent()) {
                Tenant tenant = tenantOpt.get();
                domain = tenant.getAdminEmail() != null && tenant.getAdminEmail().contains("@")
                        ? tenant.getAdminEmail().substring(tenant.getAdminEmail().indexOf("@") + 1)
                        : tenant.getCode() + ".com";
            }
        } else if (email != null && email.contains("@")) {
            domain = email.substring(email.indexOf("@") + 1).toLowerCase().trim();
            tenantOpt = resolveTenantByEmailOrDomain(email, domain);
        } else {
            Map<String, String> err = new HashMap<>();
            err.put("message", "A valid email address or workspace code is required.");
            return ResponseEntity.badRequest().body(err);
        }

        if (!tenantOpt.isPresent()) {
            Map<String, String> err = new HashMap<>();
            err.put("message", "No workspace found.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err);
        }

        Tenant tenant = tenantOpt.get();
        if (tenant.getStatus() != null && tenant.getStatus().equalsIgnoreCase("Inactive")) {
            Map<String, Object> err = new HashMap<>();
            err.put("inactive", true);
            err.put("message", "You don't have access for this. Please contact your administrator.");
            return ResponseEntity.ok(err);
        }

        // Fetch products for this tenant (safe — no credentials)
        Map<Long, Map<String, Object>> productMap = new LinkedHashMap<>();
        String selProds = tenant.getSelectedProducts();
        if (selProds != null && !selProds.trim().isEmpty()) {
            // Split and load using the persistent column
            String[] prodCodes = selProds.split(",");
            for (String c : prodCodes) {
                String trimmed = c.trim();
                String pCode = trimmed;
                String status = "Active";
                if (trimmed.contains(":")) {
                    String[] parts = trimmed.split(":", 2);
                    pCode = parts[0].trim();
                    status = parts[1].trim();
                }
                if (!status.equalsIgnoreCase("Active")) {
                    continue;
                }
                Optional<Product> pOpt = productRepository.findByCode(pCode);
                if (pOpt.isPresent()) {
                    Product p = pOpt.get();
                    if (!productMap.containsKey(p.getId())) {
                        Map<String, Object> pInfo = new LinkedHashMap<>();
                        pInfo.put("productId", p.getId());
                        pInfo.put("productName", p.getName());
                                        pInfo.put("productCode", p.getCode());
                        pInfo.put("icon", p.getIcon());
                        pInfo.put("content", p.getContent());
                        productMap.put(p.getId(), pInfo);
                    }
                }
            }
        } else {
            // Fallback to deducing products list from assigned TenantModules (backwards
            // compatibility)
            List<TenantModule> tenantModules = tenantModuleRepository.findByTenantId(tenant.getId());
            for (TenantModule tm : tenantModules) {
                ProductModule pm = tm.getProductModule();
                if (pm != null) {
                    Product p = pm.getProduct();
                    if (p != null && !productMap.containsKey(p.getId())) {
                        Map<String, Object> pInfo = new LinkedHashMap<>();
                        pInfo.put("productId", p.getId());
                        pInfo.put("productName", p.getName());
                                        pInfo.put("productCode", p.getCode());
                        pInfo.put("icon", p.getIcon());
                        pInfo.put("content", p.getContent());
                        productMap.put(p.getId(), pInfo);
                    }
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tenantName", tenant.getName());
        result.put("domain", domain);
        result.put("code", tenant.getCode());
        result.put("logo", tenant.getLogo());
        result.put("adminEmail", tenant.getAdminEmail());
        result.put("adminEmployeeId", tenant.getCode() + "_admin");
        result.put("website", tenant.getWebsite());
        result.put("products", new ArrayList<>(productMap.values()));
        result.put("found", true);

        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────
    // LOGIN — email + password (tenant auto-resolved from email)
    // POST /api/auth/login
    // ─────────────────────────────────────────────────────────────────
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> loginRequest) {

        // ── Tenant Login (email present) ─────────────────────────────
        if (loginRequest.containsKey("email")) {
            String email = loginRequest.get("email") != null ? loginRequest.get("email").trim() : null;
            String password = loginRequest.get("password") != null ? loginRequest.get("password").trim() : null;
            String tenantCode = loginRequest.get("tenantCode");
            // Look up by email directly or find by employee ID within the tenant
            Optional<TenantUser> userOpt = tenantUserRepository.findByEmail(email);

            // Enforce tenant code matching: if user exists but doesn't belong to the requested tenantCode, invalidate the search
            if (userOpt.isPresent() && tenantCode != null && !tenantCode.trim().isEmpty()) {
                if (!tenantCode.trim().equalsIgnoreCase(userOpt.get().getTenant().getCode())) {
                    userOpt = Optional.empty();
                }
            }

            if (!userOpt.isPresent()) {
                String searchEmailOrEmpId = email;
                String searchTenantCode = tenantCode;
                if (email != null && email.contains("_")) {
                    int underscoreIndex = email.indexOf('_');
                    // Only extract tenant code prefix from ID if tenantCode is not already supplied
                    if (tenantCode == null || tenantCode.trim().isEmpty()) {
                        searchTenantCode = email.substring(0, underscoreIndex);
                    }
                    searchEmailOrEmpId = email.substring(underscoreIndex + 1);
                }

                List<TenantUser> allUsers = tenantUserRepository.findAll();
                for (TenantUser tu : allUsers) {
                    String checkId = tu.getEmployeeId();
                    String cleanCheckId = checkId != null && checkId.contains("_")
                        ? checkId.substring(checkId.indexOf("_") + 1)
                        : checkId;
                    if (Objects.equals(checkId, email) || Objects.equals(cleanCheckId, email) || Objects.equals(cleanCheckId, searchEmailOrEmpId)) {
                        if (searchTenantCode == null || Objects.equals(tu.getTenant().getCode(), searchTenantCode.toLowerCase().trim())) {
                            userOpt = Optional.of(tu);
                            break;
                        }
                    }
                }
            }

            if (userOpt.isPresent()) {
                TenantUser tu = userOpt.get();

                if (tu.getTenant() != null && tu.getTenant().getStatus() != null && tu.getTenant().getStatus().equalsIgnoreCase("Inactive")) {
                    Map<String, String> err = new HashMap<>();
                    err.put("message", "You don't have access for this. Please contact your administrator.");
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
                }

                if (tu.getStatus() != null && tu.getStatus().equalsIgnoreCase("Inactive")) {
                    Map<String, String> err = new HashMap<>();
                    err.put("message", "Your account is inactive. Please contact your administrator.");
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
                }

                // Check if account is locked
                if (tu.getAccountLocked() != null && tu.getAccountLocked()) {
                    Map<String, String> err = new HashMap<>();
                    err.put("message", "Your account has been locked due to 3 unsuccessful login attempts. Please reset your password to unlock your account.");
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
                }

                if (passwordEncoder.matches(password, tu.getPassword()) || Objects.equals(tu.getPassword(), password)) {
                    // Reset failed attempts on success
                    tu.setFailedAttemptCount(0);
                    tu.setLastFailedLogin(null);
                    tenantUserRepository.save(tu);

                    // Check if user must change password
                    if (tu.getMustChangePassword() != null && tu.getMustChangePassword()) {
                        Map<String, Object> resp = new LinkedHashMap<>();
                        resp.put("mustChangePassword", true);
                        resp.put("employeeId", tu.getEmployeeId());
                        resp.put("email", tu.getEmail());
                        resp.put("tenantCode", tu.getTenant().getCode());
                        return ResponseEntity.ok(resp);
                    }
                    return buildLoginSuccessResponse(tu);
                } else {
                    // Password mismatch - increment failure count
                    int currentCount = tu.getFailedAttemptCount() != null ? tu.getFailedAttemptCount() : 0;
                    currentCount++;
                    tu.setFailedAttemptCount(currentCount);
                    tu.setLastFailedLogin(java.time.LocalDateTime.now());

                    if (currentCount >= 3) {
                        tu.setAccountLocked(true);
                        tenantUserRepository.save(tu);
                        Map<String, String> err = new HashMap<>();
                        err.put("message", "Your account has been locked due to 3 unsuccessful login attempts. Please reset your password to unlock your account.");
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
                    } else {
                        tenantUserRepository.save(tu);
                    }
                }
            }

            Map<String, String> err = new HashMap<>();
            err.put("message", "Invalid email/employee ID or password");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);

        } else {
            // ── Super Admin Login (username present) ─────────────────
            String username = loginRequest.get("username") != null ? loginRequest.get("username").trim() : null;
            String password = loginRequest.get("password") != null ? loginRequest.get("password").trim() : null;
            System.out.println("Super Admin Login Attempt - Username: " + username + ", Password: " + password);

            if (("admin".equals(username) || "admin@xevyte.com".equals(username))
                    && ("admin".equals(password) || "Admin@123".equals(password))) {
                String token = jwtUtils.generateToken(username);
                Map<String, Object> response = new HashMap<>();
                response.put("token", token);
                response.put("username", username);
                response.put("role", "ROLE_SUPER_ADMIN");
                return ResponseEntity.ok(response);
            }

            Map<String, String> err = new HashMap<>();
            err.put("message", "Invalid username or password");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // /me — validate token and return session context (used by HRMS)
    // GET /api/auth/me
    // Header: Authorization: Bearer <token>
    // ─────────────────────────────────────────────────────────────────
    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            Map<String, String> err = new HashMap<>();
            err.put("message", "No token provided");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
        }

        String token = header.substring(7);
        if (!jwtUtils.validateToken(token)) {
            Map<String, String> err = new HashMap<>();
            err.put("message", "Invalid or expired token");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
        }

        String subject = jwtUtils.getUsernameFromToken(token);
        String tenant = jwtUtils.extractStringClaim(token, "tenant");
        String tenantId = jwtUtils.extractStringClaim(token, "tenantId");
        String role = jwtUtils.extractStringClaim(token, "role");
        String employeeId = jwtUtils.extractStringClaim(token, "employeeId");
        String name = jwtUtils.extractStringClaim(token, "name");
        List<String> apps = jwtUtils.extractListClaim(token, "apps");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sub", subject);
        result.put("tenant", tenant);
        result.put("tenantId", tenantId);
        result.put("role", role);
        result.put("employeeId", employeeId);
        result.put("name", name);
        result.put("apps", apps);
        Object isSubAdminObj = jwtUtils.extractClaim(token, "isSubAdmin");
        result.put("isSubAdmin", isSubAdminObj instanceof Boolean ? (Boolean) isSubAdminObj : false);
        result.put("authenticated", true);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────
    // SHARED HELPER — resolve Tenant by email exact match then domain
    // ─────────────────────────────────────────────────────────────────
    private Optional<Tenant> resolveTenantByEmailOrDomain(String email, String domain) {
        // 1) Exact user email match in tenant_users (most specific match)
        Optional<TenantUser> tuOpt = tenantUserRepository.findByEmail(email);
        if (tuOpt.isPresent()) {
            return Optional.of(tuOpt.get().getTenant());
        }

        // 2) Exact adminEmail match
        List<Tenant> byAdminEmail = tenantRepository.findByAdminEmail(email);
        if (!byAdminEmail.isEmpty())
            return Optional.of(byAdminEmail.get(0));

        // 2) Domain scan across all tenants
        List<Tenant> all = tenantRepository.findAll();
        for (Tenant t : all) {
            // match admin email domain
            if (t.getAdminEmail() != null && t.getAdminEmail().contains("@")) {
                String td = t.getAdminEmail().substring(t.getAdminEmail().indexOf("@") + 1).toLowerCase().trim();
                if (domain.equals(td))
                    return Optional.of(t);
            }
            // match company email domain
            if (t.getEmail() != null && t.getEmail().contains("@")) {
                String td = t.getEmail().substring(t.getEmail().indexOf("@") + 1).toLowerCase().trim();
                if (domain.equals(td))
                    return Optional.of(t);
            }
            // match website
            if (t.getWebsite() != null) {
                String w = t.getWebsite().replace("https://", "").replace("http://", "").replace("www.", "")
                        .toLowerCase().trim();
                if (w.equals(domain) || w.startsWith(domain) || domain.startsWith(w.split("/")[0]))
                    return Optional.of(t);
            }
            // match tenant code
            if (t.getCode() != null && domain.equals(t.getCode().toLowerCase().trim()))
                return Optional.of(t);
        }
        return Optional.empty();
    }

    private ResponseEntity<?> buildLoginSuccessResponse(TenantUser tu) {
        List<String> appCodes = new ArrayList<>();
        String assignedProdsForClaims = tu.getAssignedProducts();
        if (tu.getRole() != null && (tu.getRole().equalsIgnoreCase("Admin") || tu.getRole().equalsIgnoreCase("Sub Admin") || tu.getRole().equalsIgnoreCase("Sub_Admin") || Boolean.TRUE.equals(tu.getIsSubAdmin()))) {
            assignedProdsForClaims = tu.getTenant().getSelectedProducts();
        }
        if (assignedProdsForClaims != null && !assignedProdsForClaims.isEmpty()) {
            for (String pIdStr : assignedProdsForClaims.split(",")) {
                try {
                    String cleanCode = pIdStr.trim();
                    if (cleanCode.contains(":")) {
                        cleanCode = cleanCode.split(":", 2)[0].trim();
                    }
                    final String lookupCode = cleanCode;
                    productRepository.findByCode(lookupCode)
                        .ifPresent(p -> {
                            if (p.getCode() != null && TenantController.isProductActive(tu.getTenant().getSelectedProducts(), p.getCode())) {
                                appCodes.add(p.getCode());
                            }
                        });
                } catch (Exception ignored) {}
            }
        }
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("tenant", tu.getTenant().getCode());
        claims.put("tenantId", tu.getTenant().getCode());
        claims.put("tenantName", tu.getTenant().getName());
        String ssoRole = tu.getRole();
        if (Boolean.TRUE.equals(tu.getIsSubAdmin())) {
            ssoRole = "Sub Admin";
        }
        claims.put("role", ssoRole != null ? ssoRole : "USER");
        claims.put("isSubAdmin", tu.getIsSubAdmin());
        claims.put("apps", appCodes);
        String empId2 = tu.getEmployeeId();
        String prefix2 = tu.getTenant().getCode() + "_";
        if (empId2 != null && !empId2.startsWith(prefix2)) {
            empId2 = prefix2 + empId2;
        }
        claims.put("employeeId", empId2);
        claims.put("name", tu.getFirstName() + " " + tu.getLastName());
        claims.put("firstName", tu.getFirstName());
        claims.put("lastName", tu.getLastName());
        claims.put("workLocation", tu.getWorkLocation());
        claims.put("personalEmail", tu.getPersonalEmail());
        claims.put("gender", tu.getGender());
        claims.put("dateOfBirth", tu.getDateOfBirth());
        claims.put("aadharNo", tu.getAadharNo());
        claims.put("panNo", tu.getPanNo());
        claims.put("presentAddress", tu.getPresentAddress());
        claims.put("permanentAddress", tu.getPermanentAddress());
        claims.put("contactNo", tu.getContactNo());
        claims.put("bloodGroup", tu.getBloodGroup());
        claims.put("joiningDate", tu.getJoiningDate());

        String token = jwtUtils.generateToken(tu.getEmail(), claims);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("token", token);

        Map<String, Object> userMap = new LinkedHashMap<>();
        userMap.put("id", tu.getId());
        userMap.put("name", tu.getFirstName() + " " + tu.getLastName());
        userMap.put("role", tu.getRole());
        userMap.put("isSubAdmin", tu.getIsSubAdmin());
        userMap.put("employeeId", tu.getEmployeeId());
        response.put("user", userMap);

        Map<String, Object> tenantMap = new LinkedHashMap<>();
        tenantMap.put("id", tu.getTenant().getId());
        tenantMap.put("name", tu.getTenant().getName());
        tenantMap.put("code", tu.getTenant().getCode());
        response.put("tenant", tenantMap);

        List<Map<String, Object>> userProducts = new ArrayList<>();
        String assignedProds = tu.getAssignedProducts();
        if (tu.getRole() != null && (tu.getRole().equalsIgnoreCase("Admin") || tu.getRole().equalsIgnoreCase("Sub Admin") || tu.getRole().equalsIgnoreCase("Sub_Admin") || Boolean.TRUE.equals(tu.getIsSubAdmin()))) {
            assignedProds = tu.getTenant().getSelectedProducts();
        }
        if (assignedProds != null && !assignedProds.isEmpty()) {
            for (String pIdStr : assignedProds.split(",")) {
                try {
                    String cleanCode = pIdStr.trim();
                    if (cleanCode.contains(":")) {
                        cleanCode = cleanCode.split(":", 2)[0].trim();
                    }
                    Optional<Product> pOpt = productRepository.findByCode(cleanCode);
                    if (pOpt.isPresent()) {
                        Product p = pOpt.get();
                        if (TenantController.isProductActive(tu.getTenant().getSelectedProducts(), p.getCode())) {
                            Map<String, Object> pInfo = new LinkedHashMap<>();
                            pInfo.put("productId", p.getId());
                            pInfo.put("productName", p.getName());
                                            pInfo.put("productCode", p.getCode());
                            pInfo.put("url", p.getUrl());
                            pInfo.put("icon", p.getIcon());
                            pInfo.put("content", p.getContent());
                            List<String> userModules = new ArrayList<>();
                            String assignedMods = tu.getAssignedModules();
                            if (assignedMods != null && !assignedMods.isEmpty()) {
                                for (String mName : assignedMods.split(",")) {
                                    userModules.add(mName.trim());
                                }
                            }
                            pInfo.put("modules", userModules);
                            userProducts.add(pInfo);
                        }
                    }
                } catch (Exception e) {}
            }
        }
        response.put("products", userProducts);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> request) {
        String emailOrEmpId = request.get("employeeId");
        String tempPassword = request.get("tempPassword");
        String newPassword = request.get("newPassword");
        String tenantCode = request.get("tenantCode");

        if (emailOrEmpId == null || tempPassword == null || newPassword == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "employeeId, tempPassword, and newPassword are required."));
        }

        Optional<TenantUser> userOpt = Optional.empty();

        String searchEmailOrEmpId = emailOrEmpId;
        String searchTenantCode = tenantCode;
        if (emailOrEmpId.contains("_")) {
            int underscoreIndex = emailOrEmpId.indexOf('_');
            searchTenantCode = emailOrEmpId.substring(0, underscoreIndex);
            searchEmailOrEmpId = emailOrEmpId.substring(underscoreIndex + 1);
        }

        Optional<TenantUser> byEmail = tenantUserRepository.findByEmail(emailOrEmpId.trim());
        if (byEmail.isPresent()) {
            userOpt = byEmail;
        } else {
            if (searchTenantCode != null && !searchTenantCode.trim().isEmpty()) {
                Optional<Tenant> tenantOpt = tenantRepository.findByCode(searchTenantCode.trim().toLowerCase());
                if (tenantOpt.isPresent()) {
                    userOpt = tenantUserRepository.findByEmployeeIdAndTenantId(emailOrEmpId.trim(), tenantOpt.get().getId());
                    if (!userOpt.isPresent()) {
                        userOpt = tenantUserRepository.findByEmployeeIdAndTenantId(searchEmailOrEmpId.trim(), tenantOpt.get().getId());
                    }
                }
            }
            if (!userOpt.isPresent()) {
                List<TenantUser> allUsers = tenantUserRepository.findAll();
                for (TenantUser tu : allUsers) {
                    if (Objects.equals(tu.getEmployeeId(), emailOrEmpId.trim()) || Objects.equals(tu.getEmployeeId(), searchEmailOrEmpId.trim())) {
                        userOpt = Optional.of(tu);
                        break;
                    }
                }
            }
        }

        if (!userOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "User not found."));
        }

        TenantUser user = userOpt.get();

        if (!passwordEncoder.matches(tempPassword, user.getPassword()) && !Objects.equals(user.getPassword(), tempPassword)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Temporary password does not match current password."));
        }

        String passwordPattern = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,}$";
        if (!newPassword.matches(passwordPattern)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message",
                    "Password does not meet security requirements. Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters."));
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        tenantUserRepository.save(user);

        try {
            tenantUserController.syncToProducts(user, newPassword);
        } catch (Exception e) {
            System.err.println("[Scaloz] Warning: Could not sync updated password to products: " + e.getMessage());
        }

        return buildLoginSuccessResponse(user);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> request, HttpServletRequest httpRequest) {
        String input = request.get("employeeId");
        String tenantCode = request.get("tenantCode");

        // Generic success response
        Map<String, String> genericResponse = Map.of("message", "If an account exists for this Employee ID, a password reset link has been sent.");

        if (input == null || input.trim().isEmpty()) {
            return ResponseEntity.ok(genericResponse);
        }

        Optional<TenantUser> userOpt = Optional.empty();

        String searchEmailOrEmpId = input.trim();
        String searchTenantCode = tenantCode;
        if (input.contains("_")) {
            int underscoreIndex = input.indexOf('_');
            searchTenantCode = input.substring(0, underscoreIndex);
            searchEmailOrEmpId = input.substring(underscoreIndex + 1);
        }

        Optional<TenantUser> byEmail = tenantUserRepository.findByEmail(input.trim());
        if (byEmail.isPresent()) {
            userOpt = byEmail;
        } else {
            Optional<TenantUser> byEmpId = tenantUserRepository.findByEmployeeId(input.trim());
            if (byEmpId.isPresent()) {
                userOpt = byEmpId;
            } else {
                List<TenantUser> allUsers = tenantUserRepository.findAll();
                for (TenantUser tu : allUsers) {
                    String checkId = tu.getEmployeeId();
                    String cleanCheckId = checkId != null && checkId.contains("_")
                        ? checkId.substring(checkId.indexOf("_") + 1)
                        : checkId;
                    if (Objects.equals(checkId, input.trim()) || Objects.equals(cleanCheckId, input.trim()) || Objects.equals(cleanCheckId, searchEmailOrEmpId)) {
                        if (searchTenantCode == null || Objects.equals(tu.getTenant().getCode(), searchTenantCode.toLowerCase())) {
                            userOpt = Optional.of(tu);
                            break;
                        }
                    }
                }
            }
        }

        // Do not reveal whether the Employee ID exists in the system (return 200 generic response)
        if (!userOpt.isPresent()) {
            return ResponseEntity.ok(genericResponse);
        }

        TenantUser user = userOpt.get();

        // Generate a secure reset token
        String token = java.util.UUID.randomUUID().toString();

        // Save reset token in password_reset_tokens table with 15 minutes expiry
        PasswordResetToken resetToken = new PasswordResetToken(user.getEmployeeId(), token, java.time.LocalDateTime.now().plusMinutes(15));
        passwordResetTokenRepository.save(resetToken);

        // Build reset link
        String origin = httpRequest.getHeader("Origin");
        if (origin == null || origin.isEmpty()) {
            origin = httpRequest.getHeader("Referer");
        }
        if (origin == null || origin.isEmpty()) {
            origin = "http://localhost:3001";
        } else {
            try {
                java.net.URL url = new java.net.URL(origin);
                origin = url.getProtocol() + "://" + url.getHost() + (url.getPort() != -1 ? ":" + url.getPort() : "");
            } catch (Exception ignored) {}
        }

        String resetLink = origin + "/reset-password?token=" + token;

        // Send HTML email in a background thread to prevent API blocking
        new Thread(() -> {
            try {
                if (mailSender != null) {
                    MimeMessage message = mailSender.createMimeMessage();
                    MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                    
                    helper.setFrom(fromEmail);
                    helper.setTo(user.getEmail());
                    helper.setSubject("Password Reset Request");

                    String htmlContent = 
                        "<div style=\"font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;\">" +
                        "  <div style=\"text-align: center; margin-bottom: 24px;\">" +
                        "    <h2 style=\"color: #0f172a; margin: 0; font-size: 24px; font-weight: 800;\">Scaloz</h2>" +
                        "  </div>" +
                        "  <hr style=\"border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 24px;\" />" +
                        "  <p style=\"color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 16px;\">Dear Employee,</p>" +
                        "  <p style=\"color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 24px;\">We received a request to reset your password. Click the button below to create a new password:</p>" +
                        "  <div style=\"text-align: center; margin: 30px 0;\">" +
                        "    <a href=\"" + resetLink + "\" style=\"display: inline-block; padding: 12px 28px; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);\">Reset Password</a>" +
                        "  </div>" +
                        "  <p style=\"color: #ef4444; font-size: 14px; font-weight: 500; margin-top: 20px; margin-bottom: 20px;\">This link will expire in 15 minutes.</p>" +
                        "  <p style=\"color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 24px;\">If you did not request this change, please ignore this email.</p>" +
                        "  <hr style=\"border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px; margin-bottom: 24px;\" />" +
                        "  <p style=\"color: #94a3b8; font-size: 12px; text-align: center; margin: 0;\">Regards,<br />System Administrator</p>" +
                        "</div>";

                    helper.setText(htmlContent, true);
                    mailSender.send(message);
                    logger.info("Sent HTML password reset link successfully to: " + user.getEmail());
                } else {
                    logger.warn("mailSender is null. Reset link: " + resetLink);
                }
            } catch (Exception e) {
                logger.error("Failed to send reset email to " + user.getEmail() + ": " + e.getMessage());
            }
        }).start();

        return ResponseEntity.ok(genericResponse);
    }

    @PostMapping("/reset-password")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> request) {
        String token = request.get("token");
        String newPassword = request.get("newPassword");

        if (token == null || token.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Reset token is required."));
        }

        Optional<PasswordResetToken> tokenOpt = passwordResetTokenRepository.findByToken(token);
        if (!tokenOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Reset token is missing or invalid. Please check your email link again."));
        }

        PasswordResetToken resetToken = tokenOpt.get();

        // Check if token is used or expired
        if (resetToken.getUsed() != null && resetToken.getUsed()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "This reset token has already been used. Please request a new link."));
        }
        if (resetToken.getExpiryTime() == null || resetToken.getExpiryTime().isBefore(java.time.LocalDateTime.now())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "This reset token has expired. Reset links are only valid for 15 minutes."));
        }

        Optional<TenantUser> userOpt = tenantUserRepository.findByEmployeeId(resetToken.getEmployeeId());
        if (!userOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee account not found."));
        }

        TenantUser user = userOpt.get();

        // Security check: Minimum 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
        String passwordPattern = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,}$";
        if (newPassword == null || !newPassword.matches(passwordPattern)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message",
                    "Password must be at least 8 characters, include uppercase, lowercase, number, and special character."));
        }

        // Compare the new password against the existing password hash to prevent reuse
        if (passwordEncoder.matches(newPassword, user.getPassword()) || Objects.equals(user.getPassword(), newPassword)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message",
                    "New password cannot be the same as your previous password. Please choose a different password."));
        }

        // Update user password and clear lockout status
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setFailedAttemptCount(0);
        user.setAccountLocked(false);
        user.setLastFailedLogin(null);
        tenantUserRepository.save(user);

        // Invalidate all previous reset tokens for this user
        List<PasswordResetToken> activeTokens = passwordResetTokenRepository.findByEmployeeIdAndUsedFalse(user.getEmployeeId());
        for (PasswordResetToken t : activeTokens) {
            t.setUsed(true);
        }
        passwordResetTokenRepository.saveAll(activeTokens);

        // Audit logging
        logger.info("Password reset successful for employee ID: " + user.getEmployeeId() + " (Email: " + user.getEmail() + ")");

        try {
            tenantUserController.syncToProducts(user, newPassword);
        } catch (Exception e) {
            logger.warn("Could not sync updated password to products: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of("message", "Password reset successfully. You can now log in."));
    }
}
