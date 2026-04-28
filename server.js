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
const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(publicDir, "uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const memory = {
  text: "",
  items: []
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
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

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const item = {
    id: cryptoId(),
    type: req.file.mimetype.startsWith("image/") ? "image" : "file",
    title: req.file.originalname,
    url: `/uploads/${req.file.filename}`,
    size: req.file.size,
    mime: req.file.mimetype,
    createdAt: new Date().toISOString()
  };

  rememberItem(item);
  io.emit("item:add", item);
  res.status(201).json(item);
});

io.on("connection", (socket) => {
  socket.emit("state:init", memory);
  io.emit("presence:update", io.engine.clientsCount);

  socket.on("text:update", (text) => {
    memory.text = String(text || "").slice(0, 20000);
    socket.broadcast.emit("text:update", memory.text);
  });

  socket.on("item:create", (payload) => {
    const item = cleanItem(payload);
    if (!item) return;

    rememberItem(item);
    io.emit("item:add", item);
  });

  socket.on("clear:all", () => {
    memory.text = "";
    memory.items = [];
    io.emit("state:init", memory);
  });

  socket.on("disconnect", () => {
    io.emit("presence:update", io.engine.clientsCount);
  });
});

function cleanItem(payload) {
  const value = String(payload?.value || "").trim();
  if (!value) return null;

  const type = isProbablyUrl(value) ? "link" : "note";
  return {
    id: cryptoId(),
    type,
    title: type === "link" ? value : "Shared note",
    value,
    createdAt: new Date().toISOString()
  };
}

function isProbablyUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function rememberItem(item) {
  memory.items.unshift(item);
  memory.items = memory.items.slice(0, 80);
}

function cryptoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

server.listen(PORT, () => {
  console.log(`Zneish Text Exchange is running on http://localhost:${PORT}`);
});
