const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const publicDir = path.join(__dirname, "public");
const uploadRoot = path.join(publicDir, "uploads");
const rooms = new Map();

fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const roomKey = normalizeRoomKey(req.params.roomKey);
    const roomDir = path.join(uploadRoot, roomKey);
    fs.mkdirSync(roomDir, { recursive: true });
    cb(null, roomDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${stamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

app.use(express.static(publicDir));
app.use(express.json({ limit: "1mb" }));

app.post("/api/rooms", (_req, res) => {
  const roomKey = createUniqueRoomKey();
  getRoom(roomKey);
  res.status(201).json({ roomKey });
});

app.get("/api/rooms/:roomKey", (req, res) => {
  const roomKey = normalizeRoomKey(req.params.roomKey);
  const room = getRoom(roomKey);
  res.json(publicRoomState(roomKey, room));
});

app.post("/api/rooms/:roomKey/upload", upload.single("file"), (req, res) => {
  const roomKey = normalizeRoomKey(req.params.roomKey);
  const room = getRoom(roomKey);

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const item = {
    id: createId(),
    type: req.file.mimetype.startsWith("image/") ? "image" : "file",
    title: req.file.originalname,
    url: `/uploads/${roomKey}/${req.file.filename}`,
    size: req.file.size,
    mime: req.file.mimetype,
    createdAt: new Date().toISOString()
  };

  rememberItem(room, item);
  io.to(roomKey).emit("item:add", item);
  res.status(201).json(item);
});

app.post("/api/chat", async (req, res) => {
  const roomKey = normalizeRoomKey(req.body?.roomKey);
  const message = String(req.body?.message || "").trim().slice(0, 2000);
  const room = getRoom(roomKey);

  if (!message) {
    return res.status(400).json({ message: "Ask something first." });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(400).json({
      message: "AI chat is not configured. Add OPENROUTER_API_KEY locally or in Render."
    });
  }

  const userMessage = {
    id: createId(),
    role: "user",
    content: message,
    createdAt: new Date().toISOString()
  };
  room.chat.push(userMessage);
  room.chat = room.chat.slice(-30);
  io.to(roomKey).emit("chat:add", userMessage);

  try {
    const answer = await askOpenRouter(room.chat);
    const assistantMessage = {
      id: createId(),
      role: "assistant",
      content: answer,
      createdAt: new Date().toISOString()
    };
    room.chat.push(assistantMessage);
    room.chat = room.chat.slice(-30);
    io.to(roomKey).emit("chat:add", assistantMessage);
    res.json({ answer });
  } catch (error) {
    const failMessage = {
      id: createId(),
      role: "assistant",
      content: "AI chat failed. Check your OpenRouter key and Render environment variables.",
      createdAt: new Date().toISOString()
    };
    room.chat.push(failMessage);
    io.to(roomKey).emit("chat:add", failMessage);
    res.status(500).json({ message: error.message });
  }
});

io.on("connection", (socket) => {
  socket.on("room:join", (payload) => {
    const roomKey = normalizeRoomKey(payload?.roomKey);
    joinRoom(socket, roomKey);
  });

  socket.on("text:update", (payload) => {
    const roomKey = normalizeRoomKey(payload?.roomKey || socket.data.roomKey);
    const room = getRoom(roomKey);
    room.text = String(payload?.text || "").slice(0, 20000);
    socket.to(roomKey).emit("text:update", room.text);
  });

  socket.on("item:create", (payload) => {
    const roomKey = normalizeRoomKey(payload?.roomKey || socket.data.roomKey);
    const room = getRoom(roomKey);
    const item = cleanItem(payload);
    if (!item) return;

    rememberItem(room, item);
    io.to(roomKey).emit("item:add", item);
  });

  socket.on("clear:all", (payload) => {
    const roomKey = normalizeRoomKey(payload?.roomKey || socket.data.roomKey);
    const room = getRoom(roomKey);
    room.text = "";
    room.items = [];
    room.chat = [];
    io.to(roomKey).emit("state:init", publicRoomState(roomKey, room));
  });

  socket.on("disconnect", () => {
    if (socket.data.roomKey) {
      emitPresence(socket.data.roomKey);
    }
  });
});

function joinRoom(socket, roomKey) {
  if (socket.data.roomKey) {
    socket.leave(socket.data.roomKey);
    emitPresence(socket.data.roomKey);
  }

  const room = getRoom(roomKey);
  socket.data.roomKey = roomKey;
  socket.join(roomKey);
  socket.emit("state:init", publicRoomState(roomKey, room));
  emitPresence(roomKey);
}

function getRoom(roomKey) {
  const key = normalizeRoomKey(roomKey);
  if (!rooms.has(key)) {
    rooms.set(key, {
      text: "",
      items: [],
      chat: [],
      createdAt: new Date().toISOString()
    });
  }
  return rooms.get(key);
}

function publicRoomState(roomKey, room) {
  return {
    roomKey,
    text: room.text,
    items: room.items,
    chat: room.chat,
    createdAt: room.createdAt
  };
}

function emitPresence(roomKey) {
  const size = io.sockets.adapter.rooms.get(roomKey)?.size || 0;
  io.to(roomKey).emit("presence:update", size);
}

function cleanItem(payload) {
  const value = String(payload?.value || "").trim().slice(0, 2000);
  if (!value) return null;

  const type = isProbablyUrl(value) ? "link" : "note";
  return {
    id: createId(),
    type,
    title: type === "link" ? value : "Shared note",
    value,
    createdAt: new Date().toISOString()
  };
}

async function askOpenRouter(chat) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Zneish Text Exchange"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are the helpful Zneish room assistant. Keep answers clear, useful, and beginner friendly."
        },
        ...chat.slice(-12).map((message) => ({
          role: message.role,
          content: message.content
        }))
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed with ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "I could not make an answer.";
}

function normalizeRoomKey(value) {
  const clean = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return clean || "PUBLIC";
}

function createUniqueRoomKey() {
  let key = "";
  do {
    key = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(key));
  return key;
}

function isProbablyUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function rememberItem(room, item) {
  room.items.unshift(item);
  room.items = room.items.slice(0, 80);
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

server.listen(PORT, () => {
  console.log(`Zneish Text Exchange is running on http://localhost:${PORT}`);
});
