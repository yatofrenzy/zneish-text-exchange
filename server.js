const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const { Server } = require("socket.io");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const pptxgen = require("pptxgenjs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
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

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
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

app.get("/api/rooms/:roomKey/chat-sessions", (req, res) => {
  const roomKey = normalizeRoomKey(req.params.roomKey);
  const room = getRoom(roomKey);
  res.json({ sessions: chatSessionList(room) });
});

app.post("/api/rooms/:roomKey/chat-sessions", (req, res) => {
  const roomKey = normalizeRoomKey(req.params.roomKey);
  const room = getRoom(roomKey);
  const session = createChatSession(room, req.body?.title);
  res.status(201).json(publicChatSession(session));
});

app.get("/api/rooms/:roomKey/chat-sessions/:sessionId", (req, res) => {
  const roomKey = normalizeRoomKey(req.params.roomKey);
  const room = getRoom(roomKey);
  const session = getChatSession(room, req.params.sessionId);
  res.json(publicChatSession(session));
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

app.post("/api/chat", chatUpload.array("files", 10), async (req, res) => {
  const roomKey = normalizeRoomKey(req.body?.roomKey);
  const sessionId = normalizeSessionId(req.body?.sessionId);
  const message = String(req.body?.message || "").trim().slice(0, 2000);
  const userName = cleanName(req.body?.userName);
  const room = getRoom(roomKey);
  const session = getChatSession(room, sessionId);
  const files = await enrichUploadedFiles(Array.isArray(req.files) ? req.files.slice(0, 10) : []);

  if (!message && !files.length) {
    return res.status(400).json({ message: "Ask something or attach a file first." });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(400).json({
      message: "AI chat is not configured. Add OPENROUTER_API_KEY locally or in Render."
    });
  }

  const userMessage = {
    id: createId(),
    role: "user",
    name: userName,
    content: message,
    attachments: files.map(fileSummary),
    createdAt: new Date().toISOString()
  };
  rememberChatMessage(room, session, userMessage);
  io.to(roomKey).emit("chat:add", { sessionId: session.id, message: userMessage });
  io.to(roomKey).emit("chat:sessions", chatSessionList(room));

  try {
    const answer = cleanAssistantText(await askOpenRouter(session.messages, files, message, userName));
    const assistantMessage = {
      id: createId(),
      role: "assistant",
      content: answer,
      createdAt: new Date().toISOString()
    };
    rememberChatMessage(room, session, assistantMessage);
    io.to(roomKey).emit("chat:add", { sessionId: session.id, message: assistantMessage });
    io.to(roomKey).emit("chat:sessions", chatSessionList(room));
    res.json({ answer, sessionId: session.id });
  } catch (error) {
    const failMessage = {
      id: createId(),
      role: "assistant",
      content: "AI chat failed. Check your OpenRouter key and Render environment variables.",
      createdAt: new Date().toISOString()
    };
    rememberChatMessage(room, session, failMessage);
    io.to(roomKey).emit("chat:add", { sessionId: session.id, message: failMessage });
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/export/docx", async (req, res) => {
  const room = getRoom(normalizeRoomKey(req.body?.roomKey));
  const session = getChatSession(room, normalizeSessionId(req.body?.sessionId));
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: session.title || "Zneish AI Chat", bold: true, size: 32 })]
          }),
          ...session.messages.flatMap((message) => [
            new Paragraph({
              children: [new TextRun({ text: message.role === "assistant" ? "Zneish AI" : message.name || "You", bold: true })]
            }),
            ...String(message.content || "").split("\n").map((line) => new Paragraph(line || " "))
          ])
        ]
      }
    ]
  });
  const buffer = await Packer.toBuffer(doc);
  sendBuffer(res, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "zneish-ai-chat.docx");
});

app.post("/api/export/pptx", async (req, res) => {
  const room = getRoom(normalizeRoomKey(req.body?.roomKey));
  const session = getChatSession(room, normalizeSessionId(req.body?.sessionId));
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Zneish AI";

  const titleSlide = pptx.addSlide();
  titleSlide.addText(session.title || "Zneish AI Chat", { x: 0.7, y: 0.8, w: 11.8, h: 0.7, fontSize: 30, bold: true });
  titleSlide.addText(`Room chat export - ${new Date().toLocaleString()}`, { x: 0.7, y: 1.7, w: 11.8, h: 0.4, fontSize: 14, color: "666666" });

  const assistantMessages = session.messages.filter((message) => message.role === "assistant");
  for (const message of assistantMessages.slice(-8)) {
    const slide = pptx.addSlide();
    slide.addText("Zneish AI", { x: 0.6, y: 0.4, w: 12, h: 0.4, fontSize: 20, bold: true });
    slide.addText(String(message.content || "").slice(0, 1200), {
      x: 0.6,
      y: 1,
      w: 12,
      h: 5.4,
      fontSize: 16,
      fit: "shrink",
      breakLine: false
    });
  }

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  sendBuffer(res, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation", "zneish-ai-chat.pptx");
});

io.on("connection", (socket) => {
  socket.on("room:join", (payload) => {
    const roomKey = normalizeRoomKey(payload?.roomKey);
    const name = cleanName(payload?.name);
    joinRoom(socket, roomKey, name);
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
      const room = getRoom(socket.data.roomKey);
      room.users.delete(socket.id);
      emitPresence(socket.data.roomKey);
    }
  });
});

