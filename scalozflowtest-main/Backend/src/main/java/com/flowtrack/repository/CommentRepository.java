package com.flowtrack.repository;

import com.flowtrack.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    @Transactional
    @Modifying
    @Query("DELETE FROM Comment c WHERE c.task.id = :taskId")
    void deleteByTaskId(Long taskId);
}
