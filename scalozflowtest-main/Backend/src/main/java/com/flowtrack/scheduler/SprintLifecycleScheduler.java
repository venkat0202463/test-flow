package com.flowtrack.scheduler;

import com.flowtrack.service.SprintService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;

@Component
public class SprintLifecycleScheduler {
    
    private static final Logger LOGGER = LoggerFactory.getLogger(SprintLifecycleScheduler.class);

    @Autowired
    private SprintService sprintService;

    // Run every hour to catch up if needed
    @Scheduled(cron = "0 0 * * * ?")
    public void checkAndExpireSprints() {
        LOGGER.info("Running SprintLifecycleScheduler to check for expired sprints...");
        try {
            LocalDate today = LocalDate.now();
            sprintService.autoExpireSprints(today);
            LOGGER.info("SprintLifecycleScheduler finished successfully.");
        } catch (Exception e) {
            LOGGER.error("Error occurred while expiring sprints: {}", e.getMessage(), e);
        }
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void runOnStartup() {
        LOGGER.info("Application started. Running initial check for expired sprints...");
        checkAndExpireSprints();
    }
}
