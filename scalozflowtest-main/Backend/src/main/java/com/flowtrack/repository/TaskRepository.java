package com.flowtrack.repository;

import com.flowtrack.model.Task;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {
    @org.springframework.data.jpa.repository.Query("SELECT t FROM Task t WHERE t.project.id = :projectId ORDER BY COALESCE(t.orderIndex, 999999) ASC, t.id DESC")
    List<Task> findByProjectIdOrderByOrderIndexAsc(@org.springframework.data.repository.query.Param("projectId") Long projectId);

    @org.springframework.data.jpa.repository.Query("SELECT t FROM Task t WHERE t.sprint.id = :sprintId ORDER BY COALESCE(t.orderIndex, 999999) ASC, t.id DESC")
    List<Task> findBySprintIdOrderByOrderIndexAsc(@org.springframework.data.repository.query.Param("sprintId") Long sprintId);

    List<Task> findByAssigneeId(Long assigneeId);
    long countByColumnId(Long columnId);
    List<Task> findByColumnId(Long columnId);
    List<Task> findByProjectIdAndEnvironment(Long projectId, String environment);
    List<Task> findByProjectIdAndSprintId(Long projectId, Long sprintId);
    List<Task> findByParentTaskId(Long parentId);
    List<Task> findByReporterIdOrderByCreatedAtDesc(Long reporterId);
    List<Task> findByStatusOrderByCreatedAtDesc(String status);
    List<Task> findByStatusInOrderByCreatedAtDesc(java.util.Collection<String> statuses);
    long countByStatus(String status);

    @org.springframework.data.jpa.repository.Query("SELECT t FROM Task t WHERE t.project.createdBy.id = :userId AND t.status IN :statuses ORDER BY t.createdAt DESC")
    List<Task> findPmReviewTasksByUserId(@org.springframework.data.repository.query.Param("userId") Long userId, @org.springframework.data.repository.query.Param("statuses") java.util.Collection<String> statuses);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(t) FROM Task t WHERE t.project.createdBy.id = :userId AND t.status = :status")
    long countPmReviewTasksByUserIdAndStatus(@org.springframework.data.repository.query.Param("userId") Long userId, @org.springframework.data.repository.query.Param("status") String status);

    @org.springframework.data.jpa.repository.Query("SELECT MAX(t.projectSequence) FROM Task t WHERE t.project.id = :projectId")
    Long findMaxProjectSequenceByProjectId(@org.springframework.data.repository.query.Param("projectId") Long projectId);

    List<Task> findByProjectIdAndProjectSequence(Long projectId, Long projectSequence);

    List<Task> findByDueDateAndStatusNot(java.time.LocalDate dueDate, String status);
    List<Task> findByDueDateBeforeAndStatusNot(java.time.LocalDate date, String status);
}
