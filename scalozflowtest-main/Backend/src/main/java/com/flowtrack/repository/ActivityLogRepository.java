package com.flowtrack.repository;

import com.flowtrack.model.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    List<ActivityLog> findByProjectIdOrderByCreatedAtDesc(Long projectId);

    List<ActivityLog> findTop20ByOrderByCreatedAtDesc();
    List<ActivityLog> findTop15ByOrderByCreatedAtDesc();
}
