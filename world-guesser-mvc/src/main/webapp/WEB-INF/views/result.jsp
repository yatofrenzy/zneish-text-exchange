<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%
    double guessLat = (double) request.getAttribute("guessLat");
    double guessLng = (double) request.getAttribute("guessLng");
    double actualLat = (double) request.getAttribute("actualLat");
    double actualLng = (double) request.getAttribute("actualLng");
    double distanceKm = (double) request.getAttribute("distanceKm");
    int score = (int) request.getAttribute("score");
    int totalScore = (int) request.getAttribute("totalScore");
    String locationName = (String) request.getAttribute("locationName");
    String contextPath = request.getContextPath();
%>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>World Guesser Result</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIINfQ/1tVtvQUzCwL5GZduQArPmb3r6Y5Q=" crossorigin="">
    <style>
        :root {
            --primary: #1ecbe1;
            --secondary: #7d6d92;
            --dark: #0f172a;
            --panel: rgba(15, 23, 42, 0.88);
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

        .wg-brand,
        .wg-navlinks a {
            color: var(--text);
            text-decoration: none;
        }

        .wg-brand {
            display: flex;
            align-items: center;
            gap: 0.75rem;
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
        .score-pill {
            border: 1px solid var(--line);
            border-radius: 999px;
            padding: 0.7rem 1rem;
            background: rgba(255, 255, 255, 0.07);
        }

        .score-pill {
            color: var(--primary);
            font-weight: 800;
        }

        .result-shell {
            display: grid;
            grid-template-columns: minmax(18rem, 25rem) minmax(0, 1fr);
            gap: 1rem;
            width: min(1180px, calc(100% - 2rem));
            margin: 1rem auto;
        }

        .result-card,
        .map-card {
            border: 1px solid var(--line);
            border-radius: 22px;
            background: var(--panel);
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
            padding: 1rem;
        }

        .eyebrow {
            color: var(--primary);
            font-size: 0.78rem;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        h1 {
            margin: 0.5rem 0 1rem;
            font-size: clamp(2rem, 6vw, 3.6rem);
            line-height: 0.96;
        }

        .metric {
            display: grid;
            gap: 0.2rem;
            margin-top: 0.8rem;
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.06);
        }

        .metric span {
            color: var(--muted);
            font-size: 0.9rem;
        }

        .metric strong {
            font-size: 1.4rem;
        }

        #resultMap {
            width: 100%;
            height: min(70vh, 42rem);
            min-height: 30rem;
            border-radius: 18px;
            overflow: hidden;
        }

        .play-btn {
            display: inline-flex;
            justify-content: center;
            width: 100%;
            margin-top: 1rem;
            border: 0;
            border-radius: 999px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: var(--dark);
            padding: 0.85rem 1rem;
            font-weight: 900;
            text-decoration: none;
            transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .play-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 16px 36px rgba(30, 203, 225, 0.28);
        }

        @media (max-width: 840px) {
            .result-shell {
                grid-template-columns: 1fr;
            }

            .wg-navbar {
                align-items: flex-start;
                flex-direction: column;
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
        <span class="score-pill">Total: <%= totalScore %></span>
    </div>
</nav>

<main class="result-shell">
    <section class="result-card">
        <span class="eyebrow">Round result</span>
        <h1><%= score %> points</h1>

        <div class="metric">
            <span>Actual location</span>
            <strong><%= locationName %></strong>
        </div>

        <div class="metric">
            <span>Your guess</span>
            <strong><%= String.format("%.4f", guessLat) %>, <%= String.format("%.4f", guessLng) %></strong>
        </div>

        <div class="metric">
            <span>Actual coordinates</span>
            <strong><%= String.format("%.4f", actualLat) %>, <%= String.format("%.4f", actualLng) %></strong>
        </div>

        <div class="metric">
            <span>Distance</span>
            <strong><%= String.format("%.2f", distanceKm) %> km</strong>
        </div>

        <a class="play-btn" href="<%= contextPath %>/world-guesser">Play Next Round</a>
    </section>

    <section class="map-card">
        <div id="resultMap"></div>
    </section>
</main>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
    const guessPoint = [<%= guessLat %>, <%= guessLng %>];
    const actualPoint = [<%= actualLat %>, <%= actualLng %>];

    const resultMap = L.map("resultMap").setView(actualPoint, 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(resultMap);

    const guessMarker = L.marker(guessPoint).addTo(resultMap).bindPopup("Your guess");
    const actualMarker = L.marker(actualPoint).addTo(resultMap).bindPopup("Actual: <%= locationName %>");
    const line = L.polyline([guessPoint, actualPoint], {
        color: "#1ecbe1",
        weight: 4,
        opacity: 0.85
    }).addTo(resultMap);

    resultMap.fitBounds(line.getBounds(), { padding: [40, 40] });
    actualMarker.openPopup();
</script>
</body>
</html>
