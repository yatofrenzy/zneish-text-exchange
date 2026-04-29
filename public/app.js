const socket = io();

const sharedText = document.querySelector("#sharedText");
const quickShare = document.querySelector("#quickShare");
const quickInput = document.querySelector("#quickInput");
const feed = document.querySelector("#feed");
const itemTemplate = document.querySelector("#itemTemplate");
const itemCount = document.querySelector("#itemCount");
const presence = document.querySelector("#presence");
const copyText = document.querySelector("#copyText");
const pasteText = document.querySelector("#pasteText");
const downloadText = document.querySelector("#downloadText");
const clearAll = document.querySelector("#clearAll");
const refreshRoom = document.querySelector("#refreshRoom");
const fileInput = document.querySelector("#fileInput");
const uploadButton = document.querySelector("#uploadButton");
const dropZone = document.querySelector("#dropZone");
const themeToggle = document.querySelector("#themeToggle");
const createRoom = document.querySelector("#createRoom");
const joinRoomForm = document.querySelector("#joinRoomForm");
const roomInput = document.querySelector("#roomInput");
const roomKeyLabel = document.querySelector("#roomKeyLabel");
const copyInvite = document.querySelector("#copyInvite");
const globalMode = document.querySelector("#globalMode");
const localMode = document.querySelector("#localMode");
const modeHelp = document.querySelector("#modeHelp");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const chatLog = document.querySelector("#chatLog");
const aiToggle = document.querySelector("#aiToggle");
const aiClose = document.querySelector("#aiClose");
const assistantDrawer = document.querySelector("#assistantDrawer");
const gamesToggle = document.querySelector("#gamesToggle");
const gamesClose = document.querySelector("#gamesClose");
const gamesDrawer = document.querySelector("#gamesDrawer");

let currentRoomKey = getInitialRoomKey();
let items = [];
let chat = [];
let typingTimer;
let remoteUpdate = false;

const savedTheme = localStorage.getItem("zneish-theme");
if (savedTheme === "dark") {
  document.documentElement.dataset.theme = "dark";
  themeToggle.checked = true;
}

joinRoom(currentRoomKey);
setupTextSharing();
setupRoomControls();
setupSharingTools();
setupUploads();
setupChat();
setupDrawers();
setupGames();

socket.on("connect", () => {
  presence.textContent = "Connected";
  joinRoom(currentRoomKey);
});

socket.on("disconnect", () => {
  presence.textContent = "Offline";
});

socket.on("presence:update", (count) => {
  presence.textContent = `${count} online`;
});

socket.on("state:init", (state) => {
  currentRoomKey = state.roomKey || currentRoomKey;
  roomKeyLabel.textContent = currentRoomKey;
  roomInput.value = currentRoomKey;
  localStorage.setItem("zneish-room", currentRoomKey);
  setRoomInUrl(currentRoomKey);

  remoteUpdate = true;
  sharedText.value = state.text || "";
  remoteUpdate = false;

  items = Array.isArray(state.items) ? state.items : [];
  chat = Array.isArray(state.chat) ? state.chat : [];
  renderFeed();
  renderChat();
});

socket.on("text:update", (text) => {
  remoteUpdate = true;
  sharedText.value = text || "";
  remoteUpdate = false;
});

socket.on("item:add", (item) => {
  items = [item, ...items.filter((oldItem) => oldItem.id !== item.id)].slice(0, 80);
  renderFeed();
});

socket.on("chat:add", (message) => {
  chat = [...chat, message].slice(-30);
  renderChat();
});

function setupTextSharing() {
  sharedText.addEventListener("input", () => {
    if (remoteUpdate) return;
    window.clearTimeout(typingTimer);
    typingTimer = window.setTimeout(() => {
      socket.emit("text:update", {
        roomKey: currentRoomKey,
        text: sharedText.value
      });
    }, 160);
  });
}

function setupRoomControls() {
  createRoom.addEventListener("click", async () => {
    const response = await fetch("/api/rooms", { method: "POST" });
    const data = await response.json();
    joinRoom(data.roomKey);
    toast(`Room ${data.roomKey} created.`);
  });

  joinRoomForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const roomKey = normalizeRoomKey(roomInput.value);
    joinRoom(roomKey);
  });

  copyInvite.addEventListener("click", async () => {
    await navigator.clipboard.writeText(roomUrl());
    toast("Room invite link copied.");
  });

  globalMode.addEventListener("click", () => setMode("global"));
  localMode.addEventListener("click", () => setMode("local"));
}

