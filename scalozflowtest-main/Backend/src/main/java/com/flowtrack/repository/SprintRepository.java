package com.flowtrack.repository;

import com.flowtrack.model.Sprint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SprintRepository extends JpaRepository<Sprint, Long> {
    List<Sprint> findByProjectId(Long projectId);
    List<Sprint> findByProjectIdAndStatus(Long projectId, String status);
    List<Sprint> findByStatusAndEndDateBefore(String status, java.time.LocalDate date);
}
