package com.flowtrack.controller;

import com.flowtrack.model.User;
import com.flowtrack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/profile")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.flowtrack.service.TaskEmailService taskEmailService;

    @PutMapping("/update")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> requestData) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            
            if (requestData.containsKey("name")) {
                user.setName(requestData.get("name"));
            }
            if (requestData.containsKey("department")) {
                user.setDepartment(requestData.get("department"));
            }
            com.flowtrack.model.Role oldRole = user.getRole();
            if (requestData.containsKey("role")) {
                try {
                    user.setRole(com.flowtrack.model.Role.valueOf(requestData.get("role")));
                } catch (Exception e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Invalid role value."));
                }
            }
            
            userRepository.save(user);

            if (requestData.containsKey("role") && oldRole != user.getRole()) {
                try {
                    com.flowtrack.model.Project globalProj = new com.flowtrack.model.Project();
                    globalProj.setName("Global Workspace");
                    taskEmailService.sendRoleChangedEmail(user, globalProj, oldRole.name(), user.getRole().name());
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            return ResponseEntity.ok(Map.of(
                "message", "Profile updated successfully.",
                "name", user.getName(),
                "department", user.getDepartment(),
                "role", user.getRole().name()
            ));
        }
        
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "User not found."));
    }
}
