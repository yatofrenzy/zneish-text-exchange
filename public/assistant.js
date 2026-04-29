const socket = io();

const params = new URLSearchParams(window.location.search);
const roomKey = normalizeRoomKey(params.get("room") || localStorage.getItem("zneish-room") || "PUBLIC");
const userName = (params.get("name") || localStorage.getItem("zneish-name") || "Guest").trim().slice(0, 32) || "Guest";
const sessionStorageKey = `zneish-session-${roomKey}`;

const chatLog = document.querySelector("#chatLog");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const aiFiles = document.querySelector("#aiFiles");
const fileHint = document.querySelector("#fileHint");
const fileList = document.querySelector("#fileList");
const clearFiles = document.querySelector("#clearFiles");
const assistantRoom = document.querySelector("#assistantRoom");
const backToRoom = document.querySelector("#backToRoom");
const homeLink = document.querySelector("#homeLink");
const gamesLink = document.querySelector("#gamesLink");
const aiStatus = document.querySelector("#aiStatus");
const newChat = document.querySelector("#newChat");
const sessionList = document.querySelector("#sessionList");
const chatTitle = document.querySelector("#chatTitle");
const exportDocx = document.querySelector("#exportDocx");
const exportPptx = document.querySelector("#exportPptx");

let chat = [];
let sessions = [];
let selectedFiles = [];
let currentSessionId = params.get("session") || localStorage.getItem(sessionStorageKey) || "";
let thinking = false;

assistantRoom.textContent = `Room ${roomKey}`;
const roomUrl = `/?room=${encodeURIComponent(roomKey)}`;
const gamesUrl = `/games.html?room=${encodeURIComponent(roomKey)}&name=${encodeURIComponent(userName)}`;
backToRoom.href = roomUrl;
homeLink.href = roomUrl;
gamesLink.href = gamesUrl;

socket.on("connect", () => {
  socket.emit("room:join", { roomKey, name: userName });
});

socket.on("state:init", async (state) => {
  sessions = Array.isArray(state.chatSessions) ? state.chatSessions : [];
  renderSessions();
  await ensureSession();
});

socket.on("chat:sessions", (serverSessions) => {
  sessions = Array.isArray(serverSessions) ? serverSessions : [];
  renderSessions();
});

socket.on("chat:add", (payload) => {
  if (payload?.sessionId !== currentSessionId) return;
  chat = [...chat, payload.message].slice(-60);
  renderChat();
});

