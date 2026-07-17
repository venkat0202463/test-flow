package com.scaloz.superadmin.model;

import jakarta.persistence.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Entity
@Table(name = "products")
public class Product {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "product_name", length = 100, nullable = false)
    private String name;

    @Column(name = "product_code", length = 50, nullable = true)
    private String code;
    
    @Column(name = "product_url", length = 100, nullable = false)
    private String url;
    
    @Lob
    @Column(name = "product_icon")
    @org.hibernate.annotations.JdbcType(org.hibernate.type.descriptor.jdbc.VarbinaryJdbcType.class)
    private byte[] productIcon;

    @Column(name = "product_content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "product_status", nullable = true)
    private String status = "Active";

    @Column(name = "sync_tenant_url", length = 255, nullable = true)
    private String syncTenantUrl;

    @Column(name = "sync_user_url", length = 255, nullable = true)
    private String syncUserUrl;

    @Column(name = "api_key", length = 255, nullable = true)
    private String apiKey;

    public Product() {}

    public Product(String name, String code, String url, String icon, String content, String status) {
        this.name = name;
        this.code = code;
        this.url = url;
        setIcon(icon);
        this.content = content;
        this.status = status;
    }

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

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    @Transient
    public String getIcon() {
        if (this.productIcon == null || this.productIcon.length == 0) {
            return null;
        }
        if (isLegacyFilename(this.productIcon)) {
            return null;
        }
        String base64 = java.util.Base64.getEncoder().encodeToString(this.productIcon);
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

    public void setIcon(String iconStr) {
        if (iconStr == null || iconStr.trim().isEmpty()) {
            this.productIcon = null;
            return;
        }
        if (iconStr.startsWith("data:image/")) {
            try {
                int commaIndex = iconStr.indexOf(',');
                if (commaIndex != -1) {
                    String base64Data = iconStr.substring(commaIndex + 1);
                    this.productIcon = java.util.Base64.getDecoder().decode(base64Data.trim());
                }
            } catch (Exception e) {
                System.err.println("Failed to decode base64 icon: " + e.getMessage());
            }
        } else {
            // In case it's raw base64 or legacy value
            try {
                this.productIcon = java.util.Base64.getDecoder().decode(iconStr.trim());
            } catch (Exception e) {
                this.productIcon = null;
            }
        }
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSyncTenantUrl() {
        return syncTenantUrl;
    }

    public void setSyncTenantUrl(String syncTenantUrl) {
        this.syncTenantUrl = syncTenantUrl;
    }

    public String getSyncUserUrl() {
        return syncUserUrl;
    }

    public void setSyncUserUrl(String syncUserUrl) {
        this.syncUserUrl = syncUserUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }
}
