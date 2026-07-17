package com.flowtrack.security;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.beans.factory.annotation.Value;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;

@Service
public class LoginAttemptService {
    private static final int MAX_ATTEMPT = 3;
    private static final int BLOCK_DURATION_MINS = 15;
    private static final int GLOBAL_ALERT_THRESHOLD = 10;
    private static final long GLOBAL_ALERT_WINDOW_MS = 5 * 60 * 1000; // 5 mins

    private Map<String, Integer> attemptsCache = new ConcurrentHashMap<>();
    private Map<String, Long> blockCache = new ConcurrentHashMap<>();
    
    // Thread-safe list to keep track of global failed attempt timestamps
    private List<Long> globalFailedTimestamps = Collections.synchronizedList(new ArrayList<>());
    private long lastAlertTime = 0;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public void loginSucceeded(String key) {
        attemptsCache.remove(key);
        blockCache.remove(key);
    }

    public void loginFailed(String key) {
        int attempts = attemptsCache.getOrDefault(key, 0) + 1;
        attemptsCache.put(key, attempts);
        if (attempts >= MAX_ATTEMPT) {
            blockCache.put(key, System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(BLOCK_DURATION_MINS));
        }

        long now = System.currentTimeMillis();
        globalFailedTimestamps.add(now);
        
        // Remove old timestamps
        globalFailedTimestamps.removeIf(timestamp -> now - timestamp > GLOBAL_ALERT_WINDOW_MS);
        
        if (globalFailedTimestamps.size() >= GLOBAL_ALERT_THRESHOLD && (now - lastAlertTime > GLOBAL_ALERT_WINDOW_MS)) {
            lastAlertTime = now;
            sendSecurityAlert();
        }
    }

    private void sendSecurityAlert() {
        if (mailSender == null) return;
        new Thread(() -> {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setFrom(fromEmail);
                msg.setTo("security@xevyte.com"); // Using a generic security email, can be configured
                msg.setSubject("URGENT: High volume of failed login attempts");
                msg.setText("There have been 10 or more failed login attempts across the system within the last 5 minutes. Please investigate for potential brute force attacks.");
                mailSender.send(msg);
            } catch (Exception e) {
                System.err.println("Failed to send security alert: " + e.getMessage());
            }
        }).start();
    }

    public boolean isBlocked(String key) {
        if (!blockCache.containsKey(key)) {
            return false;
        }
        long unblockTime = blockCache.get(key);
        if (System.currentTimeMillis() > unblockTime) {
            blockCache.remove(key);
            attemptsCache.remove(key);
            return false;
        }
        return true;
    }
}
