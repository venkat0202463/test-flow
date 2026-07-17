package com.scaloz.superadmin.model;

import jakarta.persistence.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Entity
@Table(name = "tenants")
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_name", length = 100, nullable = false)
    private String name;

    @Column(name = "tenant_code", length = 50, nullable = false, unique = true)
    private String code;

    @Column(name = "company_email", length = 50, nullable = false)
    private String email;

    @Column(name = "company_phone", length = 10)
    private String phone;

    @Column(name = "company_website", length = 100)
    private String website;

    @Column(name = "company_size")
    private String companySize;

    @Column(name = "company_address", length = 255)
    private String address;

    @Lob
    @Column(name = "company_logo")
    @org.hibernate.annotations.JdbcType(org.hibernate.type.descriptor.jdbc.VarbinaryJdbcType.class)
    private byte[] companyLogo;

    // Admin Details
    @Column(name = "admin_email", length = 50)
    private String adminEmail;

    @Column(name = "selected_products", columnDefinition = "TEXT")
    private String selectedProducts;

    @Transient
    private String selectedModules;

    @Transient
    private String subscriptionPlan;

    @Column(name = "status")
    private String status = "Active";

    public Tenant() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getWebsite() {
        return website;
    }

    public void setWebsite(String website) {
        this.website = website;
    }



    public String getCompanySize() {
        return companySize;
    }

    public void setCompanySize(String companySize) {
        this.companySize = companySize;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    @Transient
    public String getLogo() {
        if (this.companyLogo == null || this.companyLogo.length == 0) {
            return null;
        }
        if (isLegacyFilename(this.companyLogo)) {
            return null;
        }
        String base64 = java.util.Base64.getEncoder().encodeToString(this.companyLogo);
        return "data:image/png;base64," + base64;
    }

    private boolean isLegacyFilename(byte[] data) {
        if (data == null || data.length == 0 || data.length > 500) {
            return false;
        }
        try {
            String str = new String(data, java.nio.charset.StandardCharsets.UTF_8).trim();
            return str.toLowerCase().endsWith(".png") ||
                   str.toLowerCase().endsWith(".jpg") ||
                   str.toLowerCase().endsWith(".jpeg") ||
                   str.toLowerCase().endsWith(".gif") ||
                   str.toLowerCase().endsWith(".svg") ||
                   str.contains("/") ||
                   str.contains("\\");
        } catch (Exception e) {
            return false;
        }
    }

    public void setLogo(String logoStr) {
        if (logoStr == null || logoStr.trim().isEmpty()) {
            this.companyLogo = null;
            return;
        }
        if (logoStr.startsWith("data:image/")) {
            try {
                int commaIndex = logoStr.indexOf(',');
                if (commaIndex != -1) {
                    String base64Data = logoStr.substring(commaIndex + 1);
                    this.companyLogo = java.util.Base64.getDecoder().decode(base64Data.trim());
                }
            } catch (Exception e) {
                System.err.println("Failed to decode base64 logo: " + e.getMessage());
            }
        } else {
            // In case it's raw base64 or legacy value that doesn't start with data:image
            try {
                this.companyLogo = java.util.Base64.getDecoder().decode(logoStr.trim());
            } catch (Exception e) {
                // If it fails, treat it as null
                this.companyLogo = null;
            }
        }
    }



    public String getAdminEmail() {
        return adminEmail;
    }

    public void setAdminEmail(String adminEmail) {
        this.adminEmail = adminEmail;
    }



    public String getSelectedProducts() {
        return selectedProducts;
    }

    public void setSelectedProducts(String selectedProducts) {
        this.selectedProducts = selectedProducts;
    }

    public String getSelectedModules() {
        return selectedModules;
    }

    public void setSelectedModules(String selectedModules) {
        this.selectedModules = selectedModules;
    }

    public String getSubscriptionPlan() {
        return subscriptionPlan;
    }

    public void setSubscriptionPlan(String subscriptionPlan) {
        this.subscriptionPlan = subscriptionPlan;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }


}
