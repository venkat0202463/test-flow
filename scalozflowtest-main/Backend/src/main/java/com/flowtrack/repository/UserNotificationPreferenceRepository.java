package com.flowtrack.repository;

import com.flowtrack.model.UserNotificationPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserNotificationPreferenceRepository extends JpaRepository<UserNotificationPreference, Long> {
    Optional<UserNotificationPreference> findByUserId(Long userId);
}
