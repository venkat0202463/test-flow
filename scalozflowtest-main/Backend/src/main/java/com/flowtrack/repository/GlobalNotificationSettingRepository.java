package com.flowtrack.repository;

import com.flowtrack.model.GlobalNotificationSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface GlobalNotificationSettingRepository extends JpaRepository<GlobalNotificationSetting, Long> {
    Optional<GlobalNotificationSetting> findBySettingKey(String settingKey);
}
