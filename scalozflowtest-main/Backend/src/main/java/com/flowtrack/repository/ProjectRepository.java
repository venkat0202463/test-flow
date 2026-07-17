package com.flowtrack.repository;

import com.flowtrack.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    @EntityGraph(attributePaths = {"teamMembers"})
    Optional<Project> findById(Long id);

    @EntityGraph(attributePaths = {"teamMembers"})
    List<Project> findByCreatedById(Long userId);

    @EntityGraph(attributePaths = {"teamMembers"})
    @Query("SELECT DISTINCT p FROM Project p JOIN p.teamMembers m WHERE m.id = :userId")
    List<Project> findByMemberId(@Param("userId") Long userId);
}
