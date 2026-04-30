package com.zneish.worldguesser.servlet;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;

@WebServlet("/world-guesser/submit")
public class SubmitGuessServlet extends HttpServlet {
    private static final double EARTH_RADIUS_KM = 6371.0;

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        double guessLat = parseDouble(request.getParameter("guessLat"));
        double guessLng = parseDouble(request.getParameter("guessLng"));
        double actualLat = parseDouble(request.getParameter("actualLat"));
        double actualLng = parseDouble(request.getParameter("actualLng"));
        String locationName = request.getParameter("locationName");

        double distanceKm = calculateDistanceKm(guessLat, guessLng, actualLat, actualLng);
        int score = calculateScore(distanceKm);

        HttpSession session = request.getSession();
        Integer currentScore = (Integer) session.getAttribute("worldGuesserScore");
        int totalScore = (currentScore == null ? 0 : currentScore) + score;
        session.setAttribute("worldGuesserScore", totalScore);

        request.setAttribute("guessLat", guessLat);
        request.setAttribute("guessLng", guessLng);
        request.setAttribute("actualLat", actualLat);
        request.setAttribute("actualLng", actualLng);
        request.setAttribute("locationName", locationName);
        request.setAttribute("distanceKm", distanceKm);
        request.setAttribute("score", score);
        request.setAttribute("totalScore", totalScore);
        request.getRequestDispatcher("/WEB-INF/views/result.jsp").forward(request, response);
    }

    private double calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);

        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
            + Math.cos(Math.toRadians(lat1))
            * Math.cos(Math.toRadians(lat2))
            * Math.sin(lonDistance / 2)
            * Math.sin(lonDistance / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    private int calculateScore(double distanceKm) {
        if (distanceKm < 100) {
            return 100;
        }
        if (distanceKm < 500) {
            return 80;
        }
        if (distanceKm < 1000) {
            return 50;
        }
        return 10;
    }

    private double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("A required coordinate was missing.");
        }
        return Double.parseDouble(value);
    }
}
