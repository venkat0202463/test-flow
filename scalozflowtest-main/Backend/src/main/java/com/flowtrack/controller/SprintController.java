package com.flowtrack.controller;

import com.flowtrack.model.Sprint;
import com.flowtrack.service.SprintService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/sprints")
public class SprintController {

    @Autowired
    private SprintService sprintService;

    @GetMapping
    public List<Sprint> getSprints(@PathVariable Long projectId) {
        return sprintService.getSprintsByProject(projectId);
    }

    @PostMapping
    public Sprint createSprint(@PathVariable Long projectId, @RequestBody com.flowtrack.dto.SprintRequest sprintRequest) {
        Sprint sprint = new Sprint();
        sprint.setName(sprintRequest.getName());
        sprint.setStartDate(sprintRequest.getStartDate());
        sprint.setEndDate(sprintRequest.getEndDate());
        sprint.setStatus(sprintRequest.getStatus());
        sprint.setType(sprintRequest.getType());
        return sprintService.createSprint(projectId, sprint);
    }

    @PutMapping("/{id}")
    public Sprint updateSprint(@PathVariable Long id, @RequestBody com.flowtrack.dto.SprintRequest sprintRequest) {
        Sprint sprint = new Sprint();
        sprint.setName(sprintRequest.getName());
        sprint.setStartDate(sprintRequest.getStartDate());
        sprint.setEndDate(sprintRequest.getEndDate());
        sprint.setStatus(sprintRequest.getStatus());
        sprint.setType(sprintRequest.getType());
        return sprintService.updateSprint(id, sprint);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSprint(@PathVariable Long projectId, @PathVariable Long id) {
        sprintService.deleteSprint(id);
        return ResponseEntity.ok().build();
    }
}
