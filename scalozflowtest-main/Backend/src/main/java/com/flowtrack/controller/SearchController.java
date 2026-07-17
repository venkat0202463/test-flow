package com.flowtrack.controller;

import com.flowtrack.model.Project;
import com.flowtrack.model.Task;
import com.flowtrack.service.ProjectService;
import com.flowtrack.service.TaskService;
import com.flowtrack.security.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    @Autowired
    private TaskService taskService;

    @Autowired
    private ProjectService projectService;

    private String getProjectPrefix(String projectName) {
        if (projectName == null || projectName.trim().isEmpty()) {
            return "FT";
        }
        String clean = projectName.trim();
        // Split by spaces, hyphens, or underscores
        String[] words = clean.split("[\\s\\-_]+");
        if (words.length >= 2) {
            StringBuilder prefix = new StringBuilder();
            for (String word : words) {
                if (!word.isEmpty()) {
                    prefix.append(Character.toUpperCase(word.charAt(0)));
                }
            }
            if (prefix.length() > 3) {
                return prefix.substring(0, 3);
            }
            return prefix.toString();
        }

        // Single word: take first 2 letters
        if (clean.length() >= 2) {
            return clean.substring(0, 2).toUpperCase();
        }
        return clean.toUpperCase();
    }

    @GetMapping
    public Map<String, Object> search(@RequestParam String query, @RequestParam(required = false) Long projectId, @AuthenticationPrincipal UserDetailsImpl userDetails) {
        String role = userDetails.getAuthorities().stream().findFirst().map(a -> a.getAuthority()).orElse("USER");
        String lowerQuery = query.toLowerCase();

        // Search Projects
        List<Project> allProjects = projectService.getAllProjects(userDetails.getId(), role);
        List<Project> matchingProjects = allProjects.stream()
                .filter(p -> p.getName().toLowerCase().contains(lowerQuery) || 
                             (p.getDescription() != null && p.getDescription().toLowerCase().contains(lowerQuery)))
                .filter(p -> projectId == null || p.getId().equals(projectId))
                .collect(Collectors.toList());

        // Search Tasks
        List<Task> allTasks = taskService.getAllTasks();
        List<Task> matchingTasks = allTasks.stream()
                .filter(t -> {
                    String projectName = t.getProject() != null ? t.getProject().getName() : null;
                    String prefix = getProjectPrefix(projectName);
                    Long seq = t.getProjectSequence() != null ? t.getProjectSequence() : t.getId();
                    String taskCode = prefix + "-" + seq;
                    return t.getTitle().toLowerCase().contains(lowerQuery) || 
                           taskCode.toLowerCase().contains(lowerQuery) ||
                           String.valueOf(seq).equals(lowerQuery) ||
                           String.valueOf(t.getId()).equals(lowerQuery) ||
                           (t.getDescription() != null && t.getDescription().toLowerCase().contains(lowerQuery));
                })
                .filter(t -> projectId == null || (t.getProject() != null && t.getProject().getId().equals(projectId)))
                .collect(Collectors.toList());

        Map<String, Object> results = new HashMap<>();
        results.put("projects", matchingProjects);
        results.put("tasks", matchingTasks);
        return results;
    }
}
