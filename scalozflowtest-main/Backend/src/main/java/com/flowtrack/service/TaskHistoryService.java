package com.flowtrack.service;

import com.flowtrack.model.TaskHistory;
import com.flowtrack.repository.TaskHistoryRepository;
import com.flowtrack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import java.util.List;
import java.util.Optional;

@Service
public class TaskHistoryService {

    @Autowired
    private TaskHistoryRepository taskHistoryRepository;

    @Autowired
    private UserRepository userRepository;

    public void log(Long taskId, String changeType, String fromValue, String toValue) {
        log(taskId, changeType, fromValue, toValue, null);
    }

    public void log(Long taskId, String changeType, String fromValue, String toValue, String comment) {
        String performedBy = "System";
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated()) {
                String email = auth.getName();
                Optional<com.flowtrack.model.User> userOpt = userRepository.findByEmailIgnoreCase(email);
                if (userOpt.isPresent()) {
                    performedBy = userOpt.get().getName();
                } else {
                    performedBy = email;
                }
            }
        } catch (Exception e) {
            // Ignore security context lookup failure in system/non-interactive actions
        }

        TaskHistory entry = new TaskHistory(taskId, changeType, fromValue, toValue, performedBy, comment);
        taskHistoryRepository.save(entry);
    }

    public List<TaskHistory> getHistoryForTask(Long taskId) {
        return taskHistoryRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }
}
