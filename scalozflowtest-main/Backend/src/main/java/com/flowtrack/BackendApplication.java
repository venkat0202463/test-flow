package com.flowtrack;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import io.github.cdimascio.dotenv.Dotenv;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@SpringBootApplication
@org.springframework.scheduling.annotation.EnableAsync
@org.springframework.scheduling.annotation.EnableScheduling
public class BackendApplication {
    private static final Logger LOGGER = LoggerFactory.getLogger(BackendApplication.class);
    public static void main(String[] args) {
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"));
        Dotenv dotenv = Dotenv.configure()
                .directory("./")
                .ignoreIfMissing()
                .load();

        dotenv.entries().forEach(entry -> {
            System.setProperty(entry.getKey(), entry.getValue());
        });

        try {
            String dbHost = System.getProperty("DB_HOST");
            String dbName = System.getProperty("DB_NAME");
            String dbUser = System.getProperty("DB_USER");
            String dbPass = System.getProperty("DB_PASSWORD");
            
            if (dbHost != null && dbName != null) {
                String jdbcUrl = "jdbc:postgresql://" + dbHost + ":5432/" + dbName;
                LOGGER.info("Executing pre-JPA drop script on: " + jdbcUrl);
                try (java.sql.Connection conn = java.sql.DriverManager.getConnection(jdbcUrl, dbUser, dbPass);
                     java.sql.Statement stmt = conn.createStatement()) {
                    stmt.execute("DROP TABLE IF EXISTS work_logs CASCADE");
                    LOGGER.info("Pre-JPA work_logs table drop executed successfully.");
                }
            }
        } catch (Exception e) {
            LOGGER.warn("Pre-JPA migration drop skipped or failed: " + e.getMessage());
        }

        SpringApplication.run(BackendApplication.class, args);
    }

    @org.springframework.context.annotation.Bean(name = "taskExecutor")
    public java.util.concurrent.Executor taskExecutor() {
        org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor executor = new org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("EmailAsync-");
        executor.initialize();
        return executor;
    }

    @org.springframework.context.annotation.Bean
    public org.springframework.boot.CommandLineRunner uatColumnMigration(
            com.flowtrack.repository.ProjectRepository projectRepo,
            com.flowtrack.repository.BoardColumnRepository colRepo) {
        return args -> {
            for (com.flowtrack.model.Project p : projectRepo.findAll()) {
                java.util.List<com.flowtrack.model.BoardColumn> cols = colRepo
                        .findByProjectIdOrderByOrderIndexAsc(p.getId());
                LOGGER.info("PROJECT " + p.getId() + " COLUMNS:");
                for (com.flowtrack.model.BoardColumn c : cols) {
                    LOGGER.info("- " + c.getName() + " (order=" + c.getOrderIndex() + ")");
                }
                boolean hasUat = cols.stream().anyMatch(c -> "UAT".equalsIgnoreCase(c.getName()));
                if (!hasUat && !cols.isEmpty()) {
                    int maxOrder = cols.stream().mapToInt(com.flowtrack.model.BoardColumn::getOrderIndex).max()
                            .orElse(0);
                    com.flowtrack.model.BoardColumn uat = new com.flowtrack.model.BoardColumn();
                    uat.setProject(p);
                    uat.setName("UAT");
                    uat.setOrderIndex(maxOrder + 1);
                    colRepo.save(uat);
                    LOGGER.info("ADDED UAT COLUMN FOR PROJECT " + p.getId());
                }
            }
        };
    }

    @org.springframework.context.annotation.Bean
    public org.springframework.boot.CommandLineRunner timeTrackingSchemaMigration(
            org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
        return args -> {
            LOGGER.info("Running time tracking schema migration...");
            try {
                // Ensure columns on tasks table
                jdbcTemplate.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS original_estimate VARCHAR(50)");
                jdbcTemplate.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS original_estimate_seconds BIGINT DEFAULT 0");
                jdbcTemplate.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_spent_seconds BIGINT DEFAULT 0");
                jdbcTemplate.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remaining_estimate_seconds BIGINT DEFAULT 0");

                // Ensure work_logs table is created cleanly
                jdbcTemplate.execute("DROP TABLE IF EXISTS work_logs CASCADE");
                jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS work_logs (" +
                        "id BIGSERIAL PRIMARY KEY, " +
                        "task_id BIGINT NOT NULL, " +
                        "user_id VARCHAR(255) NOT NULL, " +
                        "time_spent VARCHAR(50) NOT NULL, " +
                        "time_spent_seconds BIGINT NOT NULL DEFAULT 0, " +
                        "work_date DATE NOT NULL, " +
                        "comment TEXT, " +
                        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                
                LOGGER.info("Time tracking schema migration completed successfully!");
            } catch (Exception e) {
                LOGGER.error("Failed to run time tracking schema migration", e);
            }
        };
    }
}
