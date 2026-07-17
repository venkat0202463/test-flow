package com.scaloz.superadmin.controller;

import com.scaloz.superadmin.model.Product;
import com.scaloz.superadmin.model.Tenant;
import com.scaloz.superadmin.model.TenantUser;
import com.scaloz.superadmin.repository.ProductRepository;
import com.scaloz.superadmin.repository.TenantRepository;
import com.scaloz.superadmin.repository.TenantUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.ArrayList;
import java.util.HashMap;
import java.lang.reflect.Field;
import java.util.Objects;

@RestController
@RequestMapping("/api/tenant-users")
@CrossOrigin(origins = "*")
public class TenantUserController {

    @Value("${hrms.api.url}")
    private String hrmsApiUrl;

    @Value("${hrms.api.key:}")
    private String hrmsApiKey;

    @Autowired
    private org.springframework.core.env.Environment environment;

    private String resolveApiKey(String productCode) {
        if (productCode == null || productCode.trim().isEmpty()) {
            return null;
        }
        productCode = productCode.trim();
        
        // 1. Try exact product code property: productCode.toLowerCase() + ".api.key" (e.g. hrms0001.api.key)
        String key = environment.getProperty(productCode.toLowerCase() + ".api.key");
        if (key != null && !key.trim().isEmpty()) return key.trim();
        
        // 2. Try prefix property (without trailing numbers): prefix.toLowerCase() + ".api.key" (e.g. hrms.api.key)
        String prefix = productCode.replaceAll("\\d+$", ""); // e.g. HRMS0001 -> HRMS
        if (!prefix.isEmpty()) {
            key = environment.getProperty(prefix.toLowerCase() + ".api.key");
            if (key != null && !key.trim().isEmpty()) return key.trim();
        }
        
        // 3. Try env var style property: productCode.toUpperCase() + "_API_KEY"
        key = environment.getProperty(productCode.toUpperCase() + "_API_KEY");
        if (key != null && !key.trim().isEmpty()) return key.trim();
        
        // 4. Try prefix env var style property: prefix.toUpperCase() + "_API_KEY"
        if (!prefix.isEmpty()) {
            key = environment.getProperty(prefix.toUpperCase() + "_API_KEY");
            if (key != null && !key.trim().isEmpty()) return key.trim();
        }
        
        // 5. Fallback to System environment variables directly
        String envValue = System.getenv(productCode.toUpperCase() + "_API_KEY");
        if (envValue != null && !envValue.trim().isEmpty()) return envValue.trim();
        
        if (!prefix.isEmpty()) {
            envValue = System.getenv(prefix.toUpperCase() + "_API_KEY");
            if (envValue != null && !envValue.trim().isEmpty()) return envValue.trim();
        }

        // 6. Last resort fallback (only if it matches HRMS):
        if (productCode.toUpperCase().startsWith("HRMS")) {
            key = environment.getProperty("hrms.api.key");
            if (key != null && !key.trim().isEmpty()) return key.trim();
            return "xevyte_secure_api_key_2026_prod_v1";
        }

        return "xevyte_sec_" + productCode.toLowerCase() + "_key"; // Default fallback
    }

    @Value("${spring.mail.username:noreply@scaloz.com}")
    private String fromEmail;

    @Autowired
    private TenantUserRepository tenantUserRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private com.scaloz.superadmin.security.JwtUtils jwtUtils;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private static final String CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!";
    private static final int PASSWORD_LENGTH = 10;

