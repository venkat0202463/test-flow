package com.flowtrack.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.autoconfigure.orm.jpa.EntityManagerFactoryDependsOnPostProcessor;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.sql.ResultSet;
import java.util.List;
import java.util.ArrayList;

@Configuration("databaseMigrationConfig")
public class DatabaseMigrationConfig {

    @Bean
    public static EntityManagerFactoryDependsOnPostProcessor entityManagerFactoryDependsOnPostProcessor() {
        return new EntityManagerFactoryDependsOnPostProcessor("databaseMigrationConfig");
    }

    public DatabaseMigrationConfig(DataSource dataSource) {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            
            // 1. Drop constraints and migrate projects.created_by
            try {
                ResultSet rs = stmt.executeQuery(
                    "SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'projects' AND column_name = 'created_by'"
                );
                List<String> constraints = new ArrayList<>();
                while (rs.next()) {
                    constraints.add(rs.getString("constraint_name"));
                }
                rs.close();
                for (String constraint : constraints) {
                    try {
                        stmt.execute("ALTER TABLE projects DROP CONSTRAINT " + constraint);
                    } catch (Exception e) {}
                }
            } catch (Exception e) {}

            try {
                stmt.execute("ALTER TABLE projects ALTER COLUMN created_by TYPE VARCHAR(255) USING created_by::varchar");
            } catch (Exception e) {}

            try {
                stmt.execute("UPDATE projects SET created_by = (SELECT emp_id FROM users WHERE id = CAST(created_by AS BIGINT)) WHERE created_by IN (SELECT CAST(id AS VARCHAR) FROM users)");
            } catch (Exception e) {}

            // 2. Drop constraints and migrate tasks columns: assignee_id, co_assignee_id, reporter_id
            String[] taskCols = {"assignee_id", "co_assignee_id", "reporter_id"};
            for (String col : taskCols) {
                try {
                    ResultSet rs = stmt.executeQuery(
                        "SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'tasks' AND column_name = '" + col + "'"
                    );
                    List<String> constraints = new ArrayList<>();
                    while (rs.next()) {
                        constraints.add(rs.getString("constraint_name"));
                    }
                    rs.close();
                    for (String constraint : constraints) {
                        try {
                            stmt.execute("ALTER TABLE tasks DROP CONSTRAINT " + constraint);
                        } catch (Exception e) {}
                    }
                } catch (Exception e) {}

                try {
                    stmt.execute("ALTER TABLE tasks ALTER COLUMN " + col + " TYPE VARCHAR(255) USING " + col + "::varchar");
                } catch (Exception e) {}

                try {
                    stmt.execute("UPDATE tasks SET " + col + " = (SELECT emp_id FROM users WHERE id = CAST(" + col + " AS BIGINT)) WHERE " + col + " IN (SELECT CAST(id AS VARCHAR) FROM users)");
                } catch (Exception e) {}
            }

            // 3. Drop constraints and migrate activity_logs.user_id
            try {
                ResultSet rs = stmt.executeQuery(
                    "SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'activity_logs' AND column_name = 'user_id'"
                );
                List<String> constraints = new ArrayList<>();
                while (rs.next()) {
                    constraints.add(rs.getString("constraint_name"));
                }
                rs.close();
                for (String constraint : constraints) {
                    try {
                        stmt.execute("ALTER TABLE activity_logs DROP CONSTRAINT " + constraint);
                    } catch (Exception e) {}
                }
            } catch (Exception e) {}

            try {
                stmt.execute("ALTER TABLE activity_logs ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::varchar");
            } catch (Exception e) {}

            try {
                stmt.execute("UPDATE activity_logs SET user_id = (SELECT emp_id FROM users WHERE id = CAST(user_id AS BIGINT)) WHERE user_id IN (SELECT CAST(id AS VARCHAR) FROM users)");
            } catch (Exception e) {}

            // 4. Add tenant_id to board_columns
            try {
                stmt.execute("ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255)");
            } catch (Exception e) {}

            // 5. Drop constraints and migrate comments.user_id
            try {
                ResultSet rs = stmt.executeQuery(
                    "SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'comments' AND column_name = 'user_id'"
                );
                List<String> constraints = new ArrayList<>();
                while (rs.next()) {
                    constraints.add(rs.getString("constraint_name"));
                }
                rs.close();
                for (String constraint : constraints) {
                    try {
                        stmt.execute("ALTER TABLE comments DROP CONSTRAINT " + constraint);
                    } catch (Exception e) {}
                }
            } catch (Exception e) {}

            try {
                stmt.execute("ALTER TABLE comments ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::varchar");
            } catch (Exception e) {}

            try {
                stmt.execute("UPDATE comments SET user_id = (SELECT emp_id FROM users WHERE id = CAST(user_id AS BIGINT)) WHERE user_id IN (SELECT CAST(id AS VARCHAR) FROM users)");
            } catch (Exception e) {}

            // 6. Drop constraints and migrate login_logs.user_id
            try {
                ResultSet rs = stmt.executeQuery(
                    "SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'login_logs' AND column_name = 'user_id'"
                );
                List<String> constraints = new ArrayList<>();
                while (rs.next()) {
                    constraints.add(rs.getString("constraint_name"));
                }
                rs.close();
                for (String constraint : constraints) {
                    try {
                        stmt.execute("ALTER TABLE login_logs DROP CONSTRAINT " + constraint);
                    } catch (Exception e) {}
                }
            } catch (Exception e) {}

            try {
                stmt.execute("ALTER TABLE login_logs ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::varchar");
            } catch (Exception e) {}

            try {
                stmt.execute("UPDATE login_logs SET user_id = (SELECT emp_id FROM users WHERE id = CAST(user_id AS BIGINT)) WHERE user_id IN (SELECT CAST(id AS VARCHAR) FROM users)");
            } catch (Exception e) {}

            // 7. Drop constraints and migrate notifications.user_id
            try {
                ResultSet rs = stmt.executeQuery(
                    "SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'notifications' AND column_name = 'user_id'"
                );
                List<String> constraints = new ArrayList<>();
                while (rs.next()) {
                    constraints.add(rs.getString("constraint_name"));
                }
                rs.close();
                for (String constraint : constraints) {
                    try {
                        stmt.execute("ALTER TABLE notifications DROP CONSTRAINT " + constraint);
                    } catch (Exception e) {}
                }
            } catch (Exception e) {}

            try {
                stmt.execute("ALTER TABLE notifications ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::varchar");
            } catch (Exception e) {}

            try {
                stmt.execute("UPDATE notifications SET user_id = (SELECT emp_id FROM users WHERE id = CAST(user_id AS BIGINT)) WHERE user_id IN (SELECT CAST(id AS VARCHAR) FROM users)");
            } catch (Exception e) {}

            // 8. Drop constraints and migrate password_history.user_id
            try {
                ResultSet rs = stmt.executeQuery(
                    "SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'password_history' AND column_name = 'user_id'"
                );
                List<String> constraints = new ArrayList<>();
                while (rs.next()) {
                    constraints.add(rs.getString("constraint_name"));
                }
                rs.close();
                for (String constraint : constraints) {
                    try {
                        stmt.execute("ALTER TABLE password_history DROP CONSTRAINT " + constraint);
                    } catch (Exception e) {}
                }
            } catch (Exception e) {}

            try {
                stmt.execute("ALTER TABLE password_history ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::varchar");
            } catch (Exception e) {}

            try {
                stmt.execute("UPDATE password_history SET user_id = (SELECT emp_id FROM users WHERE id = CAST(user_id AS BIGINT)) WHERE user_id IN (SELECT CAST(id AS VARCHAR) FROM users)");
            } catch (Exception e) {}

            // 9. Drop constraints and migrate project_members.user_id
            try {
                ResultSet rs = stmt.executeQuery(
                    "SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'project_members' AND column_name = 'user_id'"
                );
                List<String> constraints = new ArrayList<>();
                while (rs.next()) {
                    constraints.add(rs.getString("constraint_name"));
                }
                rs.close();
                for (String constraint : constraints) {
                    try {
                        stmt.execute("ALTER TABLE project_members DROP CONSTRAINT " + constraint);
                    } catch (Exception e) {}
                }
            } catch (Exception e) {}

            try {
                stmt.execute("ALTER TABLE project_members ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::varchar");
            } catch (Exception e) {}

            try {
                stmt.execute("UPDATE project_members SET user_id = (SELECT emp_id FROM users WHERE id = CAST(user_id AS BIGINT)) WHERE user_id IN (SELECT CAST(id AS VARCHAR) FROM users)");
            } catch (Exception e) {}

            try {
                stmt.execute("ALTER TABLE project_members ADD CONSTRAINT project_members_pkey PRIMARY KEY (project_id, user_id)");
            } catch (Exception e) {}

            // 10. Auto-add UAT column for all projects
            try {
                stmt.execute(
                    "INSERT INTO board_columns (project_id, column_name, order_index, tenant_id) " +
                    "SELECT p.id, 'UAT', " +
                    "  COALESCE((SELECT MAX(order_index) + 1 FROM board_columns bc WHERE bc.project_id = p.id), 4), " +
                    "  NULL " +
                    "FROM projects p " +
                    "WHERE NOT EXISTS (SELECT 1 FROM board_columns bc2 WHERE bc2.project_id = p.id AND UPPER(bc2.column_name) = 'UAT')"
                );
            } catch (Exception e) {
                System.err.println("FAILED TO ADD UAT COLUMN:");
                e.printStackTrace();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
