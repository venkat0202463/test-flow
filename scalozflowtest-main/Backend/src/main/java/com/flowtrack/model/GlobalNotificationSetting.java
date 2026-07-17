package com.flowtrack.model;

import jakarta.persistence.*;

@Entity
@Table(name = "global_notification_settings")
public class GlobalNotificationSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "setting_key", nullable = false, unique = true)
    private String settingKey;

    @Column(nullable = false)
    private boolean enabled = true;

    public GlobalNotificationSetting() {}

    public GlobalNotificationSetting(String settingKey, boolean enabled) {
        this.settingKey = settingKey;
        this.enabled = enabled;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSettingKey() { return settingKey; }
    public void setSettingKey(String settingKey) { this.settingKey = settingKey; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
