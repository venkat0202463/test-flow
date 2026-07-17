package com.flowtrack.repository;

import com.flowtrack.model.WorkLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WorkLogRepository extends JpaRepository<WorkLog, Long> {
    List<WorkLog> findByTaskIdOrderByCreatedAtDesc(Long taskId);
}