function setupSharingTools() {
  quickShare.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = quickInput.value.trim();
    if (!value) return;

    socket.emit("item:create", {
      roomKey: currentRoomKey,
      value
    });
    quickInput.value = "";
  });

  copyText.addEventListener("click", async () => {
    await navigator.clipboard.writeText(sharedText.value);
    toast("Shared text copied.");
  });

  pasteText.addEventListener("click", async () => {
    const text = await navigator.clipboard.readText();
    sharedText.value = text;
    socket.emit("text:update", {
      roomKey: currentRoomKey,
      text
    });
    toast("Clipboard pasted into room text.");
  });

  downloadText.addEventListener("click", () => {
    const blob = new Blob([sharedText.value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zneish-${currentRoomKey}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  });

  refreshRoom.addEventListener("click", () => joinRoom(currentRoomKey));

  clearAll.addEventListener("click", () => {
    if (confirm(`Clear text, feed, and AI chat in room ${currentRoomKey}?`)) {
      socket.emit("clear:all", { roomKey: currentRoomKey });
    }
  });

  themeToggle.addEventListener("change", () => {
    const theme = themeToggle.checked ? "dark" : "light";
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "";
    localStorage.setItem("zneish-theme", theme);
  });
}

function setupUploads() {
  uploadButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    uploadFiles(fileInput.files);
    fileInput.value = "";
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragging");
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
    uploadFiles(event.dataTransfer.files);
  });
}

function setupChat() {
  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.value = "";
    chatInput.disabled = true;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomKey: currentRoomKey,
          message
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "AI chat failed.");
      }
    } catch (error) {
      toast(error.message);
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  });
}

function setupDrawers() {
  aiToggle.addEventListener("click", () => {
    assistantDrawer.classList.toggle("open");
    assistantDrawer.setAttribute("aria-hidden", assistantDrawer.classList.contains("open") ? "false" : "true");
    gamesDrawer.classList.remove("open");
    gamesDrawer.setAttribute("aria-hidden", "true");
  });

  aiClose.addEventListener("click", () => {
    assistantDrawer.classList.remove("open");
    assistantDrawer.setAttribute("aria-hidden", "true");
  });

  gamesToggle.addEventListener("click", () => {
    gamesDrawer.classList.toggle("open");
    gamesDrawer.setAttribute("aria-hidden", gamesDrawer.classList.contains("open") ? "false" : "true");
    assistantDrawer.classList.remove("open");
    assistantDrawer.setAttribute("aria-hidden", "true");
  });

  gamesClose.addEventListener("click", () => {
    gamesDrawer.classList.remove("open");
    gamesDrawer.setAttribute("aria-hidden", "true");
  });
}

function joinRoom(roomKey) {
  currentRoomKey = normalizeRoomKey(roomKey);
  roomKeyLabel.textContent = currentRoomKey;
  roomInput.value = currentRoomKey;
  socket.emit("room:join", { roomKey: currentRoomKey });
}

