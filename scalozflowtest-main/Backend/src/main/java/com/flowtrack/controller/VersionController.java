package com.flowtrack.controller;

import com.flowtrack.model.Version;
import com.flowtrack.service.VersionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects/{projectId}/versions")
public class VersionController {

    @Autowired
    private VersionService versionService;

    @GetMapping
    public List<Version> getVersions(@PathVariable Long projectId) {
        return versionService.getVersionsByProject(projectId);
    }

    @GetMapping("/{id}")
    public Version getVersion(@PathVariable Long projectId, @PathVariable Long id) {
        return versionService.getVersionById(id);
    }

    @GetMapping("/{id}/stats")
    public Map<String, Object> getVersionStats(@PathVariable Long projectId, @PathVariable Long id) {
        return versionService.getVersionStats(id);
    }

    @PostMapping
    public Version createVersion(@PathVariable Long projectId, @RequestBody Version version) {
        return versionService.createVersion(projectId, version);
    }

    @PutMapping("/{id}")
    public Version updateVersion(@PathVariable Long projectId, @PathVariable Long id, @RequestBody Version version) {
        return versionService.updateVersion(id, version);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteVersion(@PathVariable Long projectId, @PathVariable Long id) {
        versionService.deleteVersion(id);
        return ResponseEntity.ok().build();
    }
}
