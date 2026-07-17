package com.flowtrack.controller;

import com.flowtrack.model.BoardColumn;
import com.flowtrack.model.Project;
import com.flowtrack.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/columns")
public class BoardColumnController {

    @Autowired
    private com.flowtrack.service.BoardColumnService columnService;
    
    @Autowired
    private ProjectRepository projectRepository;

    @GetMapping
    public List<BoardColumn> getColumnsByProject(@RequestParam Long projectId) {
        return columnService.getColumnsByProject(projectId);
    }

    @PostMapping
    public BoardColumn createColumn(@RequestBody Map<String, Object> payload) {
        Long projectId = Long.valueOf(payload.get("projectId").toString());
        String name = payload.get("name").toString();

        Project project = projectRepository.findById(projectId).orElseThrow();
        BoardColumn column = new BoardColumn();
        column.setProject(project);
        column.setName(name);
        return columnService.addColumn(column);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateColumn(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        try {
            BoardColumn details = new BoardColumn();
            if (payload.containsKey("name") && payload.get("name") != null) {
                details.setName(payload.get("name").toString());
            }
            if (payload.containsKey("orderIndex") && payload.get("orderIndex") != null) {
                String val = payload.get("orderIndex").toString();
                if (val.contains(".")) {
                    details.setOrderIndex((int) Double.parseDouble(val));
                } else {
                    details.setOrderIndex(Integer.valueOf(val));
                }
            }
            columnService.updateColumn(id, details);
            return ResponseEntity.ok(Map.of("status", "success", "id", id));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Unknown error", "type", e.getClass().getName()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteColumn(@PathVariable Long id, @RequestParam(required = false) Long moveTasksTo) {
        try {
            columnService.deleteColumn(id, moveTasksTo);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
