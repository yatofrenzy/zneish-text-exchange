package com.zneish.worldguesser.dao;

import com.zneish.worldguesser.model.Location;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class LocationDAO {
    private final String jdbcUrl;
    private final String jdbcUser;
    private final String jdbcPassword;

    public LocationDAO() {
        this(
            valueOrDefault(System.getenv("DB_URL"), "jdbc:mysql://localhost:3306/world_guesser?useSSL=false&serverTimezone=UTC"),
            valueOrDefault(System.getenv("DB_USER"), "root"),
            valueOrDefault(System.getenv("DB_PASSWORD"), "")
        );
    }

    public LocationDAO(String jdbcUrl, String jdbcUser, String jdbcPassword) {
        this.jdbcUrl = jdbcUrl;
        this.jdbcUser = jdbcUser;
        this.jdbcPassword = jdbcPassword;
    }

    public Location getRandomLocation() throws SQLException {
        String sql = "SELECT id, name, latitude, longitude, image_path FROM locations ORDER BY RAND() LIMIT 1";

        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {

            if (resultSet.next()) {
                return mapLocation(resultSet);
            }
        }

        return null;
    }

    public Location getLocationById(int id) throws SQLException {
        String sql = "SELECT id, name, latitude, longitude, image_path FROM locations WHERE id = ?";

        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setInt(1, id);

            try (ResultSet resultSet = statement.executeQuery()) {
                if (resultSet.next()) {
                    return mapLocation(resultSet);
                }
            }
        }

        return null;
    }

    private Connection getConnection() throws SQLException {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException exception) {
            throw new SQLException("MySQL JDBC driver was not found. Add mysql-connector-j to your project.", exception);
        }

        return DriverManager.getConnection(jdbcUrl, jdbcUser, jdbcPassword);
    }

    private Location mapLocation(ResultSet resultSet) throws SQLException {
        return new Location(
            resultSet.getInt("id"),
            resultSet.getString("name"),
            resultSet.getDouble("latitude"),
            resultSet.getDouble("longitude"),
            resultSet.getString("image_path")
        );
    }

    private static String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
