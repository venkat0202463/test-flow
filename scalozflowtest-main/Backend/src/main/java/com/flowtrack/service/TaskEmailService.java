package com.flowtrack.service;

import com.flowtrack.model.Task;
import com.flowtrack.model.User;
import com.flowtrack.model.Project;
import com.flowtrack.model.Sprint;
import com.flowtrack.model.EmailNotificationLog;
import com.flowtrack.repository.EmailNotificationLogRepository;
import com.flowtrack.repository.GlobalNotificationSettingRepository;
import com.flowtrack.repository.UserNotificationPreferenceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
@org.springframework.scheduling.annotation.Async
public class TaskEmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private com.flowtrack.repository.UserRepository userRepository;

    @Autowired
    private UserNotificationPreferenceRepository userPreferenceRepository;

    @Autowired
    private GlobalNotificationSettingRepository globalSettingRepository;

    @Autowired
    private EmailNotificationLogRepository emailLogRepository;

    @Value("${flowtrack.frontend.url:https://scalozflowtest.scaloz.com}")
    private String frontendUrl;

    // Preference verification check
    private boolean isNotificationEnabled(Long userId, String typeKey) {
        // 1. Check Global switch setting
        boolean globalEnabled = globalSettingRepository.findBySettingKey(typeKey)
                .map(com.flowtrack.model.GlobalNotificationSetting::isEnabled)
                .orElse(true);
        if (!globalEnabled) return false;

        // 2. Check User personal preference toggles
        if (userId != null) {
            return userPreferenceRepository.findByUserId(userId)
                    .map(pref -> {
                        switch (typeKey) {
                            case "TASK_CREATED": return pref.isTaskCreated();
                            case "TASK_ASSIGNED": return pref.isTaskAssigned();
                            case "TASK_REVIEW_DECISION": return pref.isTaskReviewDecision();
                            case "TASK_STATUS_CHANGED": return pref.isTaskStatusChanged();
                            case "COMMENT_ADDED": return pref.isCommentAdded();
                            case "USER_MENTIONED": return pref.isUserMentioned();
                            case "DUE_DATE_REMINDER": return pref.isDueDateReminder();
                            case "TASK_OVERDUE": return pref.isTaskOverdue();
                            case "SPRINT_STARTED": return pref.isSprintStarted();
                            case "SPRINT_COMPLETED": return pref.isSprintCompleted();
                            case "TASK_COMPLETED": return pref.isTaskCompleted();
                            case "TASK_REOPENED": return pref.isTaskReopened();
                            case "PROJECT_INVITATION": return pref.isProjectInvitation();
                            case "ROLE_CHANGED": return pref.isRoleChanged();
                            default: return true;
                        }
                    })
                    .orElse(true);
        }
        return true;
    }

    // Queue email in Log table and trigger real-time send asynchronously
    private void queueAndSendEmail(String recipientEmail, String subject, String htmlBody, String notificationType, String eventUuid, Long recipientUserId) {
        if (recipientEmail == null || recipientEmail.trim().isEmpty()) {
            return;
        }

        if (!isNotificationEnabled(recipientUserId, notificationType)) {
            System.out.println("DEBUG: Notification " + notificationType + " disabled for user id " + recipientUserId);
            return;
        }

        if (eventUuid != null && emailLogRepository.findByEventUuid(eventUuid).isPresent()) {
            System.out.println("DEBUG: Duplicate event " + eventUuid + ". Skipping send.");
            return;
        }

        EmailNotificationLog log = new EmailNotificationLog(recipientEmail, subject, htmlBody, notificationType, eventUuid);
        log = emailLogRepository.save(log);

        sendEmailLogRecord(log);
    }

    // Attempt to deliver the email log record asynchronously
    public void sendEmailLogRecord(EmailNotificationLog log) {
        if (mailSender == null) {
            log.setStatus("FAILED");
            log.setErrorMessage("MailSender is not configured.");
            emailLogRepository.save(log);
            return;
        }

        final Long logId = log.getId();
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                EmailNotificationLog currentLog = emailLogRepository.findById(logId).orElseThrow();
                jakarta.mail.internet.MimeMessage mimeMessage = mailSender.createMimeMessage();
                org.springframework.mail.javamail.MimeMessageHelper helper = 
                    new org.springframework.mail.javamail.MimeMessageHelper(mimeMessage, "utf-8");
                helper.setTo(currentLog.getRecipientEmail());
                helper.setSubject(currentLog.getSubject());
                helper.setText(currentLog.getBody(), true);
                helper.setFrom("ScalozFlow Notifications <noreply@flowtrack.com>");
                
                mailSender.send(mimeMessage);
                
                currentLog.setStatus("SENT");
                currentLog.setSentAt(LocalDateTime.now());
                emailLogRepository.save(currentLog);
                System.out.println("DEBUG: Email successfully sent to: " + currentLog.getRecipientEmail());
            } catch (Exception e) {
                try {
                    EmailNotificationLog currentLog = emailLogRepository.findById(logId).orElseThrow();
                    currentLog.setStatus("FAILED");
                    currentLog.setRetryCount(currentLog.getRetryCount() + 1);
                    currentLog.setErrorMessage(e.getMessage());
                    emailLogRepository.save(currentLog);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
                e.printStackTrace();
            }
        });
    }

    private String getTaskKey(Task task) {
        if (task.getProject() == null || task.getProject().getName() == null) return "FT-" + task.getId();
        String clean = task.getProject().getName().trim();
        if (clean.isEmpty()) return "FT-" + task.getId();

        String[] words = clean.split("[\\s\\-_]+");
        String prefix;
        if (words.length >= 2) {
            StringBuilder sb = new StringBuilder();
            for (String w : words) {
                if (!w.isEmpty()) sb.append(Character.toUpperCase(w.charAt(0)));
            }
            prefix = sb.length() > 3 ? sb.substring(0, 3) : sb.toString();
        } else if (clean.length() >= 2) {
            prefix = clean.substring(0, 2).toUpperCase();
        } else {
            prefix = clean.toUpperCase();
        }
        
        Long seq = task.getProjectSequence() != null ? task.getProjectSequence() : task.getId();
        return prefix + "-" + seq;
    }

    // HTML Email Template wrapper
    private String buildHtmlWrapper(String title, String heading, String description, String detailsTableHtml, String buttonText, String buttonUrl) {
        return String.format("""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>%s</title>
                <style>
                    body {
                        font-family: 'Inter', 'Segoe UI', sans-serif;
                        background-color: #F4F5F7;
                        color: #172B4D;
                        margin: 0;
                        padding: 0;
                    }
                    .email-container {
                        max-width: 600px;
                        margin: 40px auto;
                        background: #ffffff;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 4px 12px rgba(9, 30, 66, 0.15);
                        border: 1px solid #DFE1E6;
                    }
                    .email-header {
                        background: linear-gradient(135deg, #1F6FEB 0%%, #003484 100%%);
                        padding: 30px;
                        text-align: center;
                        color: #ffffff;
                    }
                    .email-header h1 {
                        margin: 0;
                        font-size: 24px;
                        font-weight: 800;
                        letter-spacing: -0.5px;
                    }
                    .email-header p {
                        margin: 5px 0 0 0;
                        font-size: 13px;
                        opacity: 0.85;
                        font-weight: 500;
                    }
                    .email-body {
                        padding: 40px 30px;
                    }
                    .email-body h2 {
                        margin-top: 0;
                        font-size: 18px;
                        color: #172B4D;
                        font-weight: 700;
                    }
                    .email-body p {
                        font-size: 14px;
                        line-height: 1.6;
                        color: #5E6C84;
                    }
                    .details-table {
                        width: 100%%;
                        border-collapse: collapse;
                        margin: 25px 0;
                        font-size: 13px;
                        background: #FAFBFC;
                        border-radius: 4px;
                        border: 1px solid #DFE1E6;
                    }
                    .details-table td {
                        padding: 12px 16px;
                        border-bottom: 1px solid #DFE1E6;
                    }
                    .details-table tr:last-child td {
                        border-bottom: none;
                    }
                    .label {
                        font-weight: 700;
                        color: #5E6C84;
                        width: 35%%;
                        text-transform: uppercase;
                        font-size: 10px;
                        letter-spacing: 0.8px;
                    }
                    .value {
                        color: #172B4D;
                        font-weight: 500;
                    }
                    .cta-container {
                        text-align: center;
                        margin-top: 30px;
                    }
                    .cta-button {
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #1F6FEB;
                        color: #ffffff !important;
                        text-decoration: none;
                        font-weight: 700;
                        font-size: 14px;
                        border-radius: 4px;
                        box-shadow: 0 4px 10px rgba(31, 111, 235, 0.2);
                    }
                    .email-footer {
                        background-color: #FAFBFC;
                        padding: 20px;
                        text-align: center;
                        font-size: 11px;
                        color: #6B778C;
                        border-top: 1px solid #DFE1E6;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="email-header">
                        <h1>ScalozFlow</h1>
                        <p>%s</p>
                    </div>
                    <div class="email-body">
                        <h2>%s</h2>
                        <p>%s</p>
                        %s
                        <div class="cta-container">
                            <a href="%s" class="cta-button" target="_blank">%s</a>
                        </div>
                    </div>
                    <div class="email-footer">
                        <p>This is an automated notification from ScalozFlow. Please do not reply to this email.</p>
                        <p>&copy; 2026 ScalozFlow. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """, title, title, heading, description, detailsTableHtml, buttonUrl, buttonText);
    }

    // 1. Task Created Notification
    public void sendTaskCreatedEmail(User assignee, Task task) {
        if (assignee == null || assignee.getEmail() == null) return;
        String taskKey = getTaskKey(task);
        String subject = String.format("New Task Assigned: %s - %s", taskKey, task.getTitle());
        String projName = task.getProject() != null ? task.getProject().getName() : "Unknown Project";
        String creatorName = task.getReporter() != null ? task.getReporter().getName() : "Unknown User";
        String dueDateStr = task.getDueDate() != null ? task.getDueDate().toString() : "No Due Date";
        String desc = task.getDescription() != null ? task.getDescription().replaceAll("<[^>]*>", "") : "No Description";

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Project</td><td class="value">%s</td></tr>
                <tr><td class="label">Task Key</td><td class="value">%s</td></tr>
                <tr><td class="label">Priority</td><td class="value">%s</td></tr>
                <tr><td class="label">Due Date</td><td class="value">%s</td></tr>
                <tr><td class="label">Created By</td><td class="value">%s</td></tr>
            </table>
            """, projName, taskKey, task.getPriority(), dueDateStr, creatorName);

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("Task Created & Assigned", "New Task for You", 
            "A new task has been created and assigned to you. Details are provided below:", details, "View Task Details", taskUrl);

        queueAndSendEmail(assignee.getEmail(), subject, html, "TASK_CREATED", UUID.randomUUID().toString(), assignee.getId());
    }

    // 2. Task Assigned or Reassigned
    public void sendTaskAssignedEmail(User assignee, User previousAssignee, Task task) {
        if (assignee == null || assignee.getEmail() == null) return;
        String taskKey = getTaskKey(task);
        String subject = String.format("Task Assignment: %s - %s", taskKey, task.getTitle());
        String prevAssigneeName = previousAssignee != null ? previousAssignee.getName() : "Unassigned";
        String dueDateStr = task.getDueDate() != null ? task.getDueDate().toString() : "No Due Date";

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Task Title</td><td class="value">%s</td></tr>
                <tr><td class="label">Previous Assignee</td><td class="value">%s</td></tr>
                <tr><td class="label">Priority</td><td class="value">%s</td></tr>
                <tr><td class="label">Due Date</td><td class="value">%s</td></tr>
            </table>
            """, task.getTitle(), prevAssigneeName, task.getPriority(), dueDateStr);

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("Task Assignment Update", "Task Assigned to You", 
            "You have been assigned as the primary owner for this task:", details, "Open Board", taskUrl);

        queueAndSendEmail(assignee.getEmail(), subject, html, "TASK_ASSIGNED", UUID.randomUUID().toString(), assignee.getId());
    }

    // 3. Task Approved or Rejected / Decision
    public void sendPendingReviewEmail(Task task) {
        System.out.println("DEBUG: sendPendingReviewEmail called for task " + task.getId());
        if (task.getProject() == null) return;
        
        User creator = task.getReporter();
        String taskKey = getTaskKey(task);
        boolean isSubtask = task.getParentTask() != null;
        
        String formattedType = "Task";
        if (task.getIssueType() != null) {
            String typeUpper = task.getIssueType().toUpperCase();
            if (typeUpper.equals("BUG")) formattedType = isSubtask ? "Subtask (Bug)" : "Bug";
            else if (typeUpper.equals("STORY")) formattedType = isSubtask ? "Subtask (Story)" : "Story";
            else if (typeUpper.equals("EPIC")) formattedType = isSubtask ? "Subtask (Epic)" : "Epic";
            else if (typeUpper.equals("TASK")) formattedType = isSubtask ? "Subtask (Task)" : "Task";
        } else if (isSubtask) {
            formattedType = "Subtask";
        }
        
        String subject = String.format("%s Approval Required - %s - %s", formattedType, task.getProject().getName(), taskKey);
        String creatorName = creator != null ? creator.getName() : "Unknown User";
        String date = task.getCreatedAt() != null ? task.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "N/A";

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Project</td><td class="value">%s</td></tr>
                <tr><td class="label">Item Code</td><td class="value">%s</td></tr>
                <tr><td class="label">Title</td><td class="value">%s</td></tr>
                <tr><td class="label">Submitted By</td><td class="value">%s</td></tr>
            </table>
            """, task.getProject().getName(), taskKey, task.getTitle(), creatorName);

        String reviewUrl = String.format("%s/dashboard/pm-review-queue", frontendUrl);
        String html = buildHtmlWrapper("Approval Request", "Task Review Submission", 
            "A new item has been submitted for PM review and requires your action:", details, "Go to Review Queue", reviewUrl);

        java.util.Set<User> pms = new java.util.HashSet<>();
        if (task.getProject() != null) {
            if (task.getProject().getCreatedBy() != null) {
                pms.add(task.getProject().getCreatedBy());
            }
        }
        for (User pm : pms) {
            if (pm.getEmail() == null || pm.getEmail().isEmpty()) continue;
            queueAndSendEmail(pm.getEmail(), subject, html, "TASK_REVIEW_DECISION", UUID.randomUUID().toString(), pm.getId());
        }
    }

    public void sendTaskApprovedEmail(Task task) {
        if (task.getReporter() == null) return;
        User creator = task.getReporter();
        String taskKey = getTaskKey(task);
        String subject = "Task Approved - " + taskKey;

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Task Key</td><td class="value">%s</td></tr>
                <tr><td class="label">Title</td><td class="value">%s</td></tr>
                <tr><td class="label">Approval Status</td><td class="value" style="color: #36B37E; font-weight: bold;">APPROVED</td></tr>
            </table>
            """, taskKey, task.getTitle());

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("Task Approved", "Your Task was Approved", 
            "Your task submission has been approved and successfully added to the project board.", details, "View on Board", taskUrl);

        queueAndSendEmail(creator.getEmail(), subject, html, "TASK_REVIEW_DECISION", UUID.randomUUID().toString(), creator.getId());
    }

    public void sendTaskRejectedEmail(Task task, String reason) {
        if (task.getReporter() == null) return;
        User creator = task.getReporter();
        String taskKey = getTaskKey(task);
        String subject = "Task Rejected - " + taskKey;

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Task Key</td><td class="value">%s</td></tr>
                <tr><td class="label">Title</td><td class="value">%s</td></tr>
                <tr><td class="label">Review Comments</td><td class="value">%s</td></tr>
                <tr><td class="label">Approval Status</td><td class="value" style="color: #FF5630; font-weight: bold;">REJECTED</td></tr>
            </table>
            """, taskKey, task.getTitle(), reason != null ? reason : "No specific comment provided.");

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("Task Rejected", "Your Task was Rejected", 
            "The Project Manager reviewed and rejected your submitted task with the following feedback:", details, "Open Workspace", taskUrl);

        queueAndSendEmail(creator.getEmail(), subject, html, "TASK_REVIEW_DECISION", UUID.randomUUID().toString(), creator.getId());
    }

    public void sendClarificationEmail(Task task, String comments) {
        if (task.getReporter() == null) return;
        User creator = task.getReporter();
        String taskKey = getTaskKey(task);
        String subject = "Task Clarification Required - " + taskKey;

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Task Key</td><td class="value">%s</td></tr>
                <tr><td class="label">Title</td><td class="value">%s</td></tr>
                <tr><td class="label">PM Instructions</td><td class="value">%s</td></tr>
            </table>
            """, taskKey, task.getTitle(), comments);

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("Clarification Requested", "Clarification Needed", 
            "The Project Manager requested updates on your submitted task before giving approval:", details, "Clarify Task Now", taskUrl);

        queueAndSendEmail(creator.getEmail(), subject, html, "TASK_REVIEW_DECISION", UUID.randomUUID().toString(), creator.getId());
    }

    public void sendSubtaskCreatedEmail(
            String assigneeEmail,
            String assigneeName,
            String projectName,
            String parentKey,
            String parentTitle,
            String subtaskKey,
            String subtaskTitle,
            String priority,
            String issueType
    ) {
        String formattedType = "Subtask";
        if (issueType != null) {
            String typeUpper = issueType.toUpperCase();
            if (typeUpper.equals("BUG")) formattedType = "Subtask (Bug)";
            else if (typeUpper.equals("STORY")) formattedType = "Subtask (Story)";
            else if (typeUpper.equals("EPIC")) formattedType = "Subtask (Epic)";
            else if (typeUpper.equals("TASK")) formattedType = "Subtask (Task)";
        }

        String subject = String.format("New %s Assigned: %s", formattedType, subtaskKey);
        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Project</td><td class="value">%s</td></tr>
                <tr><td class="label">Parent Key</td><td class="value">%s - %s</td></tr>
                <tr><td class="label">Subtask Code</td><td class="value">%s - %s</td></tr>
                <tr><td class="label">Priority</td><td class="value">%s</td></tr>
            </table>
            """, projectName, parentKey, parentTitle, subtaskKey, subtaskTitle, priority != null ? priority : "MEDIUM");

        String taskUrl = String.format("%s/dashboard/my-tasks", frontendUrl);
        String html = buildHtmlWrapper("Subtask Assigned", "New Subtask for You", 
            "A new child subtask has been assigned to you. Details below:", details, "View My Tasks", taskUrl);

        User assignee = userRepository.findByEmail(assigneeEmail).orElse(null);
        Long uid = assignee != null ? assignee.getId() : null;
        queueAndSendEmail(assigneeEmail, subject, html, "TASK_CREATED", UUID.randomUUID().toString(), uid);
    }

    // 4. Task Status Changed
    public void sendTaskStatusChangedEmail(User assignee, User reporter, Task task, String previousStatus, String newStatus, User updatedBy) {
        String taskKey = getTaskKey(task);
        String subject = String.format("Status Update: %s - %s", taskKey, task.getTitle());
        String updatedByName = updatedBy != null ? updatedBy.getName() : "System";

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Task Key</td><td class="value">%s</td></tr>
                <tr><td class="label">Previous Status</td><td class="value">%s</td></tr>
                <tr><td class="label">New Status</td><td class="value" style="color: #1F6FEB; font-weight: bold;">%s</td></tr>
                <tr><td class="label">Updated By</td><td class="value">%s</td></tr>
            </table>
            """, taskKey, previousStatus, newStatus, updatedByName);

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("Task Status Update", "Task Transitioned", 
            "The following task has transitioned status:", details, "Open Board", taskUrl);

        if (assignee != null && assignee.getEmail() != null) {
            queueAndSendEmail(assignee.getEmail(), subject, html, "TASK_STATUS_CHANGED", UUID.randomUUID().toString(), assignee.getId());
        }
        if (reporter != null && reporter.getEmail() != null && (assignee == null || !reporter.getId().equals(assignee.getId()))) {
            queueAndSendEmail(reporter.getEmail(), subject, html, "TASK_STATUS_CHANGED", UUID.randomUUID().toString(), reporter.getId());
        }
    }

    // 5. Comment Added
    public void sendCommentAddedEmail(User recipient, User commenter, Task task, String commentContent) {
        if (recipient == null || recipient.getEmail() == null) return;
        String taskKey = getTaskKey(task);
        String subject = String.format("New Comment on %s: %s", taskKey, task.getTitle());
        String cleanComment = commentContent != null ? commentContent.replaceAll("<[^>]*>", "") : "";
        if (cleanComment.length() > 150) {
            cleanComment = cleanComment.substring(0, 147) + "...";
        }

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Task Title</td><td class="value">%s</td></tr>
                <tr><td class="label">Commenter</td><td class="value">%s</td></tr>
                <tr><td class="label">Comment Preview</td><td class="value" style="font-style: italic;">"%s"</td></tr>
            </table>
            """, task.getTitle(), commenter != null ? commenter.getName() : "Someone", cleanComment);

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("New Comment Added", "Comment Activity Notification", 
            "A new comment was added to a task you are watching or owning:", details, "Reply to Comment", taskUrl);

        queueAndSendEmail(recipient.getEmail(), subject, html, "COMMENT_ADDED", UUID.randomUUID().toString(), recipient.getId());
    }

    // 6. User Mentioned
    public void sendUserMentionedEmail(User mentionedUser, User commenter, Task task, String commentContent) {
        if (mentionedUser == null || mentionedUser.getEmail() == null) return;
        String taskKey = getTaskKey(task);
        String subject = String.format("You were mentioned in task %s", taskKey);
        String cleanComment = commentContent != null ? commentContent.replaceAll("<[^>]*>", "") : "";

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Mentioned In</td><td class="value">%s - %s</td></tr>
                <tr><td class="label">Commenter</td><td class="value">%s</td></tr>
                <tr><td class="label">Message</td><td class="value" style="font-style: italic; background: #FFF9E6; border-left: 3px solid #FFAB00; padding: 8px;">"%s"</td></tr>
            </table>
            """, taskKey, task.getTitle(), commenter != null ? commenter.getName() : "Someone", cleanComment);

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("User Mentioned", "You Were Mentioned!", 
            "You were mentioned in a comment conversation. Check the details below:", details, "View Comment", taskUrl);

        queueAndSendEmail(mentionedUser.getEmail(), subject, html, "USER_MENTIONED", UUID.randomUUID().toString(), mentionedUser.getId());
    }

    // 7. Due Date Reminder
    public void sendDueDateReminderEmail(User assignee, Task task, String remainingTime) {
        if (assignee == null || assignee.getEmail() == null) return;
        String taskKey = getTaskKey(task);
        String subject = String.format("Reminder: Task '%s' is due in %s", taskKey, remainingTime);

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Task Key</td><td class="value">%s</td></tr>
                <tr><td class="label">Task Title</td><td class="value">%s</td></tr>
                <tr><td class="label">Remaining Time</td><td class="value" style="color: #FF8B00; font-weight: bold;">%s</td></tr>
                <tr><td class="label">Due Date</td><td class="value">%s</td></tr>
            </table>
            """, taskKey, task.getTitle(), remainingTime, task.getDueDate() != null ? task.getDueDate().toString() : "Tomorrow");

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("Due Date Reminder", "Upcoming Task Deadline", 
            "This is a reminder that the deadline for the following assigned task is approaching:", details, "Open Board Task", taskUrl);

        queueAndSendEmail(assignee.getEmail(), subject, html, "DUE_DATE_REMINDER", UUID.randomUUID().toString(), assignee.getId());
    }

    // 8. Task Overdue
    public void sendTaskOverdueEmail(User recipient, Task task, String overdueDuration) {
        if (recipient == null || recipient.getEmail() == null) return;
        String taskKey = getTaskKey(task);
        String subject = String.format("CRITICAL OVERDUE: %s - %s", taskKey, task.getTitle());

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Task Key</td><td class="value">%s</td></tr>
                <tr><td class="label">Assignee</td><td class="value">%s</td></tr>
                <tr><td class="label">Original Due Date</td><td class="value">%s</td></tr>
                <tr><td class="label">Overdue Time</td><td class="value" style="color: #FF5630; font-weight: bold; text-transform: uppercase;">%s OVERDUE</td></tr>
            </table>
            """, taskKey, task.getAssignee() != null ? task.getAssignee().getName() : "Unassigned",
            task.getDueDate() != null ? task.getDueDate().toString() : "Past Due", overdueDuration);

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("Task Overdue Warning", "Task Overdue Warning", 
            "The following task is incomplete and has passed its configured due date:", details, "Inspect Overdue Task", taskUrl);

        queueAndSendEmail(recipient.getEmail(), subject, html, "TASK_OVERDUE", UUID.randomUUID().toString(), recipient.getId());
    }

    // 9. Sprint Started
    public void sendSprintStartedEmail(User recipient, Sprint sprint) {
        if (recipient == null || recipient.getEmail() == null) return;
        String subject = String.format("Sprint Started: %s", sprint.getName());
        String dateRange = String.format("%s to %s", 
            sprint.getStartDate() != null ? sprint.getStartDate().toString() : "N/A",
            sprint.getEndDate() != null ? sprint.getEndDate().toString() : "N/A");

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Sprint Name</td><td class="value">%s</td></tr>
                <tr><td class="label">Dates</td><td class="value">%s</td></tr>
            </table>
            """, sprint.getName(), dateRange);

        String sprintUrl = String.format("%s/dashboard/sprint-board/%d", frontendUrl, sprint.getProject() != null ? sprint.getProject().getId() : 0);
        String html = buildHtmlWrapper("Sprint Started", "Active Sprint Commenced", 
            "A new active development sprint has been started in your project. Get ready to pull items!", details, "Go to Sprint Board", sprintUrl);

        queueAndSendEmail(recipient.getEmail(), subject, html, "SPRINT_STARTED", UUID.randomUUID().toString(), recipient.getId());
    }

    // 10. Sprint Completed
    public void sendSprintCompletedEmail(User recipient, Sprint sprint, int completedTasks, int incompleteTasks) {
        if (recipient == null || recipient.getEmail() == null) return;
        String subject = String.format("Sprint Completed: %s", sprint.getName());

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Sprint Name</td><td class="value">%s</td></tr>
                <tr><td class="label">Completed Tasks</td><td class="value" style="color: #36B37E; font-weight: bold;">%d items</td></tr>
                <tr><td class="label">Incomplete Tasks</td><td class="value" style="color: #FF8B00;">%d items moved to backlog</td></tr>
            </table>
            """, sprint.getName(), completedTasks, incompleteTasks);

        String sprintUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, sprint.getProject() != null ? sprint.getProject().getId() : 0);
        String html = buildHtmlWrapper("Sprint Completed", "Sprint Closure Report", 
            "The active sprint has been officially completed. All remaining work items have been rolled back to the backlog:", details, "Open Board", sprintUrl);

        queueAndSendEmail(recipient.getEmail(), subject, html, "SPRINT_COMPLETED", UUID.randomUUID().toString(), recipient.getId());
    }

    // 11. Task Completed
    public void sendTaskCompletedEmail(User recipient, Task task) {
        if (recipient == null || recipient.getEmail() == null) return;
        String taskKey = getTaskKey(task);
        String subject = String.format("Task Completed: %s - %s", taskKey, task.getTitle());

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Task Key</td><td class="value">%s</td></tr>
                <tr><td class="label">Title</td><td class="value">%s</td></tr>
                <tr><td class="label">Owner</td><td class="value">%s</td></tr>
                <tr><td class="label">Completion Status</td><td class="value" style="color: #36B37E; font-weight: bold;">DONE / CLOSED</td></tr>
            </table>
            """, taskKey, task.getTitle(), task.getAssignee() != null ? task.getAssignee().getName() : "Unassigned");

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("Task Completed", "Task Completed Successfully", 
            "The following task is now closed. Details below:", details, "Inspect Closed Task", taskUrl);

        queueAndSendEmail(recipient.getEmail(), subject, html, "TASK_COMPLETED", UUID.randomUUID().toString(), recipient.getId());
    }

    // 12. Task Reopened
    public void sendTaskReopenedEmail(User recipient, Task task, String reason) {
        if (recipient == null || recipient.getEmail() == null) return;
        String taskKey = getTaskKey(task);
        String subject = String.format("Task Reopened: %s - %s", taskKey, task.getTitle());

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Task Key</td><td class="value">%s</td></tr>
                <tr><td class="label">Reopened Reason</td><td class="value">%s</td></tr>
                <tr><td class="label">Assignee</td><td class="value">%s</td></tr>
            </table>
            """, taskKey, reason != null ? reason : "No reason specified.",
            task.getAssignee() != null ? task.getAssignee().getName() : "Unassigned");

        String taskUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, task.getProject() != null ? task.getProject().getId() : 0);
        String html = buildHtmlWrapper("Task Reopened", "Task Reopened Warning", 
            "A closed work item has been reopened and placed back into the board backlog columns:", details, "Go to Board", taskUrl);

        queueAndSendEmail(recipient.getEmail(), subject, html, "TASK_REOPENED", UUID.randomUUID().toString(), recipient.getId());
    }

    // 13. Project Invitation
    public void sendProjectInvitationEmail(User recipient, Project project, String role, User inviter) {
        if (recipient == null || recipient.getEmail() == null) return;
        String subject = String.format("Invitation to Join Project: %s", project.getName());
        String inviterName = inviter != null ? inviter.getName() : "System Administrator";

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Project Name</td><td class="value">%s</td></tr>
                <tr><td class="label">Invited By</td><td class="value">%s</td></tr>
                <tr><td class="label">Project Role</td><td class="value">%s</td></tr>
            </table>
            """, project.getName(), inviterName, role);

        String projectUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, project.getId());
        String html = buildHtmlWrapper("Project Invitation", "You've Been Invited!", 
            "You have been invited and added to a project workspace. Welcome aboard!", details, "Accept & Open Project", projectUrl);

        queueAndSendEmail(recipient.getEmail(), subject, html, "PROJECT_INVITATION", UUID.randomUUID().toString(), recipient.getId());
    }

    // 14. Role or Permission Changes
    public void sendRoleChangedEmail(User recipient, Project project, String previousRole, String newRole) {
        if (recipient == null || recipient.getEmail() == null) return;
        String subject = String.format("Permissions Modified in Project: %s", project.getName());

        String details = String.format("""
            <table class="details-table">
                <tr><td class="label">Project Name</td><td class="value">%s</td></tr>
                <tr><td class="label">Previous Role</td><td class="value">%s</td></tr>
                <tr><td class="label">New Role</td><td class="value" style="color: #1F6FEB; font-weight: bold;">%s</td></tr>
            </table>
            """, project.getName(), previousRole, newRole);

        String projectUrl = String.format("%s/dashboard/project-details/%d", frontendUrl, project.getId());
        String html = buildHtmlWrapper("Membership Role Update", "Access Permissions Updated", 
            "Your access role and permissions in this project have been modified:", details, "Open Board", projectUrl);

        queueAndSendEmail(recipient.getEmail(), subject, html, "ROLE_CHANGED", UUID.randomUUID().toString(), recipient.getId());
    }
}
