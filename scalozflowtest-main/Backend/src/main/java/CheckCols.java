import java.sql.*;
import java.util.logging.Logger;

public class CheckCols {
    private static final Logger LOGGER = Logger.getLogger(CheckCols.class.getName());

    public static void main(String[] args) {
        String url = "jdbc:postgresql://localhost:5432/flow_db";
        String user = System.getenv("DB_USER") != null ? System.getenv("DB_USER") : "postgres";
        String password = System.getenv("DB_PASSWORD") != null ? System.getenv("DB_PASSWORD") : "";

        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            ResultSet rs = stmt.executeQuery("SELECT id, column_name, order_index FROM board_columns WHERE project_id = 1 ORDER BY order_index ASC");
            while (rs.next()) {
                LOGGER.info("ID: " + rs.getInt("id") + " - " + rs.getString("column_name") + " (order=" + rs.getInt("order_index") + ")");
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
