package com.scaloz.superadmin.dto;

public class ProductDTO {
    private Long id;
    private String name;
    private String code;
    private String url;
    private String icon;
    private String content;
    private String status;
    private String syncTenantUrl;
    private String syncUserUrl;
    private String apiKey;

    public ProductDTO() {}

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

    public String getIcon() {
        return icon;
    }

    public void setIcon(String icon) {
        this.icon = icon;
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