newChat.addEventListener("click", async () => {
  const response = await fetch(`/api/rooms/${roomKey}/chat-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "New chat" })
  });
  const session = await response.json();
  await loadSession(session.id);
  await loadSessions();
  chatInput.focus();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message && !selectedFiles.length) return;
  await ensureSession();

  const formData = new FormData();
  formData.append("roomKey", roomKey);
  formData.append("sessionId", currentSessionId);
  formData.append("userName", userName);
  formData.append("message", message);
  selectedFiles.slice(0, 10).forEach((file) => formData.append("files", file));

  chatInput.value = "";
  chatInput.disabled = true;
  thinking = true;
  aiStatus.textContent = "Thinking";
  renderChat();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "AI chat failed.");
    }
    selectedFiles = [];
    aiFiles.value = "";
    renderFiles();
    await loadSessions();
  } catch (error) {
    toast(error.message);
  } finally {
    thinking = false;
    chatInput.disabled = false;
    aiStatus.textContent = "Ready";
    renderChat();
    chatInput.focus();
  }
});

aiFiles.addEventListener("change", () => {
  selectedFiles = Array.from(aiFiles.files || []).slice(0, 10);
  if ((aiFiles.files || []).length > 10) toast("Only the first 10 files were selected.");
  renderFiles();
});

clearFiles.addEventListener("click", () => {
  selectedFiles = [];
  aiFiles.value = "";
  renderFiles();
});

exportDocx.addEventListener("click", () => exportChat("docx"));
exportPptx.addEventListener("click", () => exportChat("pptx"));

async function ensureSession() {
  if (currentSessionId) {
    await loadSession(currentSessionId);
    return;
  }
  await loadSessions();
  if (sessions[0]) {
    await loadSession(sessions[0].id);
    return;
  }
  newChat.click();
}

async function loadSessions() {
  const response = await fetch(`/api/rooms/${roomKey}/chat-sessions`);
  const data = await response.json();
  sessions = Array.isArray(data.sessions) ? data.sessions : [];
  renderSessions();
}

async function loadSession(sessionId) {
  const response = await fetch(`/api/rooms/${roomKey}/chat-sessions/${sessionId}`);
  const session = await response.json();
  currentSessionId = session.id;
  localStorage.setItem(sessionStorageKey, currentSessionId);
  setSessionInUrl(currentSessionId);
  chat = Array.isArray(session.messages) ? session.messages : [];
  chatTitle.textContent = session.title === "New chat" ? "What are you working on?" : session.title;
  renderChat();
  renderSessions();
}

function renderChat() {
  chatLog.replaceChildren();
  if (!chat.length && !thinking) {
    const empty = document.createElement("div");
    empty.className = "welcome-prompt";
    empty.innerHTML = "<h2>What are you working on?</h2><p>Ask questions, upload PDFs or images, write code, or create files from the answer.</p>";
    chatLog.append(empty);
    return;
  }

  for (const message of chat) {
    const node = document.createElement("div");
    node.className = `chat-message ${message.role === "assistant" ? "assistant" : "user"}`;
    const name = message.role === "assistant" ? "Zneish AI" : escapeHtml(message.name || "You");
    const files = Array.isArray(message.attachments) && message.attachments.length
      ? `<small>${message.attachments.map((file) => escapeHtml(file.name)).join(", ")}</small>`
      : "";
    node.innerHTML = `<strong>${name}</strong><p>${formatAssistantText(message.content || "")}</p>${files}`;
    chatLog.append(node);
  }

  if (thinking) {
    const node = document.createElement("div");
    node.className = "chat-message assistant thinking";
    node.innerHTML = "<strong>Zneish AI</strong><p><span></span><span></span><span></span></p>";
    chatLog.append(node);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderSessions() {
  sessionList.replaceChildren();
  if (!sessions.length) {
    const empty = document.createElement("span");
    empty.className = "session-empty";
    empty.textContent = "No chats yet";
    sessionList.append(empty);
    return;
  }

  for (const session of sessions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = session.id === currentSessionId ? "active" : "";
    button.textContent = session.title || "New chat";
    button.addEventListener("click", () => loadSession(session.id));
    sessionList.append(button);
  }
}

function renderFiles() {
  fileHint.textContent = `${selectedFiles.length} / 10 files`;
  fileList.replaceChildren();
  selectedFiles.forEach((file) => {
    const node = document.createElement("div");
    node.className = "file-chip";
    node.textContent = `${file.name} (${formatBytes(file.size)})`;
    fileList.append(node);
  });
}

async function exportChat(type) {
  await ensureSession();
  const response = await fetch(`/api/export/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomKey, sessionId: currentSessionId })
  });
  if (!response.ok) {
    toast(`Could not create ${type.toUpperCase()} file.`);
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = type === "docx" ? "zneish-ai-chat.docx" : "zneish-ai-chat.pptx";
  link.click();
  URL.revokeObjectURL(url);
}

function setSessionInUrl(sessionId) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomKey);
  url.searchParams.set("name", userName);
  url.searchParams.set("session", sessionId);
  window.history.replaceState({}, "", url);
}

function normalizeRoomKey(value) {
  return String(value || "PUBLIC").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PUBLIC";
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const sizeIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** sizeIndex;
  return `${size.toFixed(sizeIndex ? 1 : 0)} ${units[sizeIndex]}`;
}

function formatAssistantText(value) {
  return escapeHtml(String(value).replace(/\*\*/g, "").replace(/^--+\s*/gm, "").replace(/--+/g, "-")).replace(/\n/g, "<br>");
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
  window.setTimeout(() => note.remove(), 2600);
}
