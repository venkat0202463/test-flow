package com.flowtrack.service;

import com.flowtrack.model.Version;
import com.flowtrack.model.Project;
import com.flowtrack.model.Task;
import com.flowtrack.repository.VersionRepository;
import com.flowtrack.repository.ProjectRepository;
import com.flowtrack.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional
public class VersionService {

    @Autowired
    private VersionRepository versionRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TaskRepository taskRepository;

    public List<Version> getVersionsByProject(Long projectId) {
        return versionRepository.findByProjectId(projectId);
    }

    public Version getVersionById(Long id) {
        return versionRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Version not found with ID: " + id));
    }

    public Version createVersion(Long projectId, Version version) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found with ID: " + projectId));
        version.setProject(project);
        version.setCreatedAt(LocalDateTime.now());
        version.setUpdatedAt(LocalDateTime.now());
        if (version.getStatus() == null) {
            version.setStatus("UNRELEASED");
        }
        return versionRepository.save(version);
    }

    public Version updateVersion(Long id, Version versionDetails) {
        Version version = getVersionById(id);
        
        if (versionDetails.getName() != null) {
            version.setName(versionDetails.getName());
        }
        version.setDescription(versionDetails.getDescription());
        version.setStartDate(versionDetails.getStartDate());
        version.setReleaseDate(versionDetails.getReleaseDate());
        if (versionDetails.getStatus() != null) {
            version.setStatus(versionDetails.getStatus());
        }
        version.setReleaseNotes(versionDetails.getReleaseNotes());
        version.setColor(versionDetails.getColor());
        version.setUpdatedAt(LocalDateTime.now());
        
        return versionRepository.save(version);
    }

    public void deleteVersion(Long id) {
        Version version = getVersionById(id);
        
        // Unassign this version from any tasks before deleting
        List<Task> tasks = taskRepository.findAll(); // Simple lookup, or query by fixVersion/affectsVersion
        for (Task t : tasks) {
            boolean updated = false;
            if (t.getFixVersion() != null && t.getFixVersion().getId().equals(id)) {
                t.setFixVersion(null);
                updated = true;
            }
            if (t.getAffectsVersion() != null && t.getAffectsVersion().getId().equals(id)) {
                t.setAffectsVersion(null);
                updated = true;
            }
            if (updated) {
                taskRepository.save(t);
            }
        }
        
        versionRepository.delete(version);
    }

    public Map<String, Object> getVersionStats(Long id) {
        Version version = getVersionById(id);
        List<Task> allTasks = taskRepository.findByProjectIdOrderByOrderIndexAsc(version.getProject().getId());
        
        List<Task> versionTasks = new ArrayList<>();
        for (Task t : allTasks) {
            if (t.getFixVersion() != null && t.getFixVersion().getId().equals(id)) {
                versionTasks.add(t);
            }
        }

        int totalIssues = versionTasks.size();
        int completedIssues = 0;
        int remainingIssues = 0;
        int openBugs = 0;
        int totalStoryPoints = 0;
        int completedStoryPoints = 0;

        for (Task t : versionTasks) {
            boolean isDone = "DONE".equalsIgnoreCase(t.getStatus()) || "Done".equalsIgnoreCase(t.getStatus());
            if (isDone) {
                completedIssues++;
                completedStoryPoints += (t.getStoryPoints() != null ? t.getStoryPoints() : 0);
            } else {
                remainingIssues++;
                if ("BUG".equalsIgnoreCase(t.getIssueType())) {
                    openBugs++;
                }
            }
            totalStoryPoints += (t.getStoryPoints() != null ? t.getStoryPoints() : 0);
        }

        int progressPercentage = totalIssues > 0 ? (completedIssues * 100) / totalIssues : 0;
        int spProgressPercentage = totalStoryPoints > 0 ? (completedStoryPoints * 100) / totalStoryPoints : 0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("version", version);
        stats.put("totalIssues", totalIssues);
        stats.put("completedIssues", completedIssues);
        stats.put("remainingIssues", remainingIssues);
        stats.put("progressPercentage", progressPercentage);
        stats.put("openBugs", openBugs);
        stats.put("totalStoryPoints", totalStoryPoints);
        stats.put("completedStoryPoints", completedStoryPoints);
        stats.put("spProgressPercentage", spProgressPercentage);

        return stats;
    }
}
