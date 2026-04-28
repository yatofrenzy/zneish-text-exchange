const socket = io();

const sharedText = document.querySelector("#sharedText");
const quickShare = document.querySelector("#quickShare");
const quickInput = document.querySelector("#quickInput");
const feed = document.querySelector("#feed");
const itemTemplate = document.querySelector("#itemTemplate");
const itemCount = document.querySelector("#itemCount");
const presence = document.querySelector("#presence");
const copyText = document.querySelector("#copyText");
const downloadText = document.querySelector("#downloadText");
const clearAll = document.querySelector("#clearAll");
const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const themeToggle = document.querySelector("#themeToggle");

let items = [];
let typingTimer;
let remoteUpdate = false;

const savedTheme = localStorage.getItem("zneish-theme");
if (savedTheme === "dark") {
  document.documentElement.dataset.theme = "dark";
  themeToggle.checked = true;
}

socket.on("connect", () => {
  presence.textContent = "Connected";
});

socket.on("disconnect", () => {
  presence.textContent = "Offline";
});

socket.on("presence:update", (count) => {
  presence.textContent = `${count} online`;
});

socket.on("state:init", (state) => {
  remoteUpdate = true;
  sharedText.value = state.text || "";
  remoteUpdate = false;
  items = Array.isArray(state.items) ? state.items : [];
  renderFeed();
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

sharedText.addEventListener("input", () => {
  if (remoteUpdate) return;
  window.clearTimeout(typingTimer);
  typingTimer = window.setTimeout(() => {
    socket.emit("text:update", sharedText.value);
  }, 160);
});

quickShare.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = quickInput.value.trim();
  if (!value) return;

  socket.emit("item:create", { value });
  quickInput.value = "";
});

copyText.addEventListener("click", async () => {
  await navigator.clipboard.writeText(sharedText.value);
  toast("Shared text copied.");
});

downloadText.addEventListener("click", () => {
  const blob = new Blob([sharedText.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "zneish-shared-text.txt";
  link.click();
  URL.revokeObjectURL(url);
});

clearAll.addEventListener("click", () => {
  if (confirm("Clear text and live feed for everyone?")) {
    socket.emit("clear:all");
  }
});

themeToggle.addEventListener("change", () => {
  const theme = themeToggle.checked ? "dark" : "light";
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "";
  localStorage.setItem("zneish-theme", theme);
});

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

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }
      toast(`${file.name} uploaded.`);
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
    empty.textContent = "Nothing shared yet. Add a note, link, photo, or file.";
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
    meta.textContent = `${labelFor(item.type)} • ${timeAgo(item.createdAt)}${item.size ? ` • ${formatBytes(item.size)}` : ""}`;

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

function toast(message) {
  const oldToast = document.querySelector(".toast");
  oldToast?.remove();

  const note = document.createElement("div");
  note.className = "toast";
  note.textContent = message;
  document.body.append(note);
  window.setTimeout(() => note.remove(), 2200);
}
