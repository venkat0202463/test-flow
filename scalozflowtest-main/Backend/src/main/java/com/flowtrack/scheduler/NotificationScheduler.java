package com.flowtrack.scheduler;

import com.flowtrack.model.EmailNotificationLog;
import com.flowtrack.model.Task;
import com.flowtrack.model.User;
import com.flowtrack.repository.EmailNotificationLogRepository;
import com.flowtrack.repository.TaskRepository;
import com.flowtrack.repository.UserRepository;
import com.flowtrack.service.TaskEmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Component
public class NotificationScheduler {

    @Autowired
    private EmailNotificationLogRepository emailLogRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskEmailService taskEmailService;

    // Retry failed or pending emails from the queue every 60 seconds
    @Scheduled(fixedDelay = 60000)
    public void retryFailedEmails() {
        List<EmailNotificationLog> pendingLogs = emailLogRepository.findByStatusAndRetryCountLessThan("PENDING", 3);
        List<EmailNotificationLog> failedLogs = emailLogRepository.findByStatusAndRetryCountLessThan("FAILED", 3);
        
        List<EmailNotificationLog> allToRetry = new ArrayList<>();
        allToRetry.addAll(pendingLogs);
        allToRetry.addAll(failedLogs);
        
        if (!allToRetry.isEmpty()) {
            System.out.println("DEBUG: Email Queue Scanner found " + allToRetry.size() + " emails to process.");
            for (EmailNotificationLog log : allToRetry) {
                taskEmailService.sendEmailLogRecord(log);
            }
        }
    }

    // Daily due date reminder scanner at 9:00 AM IST
    @org.springframework.transaction.annotation.Transactional
    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Kolkata")
    public void scanDueDateReminders() {
        System.out.println("DEBUG: Scanning tasks for due date reminders...");
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        List<Task> tasksDueTomorrow = taskRepository.findByDueDateAndStatusNot(tomorrow, "Done");
        
        for (Task task : tasksDueTomorrow) {
            if (task.getAssignee() != null) {
                try {
                    if (task.getProject() != null) {
                        org.hibernate.Hibernate.initialize(task.getProject());
                    }
                    taskEmailService.sendDueDateReminderEmail(task.getAssignee(), task, "1 day");
                } catch (Exception e) {
                    System.err.println("Failed to trigger due date reminder for task " + task.getId() + ": " + e.getMessage());
                }
            }
        }
    }

    // Daily overdue tasks scanner at 9:30 AM IST
    @org.springframework.transaction.annotation.Transactional
    @Scheduled(cron = "0 30 9 * * *", zone = "Asia/Kolkata")
    public void scanOverdueTasks() {
        System.out.println("DEBUG: Scanning tasks for overdue status...");
        LocalDate today = LocalDate.now();
        List<Task> overdueTasks = taskRepository.findByDueDateBeforeAndStatusNot(today, "Done");
        
        List<User> pms = userRepository.findByRoleIn(java.util.Arrays.asList(com.flowtrack.model.Role.MANAGER, com.flowtrack.model.Role.ADMIN));

        for (Task task : overdueTasks) {
            long daysOverdue = ChronoUnit.DAYS.between(task.getDueDate(), today);
            String overdueStr = daysOverdue + (daysOverdue == 1 ? " day" : " days");
            
            // 1. Notify Assignee
            if (task.getAssignee() != null) {
                try {
                    if (task.getProject() != null) {
                        org.hibernate.Hibernate.initialize(task.getProject());
                    }
                    taskEmailService.sendTaskOverdueEmail(task.getAssignee(), task, overdueStr);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            
            // 2. Notify Reporter/Creator
            if (task.getReporter() != null && (task.getAssignee() == null || !task.getReporter().getId().equals(task.getAssignee().getId()))) {
                try {
                    if (task.getProject() != null) {
                        org.hibernate.Hibernate.initialize(task.getProject());
                    }
                    taskEmailService.sendTaskOverdueEmail(task.getReporter(), task, overdueStr);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            
            // 3. Notify PMs
            for (User pm : pms) {
                try {
                    taskEmailService.sendTaskOverdueEmail(pm, task, overdueStr);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }
}