function setMode(mode) {
  globalMode.classList.toggle("active", mode === "global");
  localMode.classList.toggle("active", mode === "local");
  modeHelp.textContent =
    mode === "global"
      ? "Global mode works after you deploy to Render. Anyone with the room link can join."
      : "Local Wi-Fi mode means you run this app on your computer and friends on the same Wi-Fi open your computer IP with this room key.";
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/rooms/${currentRoomKey}/upload`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }
      toast(`${file.name} uploaded to ${currentRoomKey}.`);
    } catch {
      toast(`Could not upload ${file.name}.`);
    }
  }
}

function renderFeed() {
  feed.replaceChildren();
  itemCount.textContent = items.length;

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "item-preview";
    empty.textContent = "Nothing shared in this room yet.";
    feed.append(empty);
    return;
  }

  for (const item of items) {
    const node = itemTemplate.content.cloneNode(true);
    const card = node.querySelector(".feed-item");
    const icon = node.querySelector(".item-icon");
    const title = node.querySelector(".item-title");
    const meta = node.querySelector(".item-meta");
    const preview = node.querySelector(".item-preview");
    const action = node.querySelector(".item-action");

    icon.textContent = iconFor(item.type);
    title.textContent = item.title || item.value || "Shared item";
    meta.textContent = `${labelFor(item.type)} - ${timeAgo(item.createdAt)}${item.size ? ` - ${formatBytes(item.size)}` : ""}`;

    if (item.type === "image") {
      const image = document.createElement("img");
      image.src = item.url;
      image.alt = item.title || "Shared image";
      preview.append(image);
      action.href = item.url;
      action.download = item.title || "";
    } else if (item.type === "file") {
      preview.textContent = item.mime || "Download shared file";
      action.href = item.url;
      action.download = item.title || "";
    } else if (item.type === "link") {
      preview.textContent = item.value;
      action.href = item.value;
    } else {
      preview.textContent = item.value;
      action.remove();
    }

    card.dataset.type = item.type;
    feed.append(node);
  }
}

function renderChat() {
  chatLog.replaceChildren();
  if (!chat.length) {
    const empty = document.createElement("div");
    empty.className = "chat-message";
    empty.innerHTML = "<strong>Zneish AI</strong><p>Ask me anything. Add OPENROUTER_API_KEY in your environment to enable this.</p>";
    chatLog.append(empty);
    return;
  }

  for (const message of chat) {
    const node = document.createElement("div");
    node.className = "chat-message";
    const name = message.role === "assistant" ? "Zneish AI" : "You";
    node.innerHTML = `<strong>${escapeHtml(name)}</strong><p>${escapeHtml(message.content)}</p>`;
    chatLog.append(node);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function getInitialRoomKey() {
  const params = new URLSearchParams(window.location.search);
  return normalizeRoomKey(params.get("room") || localStorage.getItem("zneish-room") || "PUBLIC");
}

function setRoomInUrl(roomKey) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomKey);
  window.history.replaceState({}, "", url);
}

function roomUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("room", currentRoomKey);
  return url.toString();
}

function normalizeRoomKey(value) {
  return String(value || "PUBLIC").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PUBLIC";
}

function iconFor(type) {
  return {
    image: "IMG",
    file: "FILE",
    link: "URL",
    note: "TXT"
  }[type] || "TXT";
}

function labelFor(type) {
  return {
    image: "Photo",
    file: "File",
    link: "Link",
    note: "Note"
  }[type] || "Item";
}

function timeAgo(dateString) {
  const then = new Date(dateString).getTime();
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const sizeIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** sizeIndex;
  return `${size.toFixed(sizeIndex ? 1 : 0)} ${units[sizeIndex]}`;
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

function toast(message) {
  const oldToast = document.querySelector(".toast");
  oldToast?.remove();

  const note = document.createElement("div");
  note.className = "toast";
  note.textContent = message;
  document.body.append(note);
  window.setTimeout(() => note.remove(), 2400);
}

function setupGames() {
  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const gameName = document.querySelector("#gameName");
  const gameScore = document.querySelector("#gameScore");
  const gameHelp = document.querySelector("#gameHelp");
  const startGame = document.querySelector("#startGame");
  const murderBox = document.querySelector("#murderBox");
  const murderQuestion = document.querySelector("#murderQuestion");
  const murderChoices = document.querySelector("#murderChoices");
  let activeGame = "snake";
  let timer = null;
  let keys = {};
  let state = {};

  const descriptions = {
    snake: ["Snake", "Use arrow keys or WASD. Avoid walls and your tail."],
    tetris: ["Tetris", "Use left/right to move, up to rotate, down to drop faster."],
    flappy: ["Flappy", "Press Space or click Start to flap through the gates."],
    murder: ["Murder Guess", "Ask clue questions and guess the hidden suspect."]
  };

  document.querySelectorAll("[data-game]").forEach((button) => {
    button.addEventListener("click", () => {
      activeGame = button.dataset.game;
      document.querySelectorAll("[data-game]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      stopGame();
      gameName.textContent = descriptions[activeGame][0];
      gameHelp.textContent = descriptions[activeGame][1];
      gameScore.textContent = "Score: 0";
      murderBox.hidden = activeGame !== "murder";
      drawBlank(ctx, canvas);
      if (activeGame === "murder") startMurder();
    });
  });

  startGame.addEventListener("click", () => {
    stopGame();
    if (activeGame === "snake") startSnake();
    if (activeGame === "tetris") startTetris();
    if (activeGame === "flappy") startFlappy();
    if (activeGame === "murder") startMurder();
  });

  window.addEventListener("keydown", (event) => {
    keys[event.key.toLowerCase()] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys[event.key.toLowerCase()] = false;
  });

  drawBlank(ctx, canvas);

  function startSnake() {
    state = {
      snake: [{ x: 8, y: 8 }],
      dir: { x: 1, y: 0 },
      food: { x: 14, y: 11 },
      score: 0
    };
    timer = window.setInterval(updateSnake, 115);
  }

  function updateSnake() {
    if (keys.arrowup || keys.w) state.dir = { x: 0, y: -1 };
    if (keys.arrowdown || keys.s) state.dir = { x: 0, y: 1 };
    if (keys.arrowleft || keys.a) state.dir = { x: -1, y: 0 };
    if (keys.arrowright || keys.d) state.dir = { x: 1, y: 0 };

    const head = {
      x: state.snake[0].x + state.dir.x,
      y: state.snake[0].y + state.dir.y
    };

    const hit = head.x < 0 || head.y < 0 || head.x >= 20 || head.y >= 20 || state.snake.some((part) => part.x === head.x && part.y === head.y);
    if (hit) return gameOver("Snake over");

    state.snake.unshift(head);
    if (head.x === state.food.x && head.y === state.food.y) {
      state.score += 10;
      state.food = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
    } else {
      state.snake.pop();
    }

    clearCanvas();
    drawCell(state.food.x, state.food.y, "#ff6565");
    state.snake.forEach((part, index) => drawCell(part.x, part.y, index ? "#56d0af" : "#ffffff"));
    gameScore.textContent = `Score: ${state.score}`;
  }

  function startFlappy() {
    state = {
      bird: { x: 70, y: 170, velocity: 0 },
      pipes: [{ x: 360, gap: 150 }],
      score: 0
    };
    timer = window.setInterval(updateFlappy, 26);
  }

  function updateFlappy() {
    if (keys[" "] || keys.arrowup || keys.w) {
      state.bird.velocity = -5.5;
      keys[" "] = false;
      keys.arrowup = false;
      keys.w = false;
    }

    state.bird.velocity += 0.35;
    state.bird.y += state.bird.velocity;
    state.pipes.forEach((pipe) => (pipe.x -= 2.4));

    const last = state.pipes[state.pipes.length - 1];
    if (last.x < 170) state.pipes.push({ x: 380, gap: 80 + Math.random() * 170 });
    state.pipes = state.pipes.filter((pipe) => pipe.x > -60);

    clearCanvas();
    ctx.fillStyle = "#56d0af";
    ctx.beginPath();
    ctx.arc(state.bird.x, state.bird.y, 12, 0, Math.PI * 2);
    ctx.fill();

    for (const pipe of state.pipes) {
      ctx.fillStyle = "#ff6565";
      ctx.fillRect(pipe.x, 0, 44, pipe.gap - 58);
      ctx.fillRect(pipe.x, pipe.gap + 58, 44, 360);
      const hitX = state.bird.x + 12 > pipe.x && state.bird.x - 12 < pipe.x + 44;
      const hitY = state.bird.y - 12 < pipe.gap - 58 || state.bird.y + 12 > pipe.gap + 58;
      if (hitX && hitY) return gameOver("Flappy over");
      if (Math.abs(pipe.x - state.bird.x) < 1.3) state.score += 1;
    }

    if (state.bird.y > 360 || state.bird.y < 0) return gameOver("Flappy over");
    gameScore.textContent = `Score: ${state.score}`;
  }

  function startTetris() {
    state = {
      grid: Array.from({ length: 18 }, () => Array(10).fill(0)),
      piece: newPiece(),
      score: 0,
      tick: 0
    };
    timer = window.setInterval(updateTetris, 80);
  }

  function updateTetris() {
    if (keys.arrowleft || keys.a) {
      movePiece(-1, 0);
      keys.arrowleft = false;
      keys.a = false;
    }
    if (keys.arrowright || keys.d) {
      movePiece(1, 0);
      keys.arrowright = false;
      keys.d = false;
    }
    if (keys.arrowup || keys.w) {
      rotatePiece();
      keys.arrowup = false;
      keys.w = false;
    }

    state.tick += keys.arrowdown || keys.s ? 6 : 1;
    if (state.tick >= 8) {
      state.tick = 0;
      if (!movePiece(0, 1)) lockPiece();
    }

    clearCanvas();
    drawTetrisGrid();
    gameScore.textContent = `Score: ${state.score}`;
  }

  function newPiece() {
    const shapes = [
      [[1, 1, 1, 1]],
      [[1, 1], [1, 1]],
      [[0, 1, 0], [1, 1, 1]],
      [[1, 0, 0], [1, 1, 1]],
      [[0, 0, 1], [1, 1, 1]]
    ];
    return { x: 3, y: 0, shape: shapes[Math.floor(Math.random() * shapes.length)] };
  }

  function movePiece(dx, dy) {
    const next = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy };
    if (collides(next)) return false;
    state.piece = next;
    return true;
  }

  function rotatePiece() {
    const shape = state.piece.shape[0].map((_, index) => state.piece.shape.map((row) => row[index]).reverse());
    const next = { ...state.piece, shape };
    if (!collides(next)) state.piece = next;
  }

  function collides(piece) {
    return piece.shape.some((row, y) => row.some((cell, x) => cell && (piece.x + x < 0 || piece.x + x >= 10 || piece.y + y >= 18 || state.grid[piece.y + y]?.[piece.x + x])));
  }

  function lockPiece() {
    state.piece.shape.forEach((row, y) => row.forEach((cell, x) => {
      if (cell && state.grid[state.piece.y + y]) state.grid[state.piece.y + y][state.piece.x + x] = 1;
    }));
    state.grid = state.grid.filter((row) => {
      if (row.every(Boolean)) {
        state.score += 100;
        return false;
      }
      return true;
    });
    while (state.grid.length < 18) state.grid.unshift(Array(10).fill(0));
    state.piece = newPiece();
    if (collides(state.piece)) gameOver("Tetris over");
  }

  function drawTetrisGrid() {
    const size = 20;
    const offsetX = 80;
    state.grid.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) drawRect(offsetX + x * size, y * size, size - 1, size - 1, "#56d0af");
    }));
    state.piece.shape.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) drawRect(offsetX + (state.piece.x + x) * size, (state.piece.y + y) * size, size - 1, size - 1, "#ff6565");
    }));
  }

  function startMurder() {
    stopGame();
    murderBox.hidden = false;
    const suspects = [
      { name: "Asha", clues: ["wears glasses", "was in the kitchen", "likes chess"] },
      { name: "Milan", clues: ["wears a hat", "was near the garden", "plays guitar"] },
      { name: "Riya", clues: ["has a red scarf", "was in the library", "likes puzzles"] },
      { name: "Dev", clues: ["wears boots", "was near the garage", "collects coins"] }
    ];
    const secret = suspects[Math.floor(Math.random() * suspects.length)];
    state = { suspects, secret, questions: 0 };
    clearCanvas();
    ctx.fillStyle = "#ffffff";
    ctx.font = "22px sans-serif";
    ctx.fillText("Find the suspect", 86, 160);
    murderQuestion.textContent = `Clue ${state.questions + 1}: The suspect ${secret.clues[state.questions]}. Who is it?`;
    murderChoices.replaceChildren();
    suspects.forEach((suspect) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = suspect.name;
      button.addEventListener("click", () => {
        if (suspect.name === secret.name) {
          gameScore.textContent = `Solved: ${secret.name}`;
          murderQuestion.textContent = "Correct. You solved the room mystery.";
        } else {
          state.questions = Math.min(state.questions + 1, secret.clues.length - 1);
          gameScore.textContent = "Wrong guess";
          murderQuestion.textContent = `New clue: The suspect ${secret.clues[state.questions]}. Try again.`;
        }
      });
      murderChoices.append(button);
    });
  }

  function drawCell(x, y, color) {
    drawRect(x * 18, y * 18, 17, 17, color);
  }

  function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  function clearCanvas() {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawBlank() {
    clearCanvas();
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.fillText("Choose a game and press Start", 52, 180);
  }

  function gameOver(label) {
    stopGame();
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px sans-serif";
    ctx.fillText(label, 112, 180);
  }

  function stopGame() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }
}
