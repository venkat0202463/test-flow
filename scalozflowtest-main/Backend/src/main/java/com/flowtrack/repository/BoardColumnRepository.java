package com.flowtrack.repository;

import com.flowtrack.model.BoardColumn;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BoardColumnRepository extends JpaRepository<BoardColumn, Long> {
    List<BoardColumn> findByProjectIdOrderByOrderIndexAsc(Long projectId);
    BoardColumn findByNameAndProjectId(String name, Long projectId);
    
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    void deleteByProjectId(Long projectId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE BoardColumn c SET c.orderIndex = :orderIndex WHERE c.id = :id")
    void updateOrderIndex(@org.springframework.data.repository.query.Param("id") Long id, @org.springframework.data.repository.query.Param("orderIndex") Integer orderIndex);
}