function joinRoom(socket, roomKey, name) {
  if (socket.data.roomKey) {
    const oldRoom = getRoom(socket.data.roomKey);
    oldRoom.users.delete(socket.id);
    socket.leave(socket.data.roomKey);
    emitPresence(socket.data.roomKey);
  }

  const room = getRoom(roomKey);
  socket.data.roomKey = roomKey;
  socket.data.name = name;
  room.users.set(socket.id, {
    id: socket.id,
    name,
    joinedAt: new Date().toISOString()
  });
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
      chatSessions: new Map(),
      users: new Map(),
      createdAt: new Date().toISOString()
    });
    createChatSession(rooms.get(key), "New chat");
  }
  return rooms.get(key);
}

function publicRoomState(roomKey, room) {
  return {
    roomKey,
    text: room.text,
    items: room.items,
    chat: room.chat,
    chatSessions: chatSessionList(room),
    participants: participantsFor(room),
    createdAt: room.createdAt
  };
}

function createChatSession(room, title = "New chat") {
  const session = {
    id: createId(),
    title: String(title || "New chat").trim().slice(0, 60) || "New chat",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  room.chatSessions.set(session.id, session);
  return session;
}

function getChatSession(room, sessionId) {
  const existingId = sessionId && room.chatSessions.has(sessionId) ? sessionId : "";
  if (existingId) return room.chatSessions.get(existingId);
  if (!room.chatSessions.size) return createChatSession(room, "New chat");
  return Array.from(room.chatSessions.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
}

function rememberChatMessage(room, session, message) {
  session.messages.push(message);
  session.messages = session.messages.slice(-60);
  session.updatedAt = new Date().toISOString();
  if (message.role === "user" && session.title === "New chat" && message.content) {
    session.title = String(message.content).replace(/\s+/g, " ").slice(0, 42);
  }
  room.chat = session.messages;
}

function chatSessionList(room) {
  return Array.from(room.chatSessions.values())
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((session) => ({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      count: session.messages.length
    }));
}

function publicChatSession(session) {
  return {
    id: session.id,
    title: session.title,
    messages: session.messages,
    updatedAt: session.updatedAt
  };
}

function emitPresence(roomKey) {
  const room = getRoom(roomKey);
  io.to(roomKey).emit("presence:update", participantsFor(room));
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

async function askOpenRouter(chat, files = [], latestMessage = "", userName = "Guest") {
  const latestContent = buildLatestChatContent(latestMessage, files, userName);
  const history = chat.slice(-12, -1).map((message) => ({
    role: message.role,
    content: message.content
  }));

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Zneish Text Exchange"
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content: "You are the helpful Zneish room assistant. Keep answers clear, useful, and beginner friendly. Use extracted PDF text, uploaded text-file contents, and images when they are provided. If a PDF has no extracted text, say it may be scanned/protected and ask for page images or selectable text."
        },
        ...history,
        {
          role: "user",
          content: latestContent
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed with ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "I could not make an answer.";
}

function buildLatestChatContent(message, files, userName) {
  const parts = [];
  const intro = `${userName} asks: ${message || "Please review the attached files."}`;
  parts.push({ type: "text", text: intro });

  for (const file of files.slice(0, 10)) {
    if (file.mimetype.startsWith("image/")) {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
        }
      });
    } else {
      parts.push({
        type: "text",
        text: describeUploadedFile(file)
      });
    }
  }

  return parts;
}

async function enrichUploadedFiles(files) {
  const enriched = [];
  for (const file of files) {
    const next = { ...file };
    if (isPdfFile(file)) {
      let parser;
      try {
        parser = new PDFParse({ data: file.buffer });
        const data = await parser.getText();
        next.extractedText = String(data.text || "").replace(/\s+\n/g, "\n").trim().slice(0, 18000);
      } catch {
        next.extractedText = "";
        next.extractError = "The PDF text could not be extracted. It may be scanned or protected.";
      } finally {
        await parser?.destroy?.();
      }
    }
    enriched.push(next);
  }
  return enriched;
}

function describeUploadedFile(file) {
  const base = `Attached file: ${file.originalname} (${file.mimetype || "unknown type"}, ${file.size} bytes).`;
  if (isPdfFile(file)) {
    if (file.extractedText) {
      return `${base}\nExtracted PDF text:\n${file.extractedText}`;
    }
    return `${base}\n${file.extractError || "No readable text was found in this PDF. If it is a scanned PDF, upload screenshots/images of the pages."}`;
  }
  if (file.mimetype.startsWith("text/") || file.originalname.match(/\.(txt|md|csv|json|js|css|html)$/i)) {
    return `${base}\nFile text preview:\n${file.buffer.toString("utf8").slice(0, 12000)}`;
  }
  return `${base}\nThis file type is attached for context, but this version can only directly read images, PDFs with extractable text, and plain text-like files.`;
}

function isPdfFile(file) {
  return file.mimetype === "application/pdf" || file.originalname.match(/\.pdf$/i);
}

function cleanAssistantText(value) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/^--+\s*/gm, "")
    .replace(/--+/g, "-")
    .replace(/```[a-zA-Z0-9_-]*\n?/g, "")
    .replace(/```/g, "")
    .trim();
}

function normalizeSessionId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function sendBuffer(res, buffer, contentType, filename) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

function fileSummary(file) {
  return {
    name: file.originalname,
    mime: file.mimetype,
    size: file.size
  };
}

function participantsFor(room) {
  return Array.from(room.users.values()).map((user) => ({
    id: user.id,
    name: user.name,
    joinedAt: user.joinedAt
  }));
}

function cleanName(value) {
  return String(value || "Guest").trim().replace(/\s+/g, " ").slice(0, 32) || "Guest";
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
