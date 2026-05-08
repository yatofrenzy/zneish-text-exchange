export class ArenaUI {
  constructor() {
    this.menuPanel = document.querySelector("#menuPanel");
    this.lobbyPanel = document.querySelector("#lobbyPanel");
    this.gamePanel = document.querySelector("#gamePanel");
    this.playerName = document.querySelector("#playerName");
    this.roomKeyInput = document.querySelector("#roomKeyInput");
    this.menuMessage = document.querySelector("#menuMessage");
    this.lobbyMessage = document.querySelector("#lobbyMessage");
    this.lobbyTitle = document.querySelector("#lobbyTitle");
    this.roomKeyLabel = document.querySelector("#roomKeyLabel");
    this.copyRoomKey = document.querySelector("#copyRoomKey");
    this.lobbyPlayers = document.querySelector("#lobbyPlayers");
    this.startMatch = document.querySelector("#startMatch");
    this.connectionStatus = document.querySelector("#connectionStatus");
    this.scoreboardRows = document.querySelector("#scoreboardRows");
    this.killFeed = document.querySelector("#killFeed");
    this.healthFill = document.querySelector("#healthFill");
    this.matchClock = document.querySelector("#matchClock");
    this.ping = document.querySelector("#ping");
    this.winnerScreen = document.querySelector("#winnerScreen");
    this.winnerTitle = document.querySelector("#winnerTitle");

    this.playerName.value = localStorage.getItem("zneish-arena-name") || "";
  }

  name() {
    const value = this.playerName.value.trim().slice(0, 18) || "Player";
    localStorage.setItem("zneish-arena-name", value);
    return value;
  }

  showMenu(message = "") {
    this.menuPanel.classList.remove("hidden");
    this.lobbyPanel.classList.add("hidden");
    this.gamePanel.classList.add("hidden");
    this.setMenuMessage(message);
  }

  showLobby(room, selfId) {
    this.menuPanel.classList.add("hidden");
    this.lobbyPanel.classList.remove("hidden");
    this.gamePanel.classList.add("hidden");
    this.renderLobby(room, selfId);
  }

  showGame() {
    this.menuPanel.classList.add("hidden");
    this.lobbyPanel.classList.add("hidden");
    this.gamePanel.classList.remove("hidden");
  }

  renderLobby(room, selfId) {
    if (!room) return;
    this.lobbyTitle.textContent = room.type === "private" ? "Private room" : "Public quick match";
    this.roomKeyLabel.textContent = room.roomKey;
    this.startMatch.hidden = room.type === "private" && room.ownerSocketId !== selfId;
    this.startMatch.textContent = room.type === "private" ? "Start Match" : "Public match starts automatically";
    this.startMatch.disabled = room.type === "public";

    this.lobbyPlayers.replaceChildren();
    for (const player of room.players || []) {
      const row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = `<strong>${escapeHtml(player.name)}</strong><span>${player.id === room.ownerSocketId ? "Creator" : "Ready"}</span>`;
      this.lobbyPlayers.append(row);
    }
  }

  renderHud(snapshot, selfId, pingMs) {
    const self = snapshot?.players?.find((player) => player.id === selfId);
    const health = self?.health ?? 100;
    this.healthFill.style.width = `${Math.max(0, health)}%`;
    this.ping.textContent = `Ping ${Math.round(pingMs || 0)}ms`;
    this.matchClock.textContent = formatClock(snapshot?.timeLeftMs ?? 0);

    this.scoreboardRows.replaceChildren();
    const players = [...(snapshot?.players || [])].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    for (const player of players) {
      const row = document.createElement("div");
      row.className = "score-row";
      row.innerHTML = `<strong>${escapeHtml(player.name)}</strong><span>${player.kills} / ${player.deaths}</span>`;
      this.scoreboardRows.append(row);
    }

    this.killFeed.replaceChildren();
    for (const item of snapshot?.killFeed || []) {
      const row = document.createElement("div");
      row.textContent = `${item.attacker} eliminated ${item.victim}`;
      this.killFeed.append(row);
    }

    const winner = snapshot?.winner;
    this.winnerScreen.classList.toggle("hidden", snapshot?.status !== "ended");
    if (winner) {
      this.winnerTitle.textContent = `${winner.name} wins with ${winner.kills} kills`;
    } else {
      this.winnerTitle.textContent = "Match ended";
    }
  }

  setConnection(value) {
    this.connectionStatus.textContent = value;
  }

  setMenuMessage(value) {
    this.menuMessage.textContent = value;
  }

  setLobbyMessage(value) {
    this.lobbyMessage.textContent = value;
  }
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
