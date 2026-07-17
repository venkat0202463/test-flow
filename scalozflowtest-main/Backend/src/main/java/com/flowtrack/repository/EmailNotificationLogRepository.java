package com.flowtrack.repository;

import com.flowtrack.model.EmailNotificationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EmailNotificationLogRepository extends JpaRepository<EmailNotificationLog, Long> {
    List<EmailNotificationLog> findByStatus(String status);
    List<EmailNotificationLog> findByStatusAndRetryCountLessThan(String status, int maxRetries);
    Optional<EmailNotificationLog> findByEventUuid(String eventUuid);
}
