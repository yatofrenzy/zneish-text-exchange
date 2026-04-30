package com.zneish.worldguesser.servlet;

import com.zneish.worldguesser.dao.LocationDAO;
import com.zneish.worldguesser.model.Location;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.sql.SQLException;

@WebServlet("/world-guesser")
public class GameServlet extends HttpServlet {
    private LocationDAO locationDAO;

    @Override
    public void init() {
        locationDAO = new LocationDAO();
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        try {
            Location location = locationDAO.getRandomLocation();

            if (location == null) {
                request.setAttribute("errorMessage", "No locations were found. Please run the SQL seed file first.");
            } else {
                request.setAttribute("location", location);
            }

            HttpSession session = request.getSession();
            Integer totalScore = (Integer) session.getAttribute("worldGuesserScore");
            request.setAttribute("totalScore", totalScore == null ? 0 : totalScore);
            request.getRequestDispatcher("/WEB-INF/views/game.jsp").forward(request, response);
        } catch (SQLException exception) {
            throw new ServletException("Could not load a random location.", exception);
        }
    }
}
