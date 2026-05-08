import { InputController } from "./input.js";
import { GameNetwork } from "./networking.js";
import { Renderer } from "./renderer.js";
import { ArenaUI } from "./ui.js";

const ui = new ArenaUI();
const network = new GameNetwork();
const canvas = document.querySelector("#gameCanvas");
const renderer = new Renderer(canvas);
const input = new InputController(canvas);

let latestSnapshot = null;
let currentRoom = null;
let lastInputSentAt = 0;

// Menu buttons call the server. The server decides which room the player enters.
document.querySelector("#quickMatch").addEventListener("click", async () => {
  ui.setMenuMessage("Finding a match...");
  const response = await network.quickMatch(ui.name());
  handleJoinResponse(response, "quick");
});

document.querySelector("#createPrivate").addEventListener("click", async () => {
  ui.setMenuMessage("Creating private room...");
  const customKey = ui.roomKeyInput.value.trim();
  const response = await network.createPrivate(ui.name(), customKey);
  handleJoinResponse(response, "private");
});

document.querySelector("#joinPrivateForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  ui.setMenuMessage("Joining private room...");
  const response = await network.joinPrivate(ui.name(), ui.roomKeyInput.value);
  handleJoinResponse(response, "private");
});

document.querySelector("#startMatch").addEventListener("click", async () => {
  const response = await network.startMatch();
  ui.setLobbyMessage(response.ok ? "Starting match..." : response.message);
});

document.querySelector("#leaveLobby").addEventListener("click", async () => {
  await network.leave();
  localStorage.removeItem("zneish-arena-last-room");
  ui.showMenu("Left the room.");
});

document.querySelector("#backToLobby").addEventListener("click", () => {
  if (currentRoom) ui.showLobby(currentRoom, network.selfId);
});

document.querySelector("#copyRoomKey").addEventListener("click", async () => {
  const key = currentRoom?.roomKey || "";
  if (!key) return;
  await navigator.clipboard?.writeText(key);
  ui.setLobbyMessage("Room key copied.");
});

network.on("connection", (status) => ui.setConnection(status));
network.on("ping", (ping) => {
  if (latestSnapshot) ui.renderHud(latestSnapshot, network.selfId, ping);
});
network.on("joined", ({ room, snapshot }) => {
  currentRoom = room;
  latestSnapshot = snapshot;
  rememberRoom(room);
  if (room.status === "playing") ui.showGame();
  else ui.showLobby(room, network.selfId);
});
network.on("room", (room) => {
  currentRoom = room;
  rememberRoom(room);
  if (room.status === "playing") ui.showGame();
  else ui.showLobby(room, network.selfId);
});
network.on("snapshot", (snapshot) => {
  latestSnapshot = snapshot;
  currentRoom = snapshot;
  if (snapshot.status === "playing" || snapshot.status === "ended") {
    ui.showGame();
  }
  ui.renderHud(snapshot, network.selfId, network.pingMs);
});

requestAnimationFrame(loop);
attemptRejoin();

function loop(now) {
  if (latestSnapshot) {
    renderer.draw(latestSnapshot, network.selfId);
    const self = latestSnapshot.players?.find((player) => player.id === network.selfId);
    // Inputs are sent often, but never include damage, health, or kills.
    if (latestSnapshot.status === "playing" && now - lastInputSentAt > 33) {
      network.sendInput(input.state(renderer.camera, self));
      lastInputSentAt = now;
    }
  }
  requestAnimationFrame(loop);
}

function handleJoinResponse(response, roomKind) {
  if (!response.ok) {
    ui.setMenuMessage(response.message || "Could not join.");
    return;
  }
  if (response.room) {
    localStorage.setItem("zneish-arena-last-room", JSON.stringify({
      type: roomKind,
      roomKey: response.room.roomKey
    }));
  }
}

async function attemptRejoin() {
  const saved = localStorage.getItem("zneish-arena-last-room");
  if (!saved || !ui.playerName.value.trim()) return;

  try {
    const room = JSON.parse(saved);
    if (room.type === "private" && room.roomKey) {
      ui.setMenuMessage("Rejoining last private room...");
      const response = await network.joinPrivate(ui.name(), room.roomKey);
      if (!response.ok) ui.setMenuMessage("");
    }
  } catch {
    localStorage.removeItem("zneish-arena-last-room");
  }
}

function rememberRoom(room) {
  if (!room) return;
  if (room.type === "private") {
    localStorage.setItem("zneish-arena-last-room", JSON.stringify({
      type: "private",
      roomKey: room.roomKey
    }));
  }
}
