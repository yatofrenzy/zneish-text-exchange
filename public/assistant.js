const socket = io();

const params = new URLSearchParams(window.location.search);
const roomKey = normalizeRoomKey(params.get("room") || localStorage.getItem("zneish-room") || "PUBLIC");
const userName = (params.get("name") || localStorage.getItem("zneish-name") || "Guest").trim().slice(0, 32) || "Guest";

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

let chat = [];
let selectedFiles = [];

assistantRoom.textContent = `Room ${roomKey}`;
const roomUrl = `/?room=${encodeURIComponent(roomKey)}`;
backToRoom.href = roomUrl;
homeLink.href = roomUrl;

socket.on("connect", () => {
  socket.emit("room:join", {
    roomKey,
    name: userName
  });
});

socket.on("state:init", (state) => {
  chat = Array.isArray(state.chat) ? state.chat : [];
  renderChat();
});

socket.on("chat:add", (message) => {
  chat = [...chat, message].slice(-30);
  renderChat();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message && !selectedFiles.length) return;

  const formData = new FormData();
  formData.append("roomKey", roomKey);
  formData.append("userName", userName);
  formData.append("message", message);
  selectedFiles.slice(0, 10).forEach((file) => formData.append("files", file));

  chatInput.value = "";
  chatInput.disabled = true;

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
  } catch (error) {
    toast(error.message);
  } finally {
    chatInput.disabled = false;
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

function renderChat() {
  chatLog.replaceChildren();
  if (!chat.length) {
    const empty = document.createElement("div");
    empty.className = "chat-message";
    empty.innerHTML = "<strong>Zneish AI</strong><p>Ask me something, or attach photos, PDFs, and files.</p>";
    chatLog.append(empty);
    return;
  }

  for (const message of chat) {
    const node = document.createElement("div");
    node.className = "chat-message";
    const name = message.role === "assistant" ? "Zneish AI" : escapeHtml(message.name || "You");
    const files = Array.isArray(message.attachments) && message.attachments.length
      ? `<small>${message.attachments.map((file) => escapeHtml(file.name)).join(", ")}</small>`
      : "";
    node.innerHTML = `<strong>${name}</strong><p>${escapeHtml(message.content || "")}</p>${files}`;
    chatLog.append(node);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderFiles() {
  fileHint.textContent = `${selectedFiles.length} / 10 files selected`;
  fileList.replaceChildren();
  selectedFiles.forEach((file) => {
    const node = document.createElement("div");
    node.className = "file-chip";
    node.textContent = `${file.name} (${formatBytes(file.size)})`;
    fileList.append(node);
  });
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
