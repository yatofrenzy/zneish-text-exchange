<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ page import="com.zneish.worldguesser.model.Location" %>
<%
    Location location = (Location) request.getAttribute("location");
    Integer totalScore = (Integer) request.getAttribute("totalScore");
    String contextPath = request.getContextPath();
%>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>World Guesser</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIINfQ/1tVtvQUzCwL5GZduQArPmb3r6Y5Q=" crossorigin="">
    <style>
        :root {
            --primary: #1ecbe1;
            --secondary: #7d6d92;
            --dark: #0f172a;
            --panel: rgba(15, 23, 42, 0.86);
            --text: #f8fafc;
            --muted: #a9b4c5;
            --line: rgba(255, 255, 255, 0.14);
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            background:
                radial-gradient(circle at 72% 18%, rgba(30, 203, 225, 0.22), transparent 26rem),
                linear-gradient(135deg, #111827, var(--dark));
            color: var(--text);
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .wg-navbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 1rem clamp(1rem, 4vw, 3rem);
            border-bottom: 1px solid var(--line);
            background: rgba(15, 23, 42, 0.84);
            backdrop-filter: blur(16px);
        }

        .wg-brand {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: var(--text);
            text-decoration: none;
            font-weight: 900;
        }

        .wg-pin {
            display: grid;
            width: 2.5rem;
            height: 2.5rem;
            place-items: center;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: var(--dark);
        }

        .wg-navlinks {
            display: flex;
            align-items: center;
            gap: 0.7rem;
            flex-wrap: wrap;
        }

        .wg-navlinks a,
        .score-pill,
        .submit-btn {
            border: 1px solid var(--line);
            border-radius: 999px;
            color: var(--text);
            text-decoration: none;
            padding: 0.7rem 1rem;
            background: rgba(255, 255, 255, 0.07);
        }

        .score-pill {
            color: var(--primary);
            font-weight: 800;
        }

        .game-shell {
            display: grid;
            gap: 1rem;
            width: min(1180px, calc(100% - 2rem));
            margin: 1rem auto;
        }

        .hero-card,
        .map-card {
            border: 1px solid var(--line);
            border-radius: 22px;
            background: var(--panel);
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
            overflow: hidden;
        }

        .hero-card {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(18rem, 28rem);
            gap: 1rem;
            padding: 1rem;
        }

        .hero-copy {
            display: grid;
            align-content: center;
            padding: clamp(1rem, 4vw, 2rem);
        }

        .eyebrow {
            color: var(--primary);
            font-size: 0.78rem;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        h1 {
            margin: 0.5rem 0;
            font-size: clamp(2rem, 6vw, 4.3rem);
            line-height: 0.96;
        }

        .hero-copy p {
            max-width: 38rem;
            color: var(--muted);
            line-height: 1.6;
        }

        .location-image {
            width: 100%;
            min-height: 22rem;
            height: 100%;
            border-radius: 18px;
            object-fit: cover;
            box-shadow: 0 18px 44px rgba(0, 0, 0, 0.24);
        }

        .map-card {
            padding: 1rem;
        }

        #map {
            width: 100%;
            height: min(58vh, 36rem);
            min-height: 24rem;
            border-radius: 18px;
            overflow: hidden;
        }

        .map-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            margin-top: 1rem;
            flex-wrap: wrap;
        }

        .hint {
            color: var(--muted);
        }

        .submit-btn {
            border: 0;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: var(--dark);
            cursor: pointer;
            font-weight: 900;
            transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 16px 36px rgba(30, 203, 225, 0.28);
        }

        .submit-btn:disabled {
            cursor: not-allowed;
            opacity: 0.55;
            transform: none;
            box-shadow: none;
        }

        .error {
            border: 1px solid rgba(255, 120, 120, 0.45);
            border-radius: 18px;
            background: rgba(255, 120, 120, 0.14);
            padding: 1rem;
        }

        @media (max-width: 780px) {
            .wg-navbar,
            .hero-card {
                grid-template-columns: 1fr;
            }

            .wg-navbar {
                align-items: flex-start;
                flex-direction: column;
            }

            .location-image {
                min-height: 16rem;
            }
        }
    </style>
</head>
<body>
<nav class="wg-navbar">
    <a class="wg-brand" href="<%= contextPath %>/world-guesser">
        <span class="wg-pin">WG</span>
        <span>World Guesser</span>
    </a>
    <div class="wg-navlinks">
        <a href="<%= contextPath %>/world-guesser">New Round</a>
        <a href="<%= contextPath %>/">Home</a>
        <span class="score-pill">Score: <%= totalScore == null ? 0 : totalScore %></span>
    </div>
</nav>

<main class="game-shell">
    <% if (request.getAttribute("errorMessage") != null) { %>
        <div class="error"><%= request.getAttribute("errorMessage") %></div>
    <% } else { %>
        <section class="hero-card">
            <div class="hero-copy">
                <span class="eyebrow">Singleplayer round</span>
                <h1>Guess the world location</h1>
                <p>Use the photo clue, click your guessed point on the world map, then submit your guess to score points.</p>
            </div>
            <img class="location-image" src="<%= location.getImagePath() %>" alt="Mystery location image">
        </section>

        <section class="map-card">
            <form action="<%= contextPath %>/world-guesser/submit" method="post" id="guessForm">
                <input type="hidden" name="guessLat" id="guessLat">
                <input type="hidden" name="guessLng" id="guessLng">
                <input type="hidden" name="actualLat" value="<%= location.getLatitude() %>">
                <input type="hidden" name="actualLng" value="<%= location.getLongitude() %>">
                <input type="hidden" name="locationName" value="<%= location.getName() %>">

                <div id="map"></div>

                <div class="map-actions">
                    <span class="hint" id="hintText">Click anywhere on the map to place your guess.</span>
                    <button class="submit-btn" id="submitBtn" type="submit" disabled>Submit Guess</button>
                </div>
            </form>
        </section>
    <% } %>
</main>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
    const map = L.map("map", {
        worldCopyJump: true
    }).setView([20, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    let guessMarker = null;
    const guessLatInput = document.getElementById("guessLat");
    const guessLngInput = document.getElementById("guessLng");
    const submitBtn = document.getElementById("submitBtn");
    const hintText = document.getElementById("hintText");

    map.on("click", (event) => {
        const lat = event.latlng.lat.toFixed(6);
        const lng = event.latlng.lng.toFixed(6);
        guessLatInput.value = lat;
        guessLngInput.value = lng;
        submitBtn.disabled = false;
        hintText.textContent = "Guess placed at " + lat + ", " + lng + ".";

        if (guessMarker) {
            guessMarker.setLatLng(event.latlng);
        } else {
            guessMarker = L.marker(event.latlng).addTo(map).bindPopup("Your guess").openPopup();
        }
    });
</script>
</body>
</html>
