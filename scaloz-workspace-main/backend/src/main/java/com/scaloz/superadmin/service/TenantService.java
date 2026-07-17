package com.scaloz.superadmin.service;

import com.scaloz.superadmin.dto.TenantDTO;
import com.scaloz.superadmin.model.Tenant;
import com.scaloz.superadmin.model.Subscription;
import com.scaloz.superadmin.model.TenantModule;
import com.scaloz.superadmin.model.ProductModule;
import com.scaloz.superadmin.model.Product;
import com.scaloz.superadmin.repository.TenantRepository;
import com.scaloz.superadmin.repository.SubscriptionRepository;
import com.scaloz.superadmin.repository.TenantModuleRepository;
import com.scaloz.superadmin.repository.ProductModuleRepository;
import com.scaloz.superadmin.repository.ProductRepository;
import com.scaloz.superadmin.repository.TenantUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class TenantService {

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private TenantModuleRepository tenantModuleRepository;

    @Autowired
    private ProductModuleRepository productModuleRepository;

    @Autowired
    private TenantUserRepository tenantUserRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private com.scaloz.superadmin.security.JwtUtils jwtUtils;

    @Autowired(required = false)
    private org.springframework.mail.javamail.JavaMailSender mailSender;

    @org.springframework.beans.factory.annotation.Value("${spring.mail.username:noreply@scaloz.com}")
    private String fromEmail;

    @org.springframework.beans.factory.annotation.Value("${hrms.api.url}")
    private String hrmsApiUrl;

    @org.springframework.beans.factory.annotation.Value("${hrms.api.key:}")
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

    private final org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder passwordEncoder = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();

    private static final String CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!";
    private static final int PASSWORD_LENGTH = 10;

    private String generateTempPassword() {
        java.security.SecureRandom random = new java.security.SecureRandom();
        StringBuilder sb = new StringBuilder(PASSWORD_LENGTH);
        for (int i = 0; i < PASSWORD_LENGTH; i++) {
            sb.append(CHARACTERS.charAt(random.nextInt(CHARACTERS.length())));
        }
        return sb.toString();
    }

    private void sendAdminWelcomeEmail(String toEmail, String tenantName, String tempPassword, String productNames) {
        if (mailSender == null) {
            System.err.println("[Scaloz] ERROR: mailSender is null! Check Spring Boot Mail properties.");
            return;
        }
        if (toEmail == null || toEmail.isBlank()) {
            System.err.println("[Scaloz] ERROR: toEmail is blank!");
            return;
        }
        try {
            org.springframework.mail.SimpleMailMessage message = new org.springframework.mail.SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Welcome to Scaloz - Your Tenant Workspace Credentials");
            message.setText(
                    "Dear Administrator,\n\n" +
                    "Your tenant workspace '" + tenantName + "' has been successfully created.\n\n" +
                    "Here are your credentials to access the portal:\n" +
                    "Portal Link: https://scaloz.com\n" +
                    "Admin Email: " + toEmail + "\n" +
                    "Temporary Password: " + tempPassword + "\n\n" +
                    "Assigned Products: " + productNames + "\n\n" +
                    "Please log in and update your password when prompted.\n\n" +
                    "Best regards,\nScaloz Team");
            mailSender.send(message);
            System.out.println("[Scaloz] SUCCESS: Admin welcome email sent to: " + toEmail);
        } catch (Exception e) {
            System.err.println("[Scaloz] ERROR: Could not send welcome email to admin " + toEmail + ": " + e.getMessage());
        }
    }

    public static boolean isProductActive(String selectedProducts, String productCode) {
        if (selectedProducts == null || selectedProducts.trim().isEmpty()) {
            return false;
        }
        String[] products = selectedProducts.split(",");
        for (String p : products) {
            String trimmed = p.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (trimmed.contains(":")) {
                String[] parts = trimmed.split(":", 2);
                String code = parts[0].trim();
                String status = parts[1].trim();
                if (code.equalsIgnoreCase(productCode)) {
                    return status.equalsIgnoreCase("Active");
                }
            } else {
                if (trimmed.equalsIgnoreCase(productCode)) {
                    return true;
                }
            }
        }
        return false;
    }

    private void syncTenantToProducts(Tenant tenant) {
        String selectedProducts = tenant.getSelectedProducts();
        if (selectedProducts == null || selectedProducts.trim().isEmpty()) {
            System.out.println("[Scaloz] No products selected for tenant " + tenant.getCode() + ". Skipping sync.");
            return;
        }
        String[] products = selectedProducts.split(",");
        for (String p : products) {
            String trimmed = p.trim();
            if (trimmed.isEmpty()) continue;
            String productCode = trimmed;
            if (trimmed.contains(":")) {
                String[] parts = trimmed.split(":", 2);
                productCode = parts[0].trim();
                String status = parts[1].trim();
                if (!status.equalsIgnoreCase("Active")) {
                    System.out.println("[Scaloz] Skipping tenant sync for product " + productCode + " because status is " + status);
                    continue;
                }
            }
            
            Optional<Product> prodOpt = productRepository.findByCode(productCode);
            if (prodOpt.isPresent()) {
                Product prod = prodOpt.get();
                String syncUrl = prod.getSyncTenantUrl();
                if (syncUrl == null || syncUrl.trim().isEmpty()) {
                    String baseUrl = prod.getUrl();
                    if (baseUrl != null && !baseUrl.trim().isEmpty()) {
                        baseUrl = baseUrl.trim();
                        if (baseUrl.endsWith("/")) {
                            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
                        }
                        syncUrl = baseUrl + "/api/external/tenants";
                    }
                }
                if (syncUrl == null || syncUrl.trim().isEmpty()) {
                    System.out.println("[Scaloz] No syncTenantUrl could be resolved for product " + productCode + ". Skipping sync.");
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
                    payload.put("tenantId", tenant.getCode());
                    payload.put("tenantName", tenant.getName());

                    org.springframework.http.HttpEntity<java.util.Map<String, Object>> requestEntity = new org.springframework.http.HttpEntity<>(payload, headers);

                    System.out.println("[Scaloz] Syncing tenant " + tenant.getCode() + " to product " + productCode + ": " + syncUrl);
                    org.springframework.http.ResponseEntity<String> response = restTemplate.postForEntity(syncUrl, requestEntity, String.class);
                    System.out.println("[Scaloz] Product " + productCode + " tenant sync response: " + response.getStatusCode());
                } catch (Exception e) {
                    System.err.println("[Scaloz] Error syncing tenant to product " + productCode + ": " + e.getMessage());
                    e.printStackTrace();
                }
            } else {
                System.out.println("[Scaloz] Product with code " + productCode + " not found in database. Skipping sync.");
            }
        }
    }

    public List<TenantDTO> getAllTenants() {
        List<Tenant> tenants = tenantRepository.findAll();
        List<TenantDTO> dtos = new ArrayList<>();
        for (Tenant t : tenants) {
            TenantDTO dto = convertToDTO(t);
            // Fetch subscription details
            subscriptionRepository.findByTenantId(t.getId()).ifPresent(sub -> {
                dto.setSubscriptionPlan(sub.getPlanName());
            });
            
            // Fetch selected modules and deduce selected products
            List<TenantModule> tMods = tenantModuleRepository.findByTenantId(t.getId());
            List<String> modNames = new ArrayList<>();
            List<String> prodCodes = new ArrayList<>();
            for (TenantModule tm : tMods) {
                ProductModule pm = tm.getProductModule();
                if (pm != null) {
                    modNames.add(pm.getName());
                    Product p = pm.getProduct();
                    if (p != null && !prodCodes.contains(p.getCode())) {
                        prodCodes.add(p.getCode());
                    }
                }
            }
            dto.setSelectedModules(String.join(", ", modNames));
            if (dto.getSelectedProducts() == null || dto.getSelectedProducts().trim().isEmpty()) {
                dto.setSelectedProducts(String.join(", ", prodCodes));
            }
            dtos.add(dto);
        }
        return dtos;
    }

    @Transactional
    public TenantDTO createTenant(TenantDTO tenantDTO) {
        Tenant tenant = convertToEntity(tenantDTO);
        Tenant savedTenant = tenantRepository.save(tenant);
        
        // 2. Save Subscription
        String planName = tenantDTO.getSubscriptionPlan() != null ? tenantDTO.getSubscriptionPlan() : "Standard Plan";
        Integer userLimit = 100; // default user limit
        if (planName.toLowerCase().contains("users")) {
            try {
                String clean = planName.replaceAll("[^0-9]", "");
                if (!clean.isEmpty()) {
                    userLimit = Integer.parseInt(clean);
                }
            } catch (Exception ignored) {}
        }
        Subscription subscription = new Subscription(planName, userLimit, "Active", savedTenant);
        subscriptionRepository.save(subscription);
        
        // 3. Save Tenant Modules
        if (tenantDTO.getSelectedModules() != null && !tenantDTO.getSelectedModules().trim().isEmpty()) {
            String[] modules = tenantDTO.getSelectedModules().split(",");
            for (String modName : modules) {
                String trimmed = modName.trim();
                if (!trimmed.isEmpty()) {
                    Optional<ProductModule> modOpt = productModuleRepository.findByName(trimmed);
                    if (modOpt.isPresent()) {
                        tenantModuleRepository.save(new TenantModule(savedTenant, modOpt.get()));
                    } else {
                        Optional<ProductModule> modCodeOpt = productModuleRepository.findByCode(trimmed);
                        if (modCodeOpt.isPresent()) {
                            tenantModuleRepository.save(new TenantModule(savedTenant, modCodeOpt.get()));
                        }
                    }
                }
            }
        }
        
        // 4. Create Tenant Admin in tenant_users
        String tempPassword = generateTempPassword();
        com.scaloz.superadmin.model.TenantUser adminUser = new com.scaloz.superadmin.model.TenantUser();
        adminUser.setTenant(savedTenant);
        adminUser.setEmployeeId(savedTenant.getCode() + "_admin");
        adminUser.setFirstName("Admin");
        adminUser.setLastName("User");
        adminUser.setEmail(savedTenant.getAdminEmail());
        adminUser.setRole("Admin");
        adminUser.setPassword(passwordEncoder.encode(tempPassword));
        adminUser.setMustChangePassword(true);
        adminUser.setStatus("Active");
        adminUser.setAssignedProducts(savedTenant.getSelectedProducts());
        tenantUserRepository.save(adminUser);
        System.out.println("[Scaloz DEBUG] Created tenant admin user. Email: " + savedTenant.getAdminEmail() + ", Temp Password: " + tempPassword);
        
        // 5. Send welcome email to the Admin
        String selectedProducts = savedTenant.getSelectedProducts();
        new Thread(() -> {
            try {
                List<String> prodNames = new ArrayList<>();
                if (selectedProducts != null && !selectedProducts.trim().isEmpty()) {
                    String[] codes = selectedProducts.split(",");
                    for (String code : codes) {
                        String cleanCode = code.trim();
                        if (cleanCode.contains(":")) {
                            cleanCode = cleanCode.split(":", 2)[0].trim();
                        }
                        productRepository.findByCode(cleanCode).ifPresent(p -> prodNames.add(p.getName()));
                    }
                }
                String productNames = String.join(", ", prodNames);
                sendAdminWelcomeEmail(savedTenant.getAdminEmail(), savedTenant.getName(), tempPassword, productNames);
            } catch (Exception e) {
                System.err.println("[Scaloz] Background welcome email delivery error: " + e.getMessage());
                e.printStackTrace();
            }
        }).start();

        // Sync Tenant to employee portal database
        syncTenantToProducts(savedTenant);

        return convertToDTO(savedTenant);
    }

    @Transactional
    public TenantDTO updateTenant(Long id, TenantDTO updatedTenantDTO) {
        Optional<Tenant> tenantOpt = tenantRepository.findById(id);
        if (!tenantOpt.isPresent()) {
            throw new RuntimeException("Tenant not found");
        }
        
        Tenant existingTenant = tenantOpt.get();
        existingTenant.setName(updatedTenantDTO.getName());
        existingTenant.setEmail(updatedTenantDTO.getEmail());
        existingTenant.setPhone(updatedTenantDTO.getPhone());
        existingTenant.setWebsite(updatedTenantDTO.getWebsite());
        existingTenant.setCompanySize(updatedTenantDTO.getCompanySize());
        existingTenant.setAddress(updatedTenantDTO.getAddress());
        if (updatedTenantDTO.getLogo() != null) {
            existingTenant.setLogo(updatedTenantDTO.getLogo());
        }
        existingTenant.setSelectedProducts(updatedTenantDTO.getSelectedProducts());
        if (updatedTenantDTO.getAdminEmail() != null) {
            existingTenant.setAdminEmail(updatedTenantDTO.getAdminEmail());
        }
        if (updatedTenantDTO.getStatus() != null) {
            existingTenant.setStatus(updatedTenantDTO.getStatus());
        }
        
        tenantRepository.save(existingTenant);
        
        // Update admin user
        Optional<com.scaloz.superadmin.model.TenantUser> adminUserOpt = tenantUserRepository.findByTenantId(id).stream()
            .filter(u -> "Admin".equalsIgnoreCase(u.getRole()))
            .findFirst();
        if (adminUserOpt.isPresent()) {
            com.scaloz.superadmin.model.TenantUser adminUser = adminUserOpt.get();
            adminUser.setAssignedProducts(existingTenant.getSelectedProducts());
            if (existingTenant.getAdminEmail() != null) {
                adminUser.setEmail(existingTenant.getAdminEmail());
            }
            tenantUserRepository.save(adminUser);
        }
        
        // Update subscription
        Optional<Subscription> subOpt = subscriptionRepository.findByTenantId(id);
        String planName = updatedTenantDTO.getSubscriptionPlan() != null ? updatedTenantDTO.getSubscriptionPlan() : "Standard Plan";
        if (subOpt.isPresent()) {
            Subscription subscription = subOpt.get();
            subscription.setPlanName(planName);
            subscriptionRepository.save(subscription);
        } else {
            Subscription subscription = new Subscription(planName, 100, "Active", existingTenant);
            subscriptionRepository.save(subscription);
        }
        
        // Update modules
        tenantModuleRepository.deleteByTenantId(id);
        tenantModuleRepository.flush();
        
        if (updatedTenantDTO.getSelectedModules() != null && !updatedTenantDTO.getSelectedModules().trim().isEmpty()) {
            String[] modules = updatedTenantDTO.getSelectedModules().split(",");
            for (String modName : modules) {
                String trimmed = modName.trim();
                if (!trimmed.isEmpty()) {
                    Optional<ProductModule> modOpt = productModuleRepository.findByName(trimmed);
                    if (modOpt.isPresent()) {
                        tenantModuleRepository.save(new TenantModule(existingTenant, modOpt.get()));
                    } else {
                        Optional<ProductModule> modCodeOpt = productModuleRepository.findByCode(trimmed);
                        if (modCodeOpt.isPresent()) {
                            tenantModuleRepository.save(new TenantModule(existingTenant, modCodeOpt.get()));
                        }
                    }
                }
            }
        }
        
        // Sync updated Tenant details to employee portal database
        syncTenantToProducts(existingTenant);
        
        // Force flush
        tenantRepository.flush();
        tenantUserRepository.flush();
        subscriptionRepository.flush();
        tenantModuleRepository.flush();
        
        return convertToDTO(existingTenant);
    }

    @Transactional
    public void deleteTenant(Long id) {
        if (tenantRepository.existsById(id)) {
            subscriptionRepository.deleteByTenantId(id);
            tenantModuleRepository.deleteByTenantId(id);
            tenantRepository.deleteById(id);
        } else {
            throw new RuntimeException("Tenant not found");
        }
    }

    private TenantDTO convertToDTO(Tenant tenant) {
        TenantDTO dto = new TenantDTO();
        dto.setId(tenant.getId());
        dto.setName(tenant.getName());
        dto.setCode(tenant.getCode());
        dto.setEmail(tenant.getEmail());
        dto.setPhone(tenant.getPhone());
        dto.setWebsite(tenant.getWebsite());
        dto.setCompanySize(tenant.getCompanySize());
        dto.setAddress(tenant.getAddress());
        dto.setLogo(tenant.getLogo());
        dto.setAdminEmail(tenant.getAdminEmail());
        dto.setSelectedProducts(tenant.getSelectedProducts());
        dto.setStatus(tenant.getStatus());
        return dto;
    }

    private Tenant convertToEntity(TenantDTO dto) {
        Tenant tenant = new Tenant();
        tenant.setId(dto.getId());
        tenant.setName(dto.getName());
        tenant.setCode(dto.getCode());
        tenant.setEmail(dto.getEmail());
        tenant.setPhone(dto.getPhone());
        tenant.setWebsite(dto.getWebsite());
        tenant.setCompanySize(dto.getCompanySize());
        tenant.setAddress(dto.getAddress());
        tenant.setLogo(dto.getLogo());
        tenant.setAdminEmail(dto.getAdminEmail());
        tenant.setSelectedProducts(dto.getSelectedProducts());
        if (dto.getStatus() != null) {
            tenant.setStatus(dto.getStatus());
        }
        return tenant;
    }
}
