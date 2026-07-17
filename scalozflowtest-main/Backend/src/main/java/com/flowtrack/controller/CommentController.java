package com.flowtrack.controller;

import com.flowtrack.model.Comment;
import com.flowtrack.model.Task;
import com.flowtrack.model.User;
import com.flowtrack.dto.CommentRequest;
import com.flowtrack.repository.CommentRepository;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/comments")
public class CommentController {
    @Autowired
    CommentRepository commentRepository;

    @Autowired
    TaskRepository taskRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    private com.flowtrack.service.TaskEmailService taskEmailService;

    @GetMapping("/task/{taskId}")
    public List<Comment> getCommentsByTask(@PathVariable Long taskId) {
        return commentRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }

    @PostMapping
    public ResponseEntity<Comment> addComment(@RequestBody CommentRequest request) {
        Task task = taskRepository.findById(request.getTaskId()).orElseThrow();
        User user = userRepository.findById(request.getUserId()).orElseThrow();

        Comment comment = new Comment();
        comment.setContent(request.getContent());
        comment.setTask(task);
        comment.setUser(user);

        Comment savedComment = commentRepository.save(comment);

        try {
            String content = request.getContent();
            java.util.Set<User> mentionedUsers = new java.util.HashSet<>();
            if (content != null && content.contains("@")) {
                java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("@([a-zA-Z0-9_\\.@\\-]+)");
                java.util.regex.Matcher matcher = pattern.matcher(content);
                while (matcher.find()) {
                    String candidate = matcher.group(1).trim();
                    userRepository.findByEmail(candidate).ifPresent(mentionedUsers::add);
                    userRepository.findByEmpId(candidate).ifPresent(mentionedUsers::add);
                    userRepository.findByEmailIgnoreCase(candidate).ifPresent(mentionedUsers::add);
                    
                    // Also partial match by name if possible
                    userRepository.findAll().stream()
                        .filter(u -> u.getName().equalsIgnoreCase(candidate) || u.getName().replace(" ", "").equalsIgnoreCase(candidate))
                        .findFirst()
                        .ifPresent(mentionedUsers::add);
                }
            }

            for (User mentioned : mentionedUsers) {
                if (!mentioned.getId().equals(user.getId())) {
                    taskEmailService.sendUserMentionedEmail(mentioned, user, task, content);
                }
            }

            java.util.Set<User> recipients = new java.util.HashSet<>();
            if (task.getAssignee() != null) recipients.add(task.getAssignee());
            if (task.getReporter() != null) recipients.add(task.getReporter());
            if (task.getProject() != null && task.getProject().getCreatedBy() != null) {
                recipients.add(task.getProject().getCreatedBy());
            }

            for (User recipient : recipients) {
                if (!recipient.getId().equals(user.getId()) && !mentionedUsers.contains(recipient)) {
                    taskEmailService.sendCommentAddedEmail(recipient, user, task, content);
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to trigger comment/mention notifications: " + e.getMessage());
            e.printStackTrace();
        }

        return ResponseEntity.ok(savedComment);
    }
}
