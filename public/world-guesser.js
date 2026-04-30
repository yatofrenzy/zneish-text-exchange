const locations = [
  {
    name: "Eiffel Tower",
    latitude: 48.8584,
    longitude: 2.2945,
    image: "https://upload.wikimedia.org/wikipedia/commons/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg"
  },
  {
    name: "Statue of Liberty",
    latitude: 40.6892,
    longitude: -74.0445,
    image: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Statue_of_Liberty_7.jpg"
  },
  {
    name: "Taj Mahal",
    latitude: 27.1751,
    longitude: 78.0421,
    image: "https://upload.wikimedia.org/wikipedia/commons/d/da/Taj-Mahal.jpg"
  },
  {
    name: "Mount Everest",
    latitude: 27.9881,
    longitude: 86.925,
    image: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Everest_kalapatthar.jpg"
  },
  {
    name: "Great Wall of China",
    latitude: 40.4319,
    longitude: 116.5704,
    image: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Mutianyu_Great_Wall_2014_07.JPG"
  }
];

const locationImage = document.querySelector("#locationImage");
const submitGuess = document.querySelector("#submitGuess");
const newRound = document.querySelector("#newRound");
const guessHint = document.querySelector("#guessHint");
const resultPanel = document.querySelector("#resultPanel");
const actualName = document.querySelector("#actualName");
const distanceText = document.querySelector("#distanceText");
const pointsText = document.querySelector("#pointsText");
const roundScore = document.querySelector("#roundScore");

let currentLocation;
let guessMarker;
let actualMarker;
let resultLine;
let guessPoint;
let totalScore = Number(localStorage.getItem("world-guesser-score") || 0);

const map = L.map("worldMap", { worldCopyJump: true }).setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

map.on("click", (event) => {
  guessPoint = event.latlng;
  submitGuess.disabled = false;
  guessHint.textContent = `Guess placed at ${guessPoint.lat.toFixed(4)}, ${guessPoint.lng.toFixed(4)}.`;

  if (guessMarker) {
    guessMarker.setLatLng(guessPoint);
  } else {
    guessMarker = L.marker(guessPoint).addTo(map).bindPopup("Your guess");
  }
});

submitGuess.addEventListener("click", () => {
  if (!guessPoint) return;

  const actualPoint = L.latLng(currentLocation.latitude, currentLocation.longitude);
  const distanceKm = haversineKm(guessPoint.lat, guessPoint.lng, actualPoint.lat, actualPoint.lng);
  const points = scoreFor(distanceKm);
  totalScore += points;
  localStorage.setItem("world-guesser-score", String(totalScore));

  actualMarker?.remove();
  resultLine?.remove();
  actualMarker = L.marker(actualPoint).addTo(map).bindPopup(`Actual: ${currentLocation.name}`);
  resultLine = L.polyline([guessPoint, actualPoint], { color: "#1ecbe1", weight: 4 }).addTo(map);
  map.fitBounds(resultLine.getBounds(), { padding: [40, 40] });

  actualName.textContent = currentLocation.name;
  distanceText.textContent = `${distanceKm.toFixed(2)} km`;
  pointsText.textContent = `${points} points`;
  roundScore.textContent = `Score ${totalScore}`;
  resultPanel.hidden = false;
  submitGuess.disabled = true;
});

newRound.addEventListener("click", startRound);

function startRound() {
  currentLocation = locations[Math.floor(Math.random() * locations.length)];
  locationImage.src = currentLocation.image;
  guessPoint = null;
  submitGuess.disabled = true;
  resultPanel.hidden = true;
  guessHint.textContent = "Click the map to place your guess.";
  roundScore.textContent = `Score ${totalScore}`;
  guessMarker?.remove();
  actualMarker?.remove();
  resultLine?.remove();
  guessMarker = null;
  actualMarker = null;
  resultLine = null;
  map.setView([20, 0], 2);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const radius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreFor(distanceKm) {
  if (distanceKm < 100) return 100;
  if (distanceKm < 500) return 80;
  if (distanceKm < 1000) return 50;
  return 10;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

startRound();
