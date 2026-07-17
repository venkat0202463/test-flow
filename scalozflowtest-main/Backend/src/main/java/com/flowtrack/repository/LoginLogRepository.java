package com.flowtrack.repository;

import com.flowtrack.model.LoginLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LoginLogRepository extends JpaRepository<LoginLog, Long> {
    List<LoginLog> findByUserIdOrderByTimestampDesc(String userId);
    List<LoginLog> findByEmailOrderByTimestampDesc(String email);
}
