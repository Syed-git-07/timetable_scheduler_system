import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

public class UpdateDB {
    public static void main(String[] args) {
        String url = "jdbc:sqlite:timetable.db";
        try (Connection conn = DriverManager.getConnection(url);
             Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE subject ADD COLUMN periods_per_week INTEGER DEFAULT 0");
            System.out.println("Column periods_per_week added successfully.");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
