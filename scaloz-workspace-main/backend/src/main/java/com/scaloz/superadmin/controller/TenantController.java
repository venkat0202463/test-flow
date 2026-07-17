package com.scaloz.superadmin.controller;

import com.scaloz.superadmin.dto.TenantDTO;
import com.scaloz.superadmin.service.TenantService;
import com.scaloz.superadmin.repository.TenantRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tenants")
public class TenantController {

    @Autowired
    private TenantService tenantService;

    @Autowired
    private TenantRepository tenantRepository;

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

    @GetMapping
    public List<TenantDTO> getAllTenants() {
        return tenantService.getAllTenants();
    }

    @PostMapping
    public ResponseEntity<?> createTenant(@RequestBody TenantDTO tenantDTO) {
        if (tenantDTO.getName() != null && tenantDTO.getName().length() > 100) {
            return ResponseEntity.badRequest().body("Tenant Name cannot exceed 100 characters.");
        }
        if (tenantDTO.getCode() != null && tenantDTO.getCode().length() > 50) {
            return ResponseEntity.badRequest().body("Tenant Code cannot exceed 50 characters.");
        }
        if (tenantDTO.getEmail() != null && tenantDTO.getEmail().length() > 50) {
            return ResponseEntity.badRequest().body("Company Email cannot exceed 50 characters.");
        }
        if (tenantDTO.getPhone() != null && tenantDTO.getPhone().length() > 10) {
            return ResponseEntity.badRequest().body("Company Phone cannot exceed 10 characters.");
        }
        if (tenantDTO.getWebsite() != null && tenantDTO.getWebsite().length() > 100) {
            return ResponseEntity.badRequest().body("Company Website cannot exceed 100 characters.");
        }
        if (tenantDTO.getAddress() != null && tenantDTO.getAddress().length() > 255) {
            return ResponseEntity.badRequest().body("Company Address cannot exceed 255 characters.");
        }
        if (tenantDTO.getAdminEmail() != null && tenantDTO.getAdminEmail().length() > 50) {
            return ResponseEntity.badRequest().body("Admin Email cannot exceed 50 characters.");
        }

        if (tenantDTO.getEmail() != null && !tenantDTO.getEmail().matches("^\\S+@\\S+\\.\\S+$")) {
            return ResponseEntity.badRequest().body("Company Email format is invalid.");
        }
        if (tenantDTO.getAdminEmail() != null && !tenantDTO.getAdminEmail().matches("^\\S+@\\S+\\.\\S+$")) {
            return ResponseEntity.badRequest().body("Admin Email format is invalid.");
        }
        if (tenantDTO.getPhone() != null && !tenantDTO.getPhone().matches("^\\d{10}$")) {
            return ResponseEntity.badRequest().body("Company Phone must be a 10-digit number.");
        }

        if (tenantRepository.findByCode(tenantDTO.getCode()).isPresent()) {
            return ResponseEntity.badRequest().body("Tenant ID is already existing.");
        }
        
        if (tenantDTO.getAdminEmail() != null && !tenantDTO.getAdminEmail().trim().isEmpty()) {
            if (tenantRepository.findByAdminEmail(tenantDTO.getAdminEmail().trim()).size() > 0) {
                return ResponseEntity.badRequest().body("Admin Email is already existing.");
            }
        }

        try {
            TenantDTO savedTenant = tenantService.createTenant(tenantDTO);
            return ResponseEntity.ok(savedTenant);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error creating tenant: " + e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTenant(@PathVariable Long id, @RequestBody TenantDTO updatedTenantDTO) {
        if (updatedTenantDTO.getName() != null && updatedTenantDTO.getName().length() > 100) {
            return ResponseEntity.badRequest().body("Tenant Name cannot exceed 100 characters.");
        }
        if (updatedTenantDTO.getCode() != null && updatedTenantDTO.getCode().length() > 50) {
            return ResponseEntity.badRequest().body("Tenant Code cannot exceed 50 characters.");
        }
        if (updatedTenantDTO.getEmail() != null && updatedTenantDTO.getEmail().length() > 50) {
            return ResponseEntity.badRequest().body("Company Email cannot exceed 50 characters.");
        }
        if (updatedTenantDTO.getPhone() != null && updatedTenantDTO.getPhone().length() > 10) {
            return ResponseEntity.badRequest().body("Company Phone cannot exceed 10 characters.");
        }
        if (updatedTenantDTO.getWebsite() != null && updatedTenantDTO.getWebsite().length() > 100) {
            return ResponseEntity.badRequest().body("Company Website cannot exceed 100 characters.");
        }
        if (updatedTenantDTO.getAddress() != null && updatedTenantDTO.getAddress().length() > 255) {
            return ResponseEntity.badRequest().body("Company Address cannot exceed 255 characters.");
        }
        if (updatedTenantDTO.getAdminEmail() != null && updatedTenantDTO.getAdminEmail().length() > 50) {
            return ResponseEntity.badRequest().body("Admin Email cannot exceed 50 characters.");
        }

        if (updatedTenantDTO.getEmail() != null && !updatedTenantDTO.getEmail().matches("^\\S+@\\S+\\.\\S+$")) {
            return ResponseEntity.badRequest().body("Company Email format is invalid.");
        }
        if (updatedTenantDTO.getAdminEmail() != null && !updatedTenantDTO.getAdminEmail().matches("^\\S+@\\S+\\.\\S+$")) {
            return ResponseEntity.badRequest().body("Admin Email format is invalid.");
        }
        if (updatedTenantDTO.getPhone() != null && !updatedTenantDTO.getPhone().matches("^\\d{10}$")) {
            return ResponseEntity.badRequest().body("Company Phone must be a 10-digit number.");
        }

        try {
            TenantDTO savedTenant = tenantService.updateTenant(id, updatedTenantDTO);
            return ResponseEntity.ok(savedTenant);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error updating tenant: " + e.getMessage());
        }
    }

    /**
     * POST /api/tenants/upload-logo
     * Accepts a multipart image file, converts it to base64, and returns the data URL.
     */
    @PostMapping(value = "/upload-logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadLogo(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No file provided."));
        }
        if (file.getSize() > 2 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("message", "Logo file must be smaller than 2MB."));
        }

        try {
            byte[] bytes = file.getBytes();
            String contentType = file.getContentType();
            if (contentType == null) {
                contentType = "image/png";
            }
            String base64 = java.util.Base64.getEncoder().encodeToString(bytes);
            String logoUrl = "data:" + contentType + ";base64," + base64;
            return ResponseEntity.ok(Map.of("logoUrl", logoUrl));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to process logo: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTenant(@PathVariable Long id) {
        try {
            tenantService.deleteTenant(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
