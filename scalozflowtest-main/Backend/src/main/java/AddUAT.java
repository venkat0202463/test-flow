import java.sql.*;
import java.util.logging.Logger;

public class AddUAT {
    private static final Logger LOGGER = Logger.getLogger(AddUAT.class.getName());

    public static void main(String[] args) {
        String url = "jdbc:postgresql://localhost:5432/flow_db";
        String user = System.getenv("DB_USER") != null ? System.getenv("DB_USER") : "postgres";
        String password = System.getenv("DB_PASSWORD") != null ? System.getenv("DB_PASSWORD") : "";

        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            String sql = "INSERT INTO board_columns (project_id, column_name, order_index, tenant_id) " +
                         "SELECT p.id, 'UAT', " +
                         "  COALESCE((SELECT MAX(order_index) + 1 FROM board_columns bc WHERE bc.project_id = p.id), 4), " +
                         "  NULL " +
                         "FROM projects p " +
                         "WHERE NOT EXISTS (SELECT 1 FROM board_columns bc2 WHERE bc2.project_id = p.id AND UPPER(bc2.column_name) = 'UAT')";

            int updated = stmt.executeUpdate(sql);
            LOGGER.info("Rows updated: " + updated);

            ResultSet rs = stmt.executeQuery("SELECT project_id, column_name, order_index FROM board_columns WHERE column_name = 'UAT'");
            while (rs.next()) {
                LOGGER.info("Project " + rs.getInt("project_id") + " has UAT at index " + rs.getInt("order_index"));
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