    private String generateTempPassword() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(PASSWORD_LENGTH);
        for (int i = 0; i < PASSWORD_LENGTH; i++) {
            sb.append(CHARACTERS.charAt(random.nextInt(CHARACTERS.length())));
        }
        return sb.toString();
    }

    private static java.time.LocalDate parseLocalDate(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty()) {
            return null;
        }
        String cleanStr = dateStr.trim();
        // Try YYYY-MM-DD
        try {
            return java.time.LocalDate.parse(cleanStr);
        } catch (Exception ignored) {}
        // Try DD/MM/YYYY
        try {
            return java.time.LocalDate.parse(cleanStr, java.time.format.DateTimeFormatter.ofPattern("d/M/yyyy"));
        } catch (Exception ignored) {}
        // Try MM/DD/YYYY
        try {
            return java.time.LocalDate.parse(cleanStr, java.time.format.DateTimeFormatter.ofPattern("M/d/yyyy"));
        } catch (Exception ignored) {}
        // Try YYYY/MM/DD
        try {
            return java.time.LocalDate.parse(cleanStr, java.time.format.DateTimeFormatter.ofPattern("yyyy/M/d"));
        } catch (Exception ignored) {}
        // Try DD-MM-YYYY
        try {
            return java.time.LocalDate.parse(cleanStr, java.time.format.DateTimeFormatter.ofPattern("d-M-yyyy"));
        } catch (Exception ignored) {}
        return null;
    }

    private void sendWelcomeEmail(String toEmail, String name, String employeeId, String tempPassword) {
        System.out.println("[Scaloz] sendWelcomeEmail called for: " + toEmail);
        if (mailSender == null) {
            System.err.println("[Scaloz] ERROR: mailSender is null! Check Spring Boot Mail properties.");
            return;
        }
        if (toEmail == null || toEmail.isBlank()) {
            System.err.println("[Scaloz] ERROR: toEmail is blank!");
            return;
        }
        try {
            String cleanEmpId = employeeId;
            if (employeeId != null && employeeId.contains("_")) {
                cleanEmpId = employeeId.substring(employeeId.lastIndexOf("_") + 1);
            }

            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Welcome - Your Account Credentials");
            message.setText(
                    "Dear " + name + ",\n\n" +
                            "Your account has been successfully created. Below are your credentials to access the Portal:\n\n"
                            +
                            "Employee ID: " + cleanEmpId + "\n" +
                            "Portal Link: https://scaloz.com\n" +
                            "Temporary Password: " + tempPassword + "\n\n" +
                            "Please log in and change your password at the earliest.\n\n" +
                            "Best regards,\nScaloz Team");
            System.out.println("[Scaloz] Sending welcome email via SMTP from " + fromEmail + " to " + toEmail + "...");
            mailSender.send(message);
            System.out.println("[Scaloz] SUCCESS: Welcome email sent to: " + toEmail);
        } catch (Exception e) {
            System.err.println("[Scaloz] ERROR: Could not send welcome email to " + toEmail + ": " + e.getMessage());
            e.printStackTrace();
        }
    }

    @GetMapping("/tenant/{tenantId}")
    public List<TenantUser> getUsersByTenant(@PathVariable Long tenantId) {
        List<TenantUser> allUsers = tenantUserRepository.findByTenantId(tenantId);
        List<TenantUser> filtered = new ArrayList<>();
        for (TenantUser u : allUsers) {
            if (u.getRole() != null && u.getRole().equalsIgnoreCase("Admin")) {
                continue;
            }
            filtered.add(u);
        }
        return filtered;
    }

    @PostMapping("/onboard")
    public ResponseEntity<?> onboardUser(@RequestBody TenantUser user) {
        if (user.getTenant() == null || user.getTenant().getId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Tenant ID is missing."));
        }

        Optional<Tenant> tenantOpt = tenantRepository.findById(user.getTenant().getId());
        if (!tenantOpt.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid Tenant ID."));
        }

        user.setTenant(tenantOpt.get());


        // --- Mandatory Fields Validation ---
        if (user.getEmployeeId() == null || user.getEmployeeId().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Employee ID is missing."));
        }
        if (user.getFirstName() == null || user.getFirstName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "First Name is missing."));
        }
        if (user.getLastName() == null || user.getLastName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Last Name is missing."));
        }
        if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Work Email is missing."));
        }
        if (user.getRole() == null || user.getRole().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Role is missing."));
        }
        if (user.getStatus() == null || user.getStatus().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Status is missing."));
        }
        if (user.getGender() == null || user.getGender().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Gender is missing."));
        }
        if (user.getDateOfBirth() == null || user.getDateOfBirth().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Date of Birth is missing."));
        }
        java.time.LocalDate dobOnboard = parseLocalDate(user.getDateOfBirth());
        if (dobOnboard != null) {
            if (dobOnboard.isAfter(java.time.LocalDate.now())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Date of Birth cannot be in the future."));
            }
        } else {
            return ResponseEntity.badRequest().body(Map.of("message", "Date of Birth format is invalid. Please use YYYY-MM-DD or DD/MM/YYYY."));
        }
        if (user.getAadharNo() == null || user.getAadharNo().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Aadhaar Number is missing."));
        } else {
            String aadhar = user.getAadharNo().trim();
            if (!aadhar.matches("^\\d{12}$")) {
                return ResponseEntity.badRequest().body(Map.of("message", "Aadhaar Number must be exactly 12 digits and contain only numbers."));
            }
            user.setAadharNo(aadhar);
        }
        if (user.getPanNo() == null || user.getPanNo().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "PAN Number is missing."));
        } else {
            String pan = user.getPanNo().trim().toUpperCase();
            if (!pan.matches("^[A-Z]{5}[0-9]{4}[A-Z]{1}$")) {
                return ResponseEntity.badRequest().body(Map.of("message", "PAN Number must be of format: 5 letters, 4 numbers, and 1 letter (e.g., ABCDE1234F)."));
            }
            user.setPanNo(pan);
        }
        if (user.getBloodGroup() == null || user.getBloodGroup().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Blood Group is missing."));
        }
        if (user.getJoiningDate() == null || user.getJoiningDate().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Joining Date is missing."));
        }
        if (user.getAssignedProducts() == null || user.getAssignedProducts().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Products selection is missing."));
        }

        // --- Duplicate Checks ---
        String cleanEmpId = user.getEmployeeId().contains("_")
                ? user.getEmployeeId().substring(user.getEmployeeId().lastIndexOf("_") + 1)
                : user.getEmployeeId();
        String prefixedEmpId = user.getTenant().getCode() + "_" + cleanEmpId;

        boolean employeeExists = false;
        for (TenantUser tu : tenantUserRepository.findByTenantId(user.getTenant().getId())) {
            String tuClean = tu.getEmployeeId() != null && tu.getEmployeeId().contains("_")
                    ? tu.getEmployeeId().substring(tu.getEmployeeId().lastIndexOf("_") + 1)
                    : (tu.getEmployeeId() != null ? tu.getEmployeeId() : "");
            if (Objects.equals(tuClean, cleanEmpId) || Objects.equals(tu.getEmployeeId(), prefixedEmpId)) {
                employeeExists = true;
                break;
            }
        }

        if (employeeExists) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Employee ID is already existing."));
        }
        if (tenantUserRepository.existsByEmail(user.getEmail())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Work Email is already existing."));
        }
        if (user.getPersonalEmail() != null && !user.getPersonalEmail().trim().isEmpty()) {
            if (tenantUserRepository.existsByPersonalEmail(user.getPersonalEmail())) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Personal Email is already existing."));
            }
        }
        if (tenantUserRepository.existsByAadharNo(user.getAadharNo())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Aadhaar Number is already existing."));
        }

        String uppercasePan = user.getPanNo().toUpperCase();
        user.setPanNo(uppercasePan);
        if (tenantUserRepository.existsByPanNo(uppercasePan)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "PAN Number is already existing."));
        }
        if (user.getContactNo() != null && !user.getContactNo().trim().isEmpty()) {
            if (tenantUserRepository.existsByContactNo(user.getContactNo().trim())) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Contact Number is already existing."));
            }
        }

        user.setEmployeeId(prefixedEmpId);

        // Generate and hash a temporary password (ignore any password from frontend)
        String rawPassword = generateTempPassword();
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setMustChangePassword(true);
        if (user.getAccountLocked() == null) {
            user.setAccountLocked(false);
        }
        if (user.getFailedAttemptCount() == null) {
            user.setFailedAttemptCount(0);
        }

        TenantUser savedUser = tenantUserRepository.save(user);

        // Sync to HRMS employee_portal table IMMEDIATELY (synchronous) to ensure employee record is created during onboarding
        boolean syncHrms = true;
        if (syncHrms) {
            try {
                syncToProducts(savedUser, rawPassword);
            } catch (Exception e) {
                System.err.println("[Scaloz] Error syncing to HRMS employee_portal table: " + e.getMessage());
                e.printStackTrace();
                // Continue with onboarding even if HRMS sync fails
            }
        }

        // Send welcome email in background thread (non-blocking)
        new Thread(() -> {
            try {
                sendWelcomeEmail(savedUser.getEmail(), savedUser.getFirstName() + " " + savedUser.getLastName(), savedUser.getEmployeeId(), rawPassword);
                if (savedUser.getPersonalEmail() != null && !savedUser.getPersonalEmail().isBlank()
                        && !savedUser.getPersonalEmail().equals(savedUser.getEmail())) {
                    sendWelcomeEmail(savedUser.getPersonalEmail(), savedUser.getFirstName() + " " + savedUser.getLastName(), savedUser.getEmployeeId(),
                            rawPassword);
                }
            } catch (Exception e) {
                System.err.println("[Scaloz] Background welcome email delivery error: " + e.getMessage());
                e.printStackTrace();
            }
        }).start();

        return ResponseEntity.ok(Map.of("message", "User onboarded successfully. Employee record created in HRMS. Credentials sent via email."));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody TenantUser userDetails) {
        Optional<TenantUser> userOpt = tenantUserRepository.findById(id);
        if (!userOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        TenantUser user = userOpt.get();

        // Validate Aadhaar formatting
        if (userDetails.getAadharNo() != null && !userDetails.getAadharNo().trim().isEmpty()) {
            String aadhar = userDetails.getAadharNo().trim();
            if (!aadhar.matches("^\\d{12}$")) {
                return ResponseEntity.badRequest().body(Map.of("message", "Aadhaar Number must be exactly 12 digits and contain only numbers."));
            }
            userDetails.setAadharNo(aadhar);
        }

        // Validate PAN formatting
        if (userDetails.getPanNo() != null && !userDetails.getPanNo().trim().isEmpty()) {
            String pan = userDetails.getPanNo().trim().toUpperCase();
            if (!pan.matches("^[A-Z]{5}[0-9]{4}[A-Z]{1}$")) {
                return ResponseEntity.badRequest().body(Map.of("message", "PAN Number must be of format: 5 letters, 4 numbers, and 1 letter (e.g., ABCDE1234F)."));
            }
            userDetails.setPanNo(pan);
        }

        // Validate Date of Birth formatting and restrict future dates
        if (userDetails.getDateOfBirth() == null || userDetails.getDateOfBirth().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Date of Birth is missing."));
        }
        java.time.LocalDate dobUpdate = parseLocalDate(userDetails.getDateOfBirth());
        if (dobUpdate != null) {
            if (dobUpdate.isAfter(java.time.LocalDate.now())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Date of Birth cannot be in the future."));
            }
        } else {
            return ResponseEntity.badRequest().body(Map.of("message", "Date of Birth format is invalid. Please use YYYY-MM-DD or DD/MM/YYYY."));
        }

        String cleanEmpId = userDetails.getEmployeeId().contains("_")
                ? userDetails.getEmployeeId().substring(userDetails.getEmployeeId().lastIndexOf("_") + 1)
                : userDetails.getEmployeeId();
        String prefixedEmpId = user.getTenant().getCode() + "_" + cleanEmpId;

        boolean employeeExists = false;
        for (TenantUser tu : tenantUserRepository.findByTenantId(user.getTenant().getId())) {
            if (Objects.equals(tu.getId(), user.getId()))
                continue;
            String tuClean = tu.getEmployeeId() != null && tu.getEmployeeId().contains("_")
                    ? tu.getEmployeeId().substring(tu.getEmployeeId().lastIndexOf("_") + 1)
                    : (tu.getEmployeeId() != null ? tu.getEmployeeId() : "");
            if (Objects.equals(tuClean, cleanEmpId) || Objects.equals(tu.getEmployeeId(), prefixedEmpId)) {
                employeeExists = true;
                break;
            }
        }
        if (employeeExists) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Employee ID is already existing."));
        }


        user.setEmail(userDetails.getEmail());
        user.setRole(userDetails.getRole());
        user.setEmployeeId(prefixedEmpId);
        String oldAssignedProducts = user.getAssignedProducts();
        user.setAssignedProducts(userDetails.getAssignedProducts());
        user.setAssignedModules(userDetails.getAssignedModules());
        user.setIsSubAdmin(userDetails.getIsSubAdmin());
        user.setStatus(userDetails.getStatus());

        // Copy new onboarding fields
        user.setFirstName(userDetails.getFirstName());
        user.setLastName(userDetails.getLastName());
        user.setWorkLocation(userDetails.getWorkLocation());
        user.setPersonalEmail(userDetails.getPersonalEmail());
        user.setGender(userDetails.getGender());
        user.setDateOfBirth(userDetails.getDateOfBirth());
        user.setAadharNo(userDetails.getAadharNo());
        user.setPanNo(userDetails.getPanNo());
        user.setPresentAddress(userDetails.getPresentAddress());
        user.setPermanentAddress(userDetails.getPermanentAddress());
        user.setContactNo(userDetails.getContactNo());
        user.setBloodGroup(userDetails.getBloodGroup());
        user.setJoiningDate(userDetails.getJoiningDate());

        TenantUser savedUser = tenantUserRepository.save(user);

        // Sync to HRMS employee_portal table IMMEDIATELY (synchronous) to ensure employee record is updated
        boolean syncHrms = true;
        if (syncHrms) {
            try {
                syncToProducts(savedUser, null, oldAssignedProducts);
            } catch (Exception e) {
                System.err.println("[Scaloz] Error syncing to HRMS employee_portal table during update: " + e.getMessage());
                e.printStackTrace();
                // Continue with update even if HRMS sync fails
            }
        }
        return ResponseEntity.ok(savedUser);
    }

    public void syncToProducts(TenantUser user, String rawPassword) {
        syncToProducts(user, rawPassword, null);
    }

    public void syncToProducts(TenantUser user, String rawPassword, String oldAssignedProducts) {
        if (user.getRole() != null && user.getRole().equalsIgnoreCase("Admin")) {
            System.out.println("[Scaloz] Skipping sync to products for tenant admin: " + user.getEmployeeId());
            return;
        }
        Tenant tenant = user.getTenant();
        if (tenant == null) {
            System.out.println("[Scaloz] Skipping sync for user " + user.getEmployeeId() + " because tenant is null.");
            return;
        }

        // Get tenant's active products
        java.util.Set<String> activeTenantProducts = new java.util.HashSet<>();
        if (tenant.getSelectedProducts() != null) {
            for (String p : tenant.getSelectedProducts().split(",")) {
                String trimmed = p.trim();
                if (trimmed.isEmpty()) continue;
                String productCode = trimmed;
                String status = "Active";
                if (trimmed.contains(":")) {
                    String[] parts = trimmed.split(":", 2);
                    productCode = parts[0].trim();
                    status = parts[1].trim();
                }
                if (status.equalsIgnoreCase("Active")) {
                    activeTenantProducts.add(productCode);
                }
            }
        }

        if (user.getAssignedProducts() == null || user.getAssignedProducts().trim().isEmpty()) {
            System.out.println("[Scaloz] No products assigned to user " + user.getEmployeeId() + ". Skipping user sync.");
            return;
        }
        
        java.util.List<String> newProductCodes = java.util.Arrays.stream(user.getAssignedProducts().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        java.util.List<String> oldProductCodes = new java.util.ArrayList<>();
        if (oldAssignedProducts != null && !oldAssignedProducts.trim().isEmpty()) {
            java.util.Arrays.stream(oldAssignedProducts.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .forEach(oldProductCodes::add);
        }

        java.util.List<String> productsToSync = new java.util.ArrayList<>();
        for (String code : newProductCodes) {
            if (!oldProductCodes.contains(code)) {
                if (activeTenantProducts.contains(code)) {
                    productsToSync.add(code);
                } else {
                    System.out.println("[Scaloz] Skipping user sync for product " + code + " because it is not active or selected for tenant " + tenant.getCode());
                }
            }
        }

        if (productsToSync.isEmpty()) {
            System.out.println("[Scaloz] No new active products to sync for user " + user.getEmployeeId());
            return;
        }

        for (String productCode : productsToSync) {
            Optional<Product> prodOpt = productRepository.findByCode(productCode);
            if (prodOpt.isPresent()) {
                Product prod = prodOpt.get();
                String syncUrl = prod.getSyncUserUrl();
                if (syncUrl == null || syncUrl.trim().isEmpty()) {
                    String baseUrl = prod.getUrl();
                    if (baseUrl != null && !baseUrl.trim().isEmpty()) {
                        baseUrl = baseUrl.trim();
                        if (baseUrl.endsWith("/")) {
                            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
                        }
                        syncUrl = baseUrl + "/api/external/employees";
                    }
                }
                if (syncUrl == null || syncUrl.trim().isEmpty()) {
                    System.out.println("[Scaloz] No syncUserUrl could be resolved for product " + productCode + ". Skipping sync.");
                    continue;
                }
                
                String apiKey = prod.getApiKey();
                if (apiKey == null || apiKey.trim().isEmpty()) {
                    apiKey = resolveApiKey(productCode);
                }
                
                try {
                    org.springframework.http.client.SimpleClientHttpRequestFactory requestFactory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
                    requestFactory.setConnectTimeout(3000);
                    requestFactory.setReadTimeout(3000);
                    org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate(requestFactory);

                    org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                    headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
                    if (apiKey != null && !apiKey.trim().isEmpty()) {
                        headers.set("X-API-Key", apiKey.trim());
                    }
                    String jwtToken = jwtUtils.generateToken("system_sync", java.util.Map.of("role", "SYSTEM"));
                    headers.set("Authorization", "Bearer " + jwtToken);


                    java.util.Map<String, Object> payload = new java.util.HashMap<>();
                    payload.put("employeeId", user.getEmployeeId());
                    payload.put("firstName", user.getFirstName());
                    payload.put("lastName", user.getLastName());
                    payload.put("email", user.getEmail());
                    String roleToSend = user.getRole();
                    if (Boolean.TRUE.equals(user.getIsSubAdmin())) {
                        roleToSend = "Sub Admin";
                    }
                    payload.put("role", roleToSend);
                    payload.put("tenantId", tenant.getCode());
                    payload.put("tenantName", tenant.getName());
                    payload.put("tenantCode", tenant.getCode());
                    payload.put("workLocation", user.getWorkLocation());
                    payload.put("personalEmail", user.getPersonalEmail());
                    payload.put("gender", user.getGender());
                    payload.put("dateOfBirth", user.getDateOfBirth());
                    payload.put("aadharNo", user.getAadharNo());
                    payload.put("panNo", user.getPanNo());
                    payload.put("presentAddress", user.getPresentAddress());
                    payload.put("permanentAddress", user.getPermanentAddress());
                    payload.put("contactNo", user.getContactNo());
                    payload.put("bloodGroup", user.getBloodGroup());
                    payload.put("joiningDate", user.getJoiningDate());
                    if (rawPassword != null) {
                        payload.put("password", rawPassword);
                    }

                    org.springframework.http.HttpEntity<java.util.Map<String, Object>> requestEntity = new org.springframework.http.HttpEntity<>(payload, headers);

                    System.out.println("[Scaloz] Syncing user " + user.getEmployeeId() + " to product " + productCode + ": " + syncUrl);
                    org.springframework.http.ResponseEntity<String> response = restTemplate.postForEntity(syncUrl, requestEntity, String.class);
                    System.out.println("[Scaloz] Product " + productCode + " user sync response status: " + response.getStatusCode());
                } catch (Exception e) {
                    System.err.println("[Scaloz] Error syncing user to product " + productCode + ": " + e.getMessage());
                    e.printStackTrace();
                }
            } else {
                System.out.println("[Scaloz] Product with code " + productCode + " not found in database. Skipping user sync.");
            }
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        tenantUserRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
    }

    @GetMapping("/search")
    public List<TenantUser> searchUsers(@RequestParam Long tenantId, @RequestParam String query) {
        List<TenantUser> allUsers = tenantUserRepository.searchTenantUsers(tenantId, query);
        List<TenantUser> filtered = new ArrayList<>();
        for (TenantUser u : allUsers) {
            if (u.getRole() != null && u.getRole().equalsIgnoreCase("Admin")) {
                continue;
            }
            filtered.add(u);
        }
        return filtered;
    }

    /**
     * Called by the HRMS backend when a new employee is onboarded there.
     * Creates a matching TenantUser record WITHOUT triggering the reverse HRMS sync
     * (to avoid infinite loops). Secured by X-API-Key header.
     */
    @PostMapping("/sync-from-hrms")
    public ResponseEntity<?> syncFromHrms(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> payload) {

        boolean isAuthenticated = false;

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String jwt = authHeader.substring(7);
            if (jwtUtils.validateToken(jwt) && jwtUtils.validateIssuer(jwt)) {
                isAuthenticated = true;
            }
        }

        if (!isAuthenticated) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized"));
        }

        try {
            String tenantCode = (String) payload.get("tenantCode");
            if (tenantCode == null || tenantCode.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "tenantCode is required"));
            }

            Optional<Tenant> tenantOpt = tenantRepository.findByCode(tenantCode);
            if (!tenantOpt.isPresent()) {
                System.err.println("[Scaloz] sync-from-hrms: Tenant not found for code: " + tenantCode);
                return ResponseEntity.badRequest().body(Map.of("message", "Tenant not found for code: " + tenantCode));
            }
            Tenant tenant = tenantOpt.get();

            String empId = (String) payload.get("employeeId");
            String email = (String) payload.get("email");

            if (empId != null) {
                String cleanEmpId = empId.contains("_") ? empId.substring(empId.lastIndexOf("_") + 1) : empId;
                empId = tenant.getCode() + "_" + cleanEmpId;
            }

            // Idempotency: skip if user already exists
            Optional<TenantUser> existing = tenantUserRepository.findByEmployeeIdAndTenantId(empId, tenant.getId());
            if (existing.isPresent()) {
                return ResponseEntity.ok(Map.of("message", "User already exists, skipping sync."));
            }
            Optional<TenantUser> existingByEmail = tenantUserRepository.findByEmail(email);
            if (existingByEmail.isPresent()) {
                return ResponseEntity.ok(Map.of("message", "Email already exists, skipping sync."));
            }

            String firstName = (String) payload.getOrDefault("firstName", "");
            String lastName = (String) payload.getOrDefault("lastName", "");
            String rawPassword = (String) payload.getOrDefault("password", generateTempPassword());

            TenantUser user = new TenantUser();
            user.setTenant(tenant);
            user.setEmployeeId(empId);
            user.setFirstName(firstName);
            user.setLastName(lastName);
            user.setEmail(email);
            user.setPassword(passwordEncoder.encode(rawPassword));
            user.setMustChangePassword(true);
            user.setRole((String) payload.getOrDefault("role", "Employee"));
            user.setStatus("Active");
            user.setWorkLocation((String) payload.get("workLocation"));
            user.setPersonalEmail((String) payload.get("personalEmail"));
            user.setGender((String) payload.get("gender"));
            user.setDateOfBirth((String) payload.get("dateOfBirth"));
            user.setAadharNo((String) payload.get("aadharNo"));
            user.setPanNo((String) payload.get("panNo"));
            user.setPresentAddress((String) payload.get("presentAddress"));
            user.setPermanentAddress((String) payload.get("permanentAddress"));
            user.setContactNo((String) payload.get("contactNo"));
            user.setEmergencyContactNo((String) payload.get("emergencyContactNo"));
            user.setBloodGroup((String) payload.get("bloodGroup"));
            user.setJoiningDate((String) payload.get("joiningDate"));

            tenantUserRepository.save(user);
            System.out.println("[Scaloz] sync-from-hrms: Created TenantUser for " + empId + " in tenant " + tenantCode);

            return ResponseEntity.ok(Map.of("message", "Synced successfully from HRMS."));
        } catch (Exception e) {
            System.err.println("[Scaloz] sync-from-hrms error: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of("message", "Sync failed: " + e.getMessage()));
        }
    }

    @GetMapping("/template-fields")
    public ResponseEntity<List<String>> getTemplateFields() {
        List<String> fields = new ArrayList<>();
        for (Field field : TenantUser.class.getDeclaredFields()) {
            String name = field.getName();
            // Filter out helper/internal fields
            if (!name.equals("id") && !name.equals("password") && !name.equals("tenant")
                    && !name.equals("resetToken") && !name.equals("resetTokenExpiry")
                    && !name.equals("mustChangePassword")
                    && !name.equals("assignedModules") && !name.equals("isSubAdmin")
                    && !name.equals("failedAttemptCount") && !name.equals("accountLocked")
                    && !name.equals("lastFailedLogin")) {
                fields.add(name);
            }
        }
        return ResponseEntity.ok(fields);
    }

    @PostMapping("/bulk-onboard")
    public ResponseEntity<?> bulkOnboardUsers(@RequestBody List<TenantUser> users) {
        int successCount = 0;
        List<Map<String, String>> failures = new ArrayList<>();

        for (int i = 0; i < users.size(); i++) {
            TenantUser user = users.get(i);
            String rowIdentifier = user.getEmail() != null && !user.getEmail().isEmpty()
                    ? user.getEmail()
                    : (user.getEmployeeId() != null && !user.getEmployeeId().isEmpty() ? user.getEmployeeId()
                            : "Row " + (i + 1));

            try {
                if (user.getTenant() == null || user.getTenant().getId() == null) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Tenant ID is required"));
                    continue;
                }

                Optional<Tenant> tenantOpt = tenantRepository.findById(user.getTenant().getId());
                if (!tenantOpt.isPresent()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Invalid Tenant ID"));
                    continue;
                }

                user.setTenant(tenantOpt.get());


                // Validation checks
                if (user.getEmployeeId() == null || user.getEmployeeId().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Employee ID is missing."));
                    continue;
                }

                String cleanEmpId = user.getEmployeeId().contains("_")
                        ? user.getEmployeeId().substring(user.getEmployeeId().lastIndexOf("_") + 1)
                        : user.getEmployeeId();
                String prefixedEmpId = user.getTenant().getCode() + "_" + cleanEmpId;

                // Check if any existing user in this tenant matches either clean or prefixed
                // Employee ID
                boolean employeeExists = false;
                for (TenantUser tu : tenantUserRepository.findByTenantId(user.getTenant().getId())) {
                    String tuClean = tu.getEmployeeId() != null && tu.getEmployeeId().contains("_")
                            ? tu.getEmployeeId().substring(tu.getEmployeeId().lastIndexOf("_") + 1)
                            : (tu.getEmployeeId() != null ? tu.getEmployeeId() : "");
                    if (Objects.equals(tuClean, cleanEmpId) || Objects.equals(tu.getEmployeeId(), prefixedEmpId)) {
                        employeeExists = true;
                        break;
                    }
                }

                if (employeeExists) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Employee ID is already existing."));
                    continue;
                }

                user.setEmployeeId(prefixedEmpId);

                if (user.getFirstName() == null || user.getFirstName().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "First Name is missing."));
                    continue;
                }

                if (user.getLastName() == null || user.getLastName().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Last Name is missing."));
                    continue;
                }

                if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Work Email is missing."));
                    continue;
                } else if (tenantUserRepository.existsByEmail(user.getEmail())) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Work Email is already existing."));
                    continue;
                }

                if (user.getPersonalEmail() != null && !user.getPersonalEmail().trim().isEmpty()) {
                    if (tenantUserRepository.existsByPersonalEmail(user.getPersonalEmail())) {
                        failures.add(
                                Map.of("identifier", rowIdentifier, "error", "Personal Email is already existing."));
                        continue;
                    }
                }

                if (user.getRole() == null || user.getRole().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Role is missing."));
                    continue;
                }

                if (user.getStatus() == null || user.getStatus().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Status is missing."));
                    continue;
                }

                if (user.getGender() == null || user.getGender().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Gender is missing."));
                    continue;
                }

                if (user.getDateOfBirth() == null || user.getDateOfBirth().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Date of Birth is missing."));
                    continue;
                }
                java.time.LocalDate dobBulk = parseLocalDate(user.getDateOfBirth());
                if (dobBulk != null) {
                    if (dobBulk.isAfter(java.time.LocalDate.now())) {
                        failures.add(Map.of("identifier", rowIdentifier, "error", "Date of Birth cannot be in the future."));
                        continue;
                    }
                } else {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Date of Birth format is invalid. Please use YYYY-MM-DD or DD/MM/YYYY."));
                    continue;
                }

                if (user.getAadharNo() == null || user.getAadharNo().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Aadhaar Number is missing."));
                    continue;
                } else {
                    String aadhar = user.getAadharNo().trim();
                    if (!aadhar.matches("^\\d{12}$")) {
                        failures.add(Map.of("identifier", rowIdentifier, "error", "Aadhaar Number must be exactly 12 digits and contain only numbers."));
                        continue;
                    }
                    user.setAadharNo(aadhar);
                    if (tenantUserRepository.existsByAadharNo(aadhar)) {
                        failures.add(Map.of("identifier", rowIdentifier, "error", "Aadhaar Number is already existing."));
                        continue;
                    }
                }

                if (user.getPanNo() == null || user.getPanNo().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "PAN Number is missing."));
                    continue;
                } else {
                    String uppercasePan = user.getPanNo().trim().toUpperCase();
                    if (!uppercasePan.matches("^[A-Z]{5}[0-9]{4}[A-Z]{1}$")) {
                        failures.add(Map.of("identifier", rowIdentifier, "error", "PAN Number must be of format: 5 letters, 4 numbers, and 1 letter (e.g., ABCDE1234F)."));
                        continue;
                    }
                    user.setPanNo(uppercasePan);
                    if (tenantUserRepository.existsByPanNo(uppercasePan)) {
                        failures.add(Map.of("identifier", rowIdentifier, "error", "PAN Number is already existing."));
                        continue;
                    }
                }

                if (user.getBloodGroup() == null || user.getBloodGroup().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Blood Group is missing."));
                    continue;
                }

                if (user.getJoiningDate() == null || user.getJoiningDate().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Joining Date is missing."));
                    continue;
                }

                if (user.getAssignedProducts() == null || user.getAssignedProducts().trim().isEmpty()) {
                    failures.add(Map.of("identifier", rowIdentifier, "error", "Products selection is missing."));
                    continue;
                }

                if (user.getContactNo() != null && !user.getContactNo().trim().isEmpty()) {
                    if (tenantUserRepository.existsByContactNo(user.getContactNo().trim())) {
                        failures.add(
                                Map.of("identifier", rowIdentifier, "error", "Contact Number is already existing."));
                        continue;
                    }
                }

                // Set default role if empty
                if (user.getRole() == null || user.getRole().isEmpty()) {
                    user.setRole("Employee");
                }

                // Set default status if empty
                if (user.getStatus() == null || user.getStatus().isEmpty()) {
                    user.setStatus("Active");
                }

                // Set default isSubAdmin to false if null
                if (user.getIsSubAdmin() == null) {
                    user.setIsSubAdmin(false);
                }

                // Set default assignedModules to empty string if null
                if (user.getAssignedModules() == null) {
                    user.setAssignedModules("");
                }

                // Generate and hash password
                String rawPassword = generateTempPassword();
                user.setPassword(passwordEncoder.encode(rawPassword));
                user.setMustChangePassword(true);
                if (user.getAccountLocked() == null) {
                    user.setAccountLocked(false);
                }
                if (user.getFailedAttemptCount() == null) {
                    user.setFailedAttemptCount(0);
                }

                TenantUser savedUser = tenantUserRepository.save(user);

                // Sync to HRMS employee_portal table IMMEDIATELY (synchronous) to ensure employee record is created during onboarding
                boolean syncHrms = true;
                try {
                    if (syncHrms) {
                        syncToProducts(savedUser, rawPassword);
                    }
                } catch (Exception e) {
                    System.err.println("[Scaloz] Warning: Sync to HRMS failed for bulk user " + rowIdentifier + ": "
                            + e.getMessage());
                    e.printStackTrace();
                    // Continue with onboarding even if HRMS sync fails
                }

                // Send welcome email in background thread (non-blocking)
                new Thread(() -> {
                    try {
                        sendWelcomeEmail(savedUser.getEmail(), savedUser.getFirstName() + " " + savedUser.getLastName(), savedUser.getEmployeeId(),
                                rawPassword);
                        if (savedUser.getPersonalEmail() != null && !savedUser.getPersonalEmail().isBlank()
                                && !savedUser.getPersonalEmail().equals(savedUser.getEmail())) {
                            sendWelcomeEmail(savedUser.getPersonalEmail(), savedUser.getFirstName() + " " + savedUser.getLastName(),
                                    savedUser.getEmployeeId(), rawPassword);
                        }
                    } catch (Exception e) {
                        System.err.println("[Scaloz] Warning: Welcome email failed for bulk user " + rowIdentifier
                                + ": " + e.getMessage());
                        e.printStackTrace();
                    }
                }).start();

                successCount++;

            } catch (Exception e) {
                failures.add(Map.of("identifier", rowIdentifier, "error", "Unexpected error: " + e.getMessage()));
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("successCount", successCount);
        result.put("failureCount", failures.size());
        result.put("failures", failures);

        return ResponseEntity.ok(result);
    }

    /**
     * Migrate employees from HRMS employee_portal table to tenant_users table
     * POST /api/tenant-users/migrate-from-hrms
     * Fetches all employees from HRMS and syncs them to tenant-users table
     */
    @PostMapping("/migrate-from-hrms")
    public ResponseEntity<?> migrateFromHrms() {
        try {
            org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();

            // Build headers
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            String jwtToken = jwtUtils.generateToken("system_sync", java.util.Map.of("role", "SYSTEM"));
            headers.set("Authorization", "Bearer " + jwtToken);

            org.springframework.http.HttpEntity<String> requestEntity = new org.springframework.http.HttpEntity<>(headers);

            // Fetch all employees from HRMS with sensitive data (password, PAN, Aadhar)
            String hrmsMigrationUrl = hrmsApiUrl.replace("/employees", "/employees/migration");
            System.out.println("[Scaloz] Fetching employees from HRMS for migration: " + hrmsMigrationUrl);
            org.springframework.http.ResponseEntity<java.util.Map> response = restTemplate.exchange(
                    hrmsMigrationUrl,
                    org.springframework.http.HttpMethod.GET,
                    requestEntity,
                    java.util.Map.class);

            java.util.Map<String, Object> responseBody = response.getBody();
            if (responseBody == null || !Boolean.TRUE.equals(responseBody.get("success"))) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("message", "Failed to fetch employees from HRMS"));
            }

            java.util.List<java.util.Map<String, Object>> employees = (java.util.List<java.util.Map<String, Object>>) responseBody.get("data");
            int successCount = 0;
            int skipCount = 0;
            int failureCount = 0;
            java.util.List<java.util.Map<String, String>> failures = new java.util.ArrayList<>();

            for (java.util.Map<String, Object> empData : employees) {
                try {
                    String employeeId = (String) empData.get("employeeId");
                    String email = (String) empData.get("email");
                    String tenantId = (String) empData.get("tenantId");

                    // Check if employee already exists in tenant_users
                    if (tenantUserRepository.findByEmployeeIdAndTenantId(employeeId, null).isPresent() ||
                        tenantUserRepository.existsByEmail(email)) {
                        skipCount++;
                        continue;
                    }

                    // Resolve tenant from tenantId
                    Optional<Tenant> tenantOpt = tenantRepository.findByCode(tenantId);
                    if (!tenantOpt.isPresent()) {
                        failures.add(Map.of("employeeId", employeeId, "error", "Tenant not found in Scaloz"));
                        failureCount++;
                        continue;
                    }

                    // Map Employee fields to TenantUser
                    TenantUser tenantUser = new TenantUser();
                    tenantUser.setEmployeeId(employeeId);
                    tenantUser.setFirstName((String) empData.get("firstName"));
                    tenantUser.setLastName((String) empData.get("lastName"));

                    tenantUser.setEmail(email);
                    tenantUser.setPassword((String) empData.get("password")); // Keep existing password
                    tenantUser.setRole((String) empData.get("role"));
                    tenantUser.setTenant(tenantOpt.get());
                    tenantUser.setWorkLocation((String) empData.get("workLocation"));
                    tenantUser.setPersonalEmail((String) empData.get("personalMail"));
                    tenantUser.setGender((String) empData.get("gender"));
                    tenantUser.setDateOfBirth(empData.get("dateOfBirth") != null ? empData.get("dateOfBirth").toString() : null);
                    tenantUser.setAadharNo((String) empData.get("aadharNo"));
                    tenantUser.setPanNo((String) empData.get("panNo"));
                    tenantUser.setPresentAddress((String) empData.get("presentAddress"));
                    tenantUser.setPermanentAddress((String) empData.get("address")); // address maps to permanentAddress
                    tenantUser.setContactNo((String) empData.get("contactNo"));
                    tenantUser.setBloodGroup((String) empData.get("bloodGroup"));
                    tenantUser.setJoiningDate(empData.get("joiningDate") != null ? empData.get("joiningDate").toString() : null);
                    tenantUser.setStatus("Active");
                    tenantUser.setAssignedProducts(""); // Keep as empty
                    tenantUser.setMustChangePassword(false);

                    // Save to tenant_users
                    tenantUserRepository.save(tenantUser);
                    successCount++;

                } catch (Exception e) {
                    String employeeId = empData.get("employeeId") != null ? empData.get("employeeId").toString() : "unknown";
                    failures.add(Map.of("employeeId", employeeId, "error", e.getMessage()));
                    failureCount++;
                }
            }

            java.util.Map<String, Object> result = new HashMap<>();
            result.put("totalEmployees", employees.size());
            result.put("successCount", successCount);
            result.put("skipCount", skipCount);
            result.put("failureCount", failureCount);
            result.put("failures", failures);
            result.put("message", "Migration completed. " + successCount + " employees migrated, " + skipCount + " skipped (already exist), " + failureCount + " failed.");

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            System.err.println("[Scaloz] Error during migration from HRMS: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Migration failed: " + e.getMessage()));
        }
    }
}
