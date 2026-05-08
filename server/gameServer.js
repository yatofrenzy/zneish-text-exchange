const {
  createPrivateRoom,
  getRoom,
  getRoomByPlayer,
  joinPrivateRoom,
  leaveRoom,
  roomSummary,
  snapshotRoom,
  startRoom
} = require("./roomManager");
const { quickMatch } = require("./matchMaker");
const { startGameLoop } = require("./gameLoop");

function setupGameServer(io) {
  // The game loop runs once for the whole server. Each room is updated inside it.
  startGameLoop(io);

  io.on("connection", (socket) => {
    socket.on("game:quickMatch", (payload = {}, reply) => {
      handleJoin(io, socket, reply, () => quickMatch(socket.id, payload.name));
    });

    socket.on("game:createPrivate", (payload = {}, reply) => {
      handleJoin(io, socket, reply, () => createPrivateRoom(socket.id, payload.name, payload.roomKey));
    });

    socket.on("game:joinPrivate", (payload = {}, reply) => {
      handleJoin(io, socket, reply, () => joinPrivateRoom(socket.id, payload.name, payload.roomKey));
    });

    socket.on("game:start", (_payload = {}, reply) => {
      const room = getRoomByPlayer(socket.id);
      if (!room) return reply?.({ ok: false, message: "Join a room first." });
      if (room.type === "private" && room.ownerSocketId !== socket.id) {
        return reply?.({ ok: false, message: "Only the room creator can start this match." });
      }
      if (room.players.size < 1) {
        return reply?.({ ok: false, message: "Need at least one player to start." });
      }
      startRoom(room);
      io.to(room.id).emit("game:room", roomSummary(room));
      reply?.({ ok: true, room: roomSummary(room) });
    });

    socket.on("game:input", (payload = {}) => {
      const room = getRoomByPlayer(socket.id);
      if (!room || room.status !== "playing") return;
      const player = room.players.get(socket.id);
      if (!player) return;
      player.input = sanitizeInput(payload);
    });

    socket.on("game:leave", (_payload = {}, reply) => {
      leaveGameRoom(io, socket);
      reply?.({ ok: true });
    });

    socket.on("game:ping", () => {
      socket.emit("game:pong");
    });

    socket.on("disconnect", () => {
      leaveGameRoom(io, socket);
    });
  });
}

function handleJoin(io, socket, reply, createOrJoinRoom) {
  try {
    leaveGameRoom(io, socket);
    const room = createOrJoinRoom();
    socket.join(room.id);
    socket.data.shooterRoomId = room.id;
    socket.emit("game:joined", {
      selfId: socket.id,
      room: roomSummary(room),
      snapshot: snapshotRoom(room)
    });
    socket.to(room.id).emit("game:room", roomSummary(room));
    reply?.({ ok: true, selfId: socket.id, room: roomSummary(room) });
  } catch (error) {
    reply?.({ ok: false, message: error.message || "Could not join game." });
  }
}

function leaveGameRoom(io, socket) {
  const roomId = socket.data.shooterRoomId;
  if (!roomId) return;

  const room = leaveRoom(socket.id);
  socket.leave(roomId);
  socket.data.shooterRoomId = "";

  if (room) {
    io.to(room.id).emit("game:room", roomSummary(room));
  }
}

function sanitizeInput(payload) {
  // Clients only send intent. The server still decides speed, bullets, damage, and kills.
  return {
    up: Boolean(payload.up),
    down: Boolean(payload.down),
    left: Boolean(payload.left),
    right: Boolean(payload.right),
    shooting: Boolean(payload.shooting),
    aimAngle: clampAngle(payload.aimAngle)
  };
}

function clampAngle(value) {
  const angle = Number(value);
  if (!Number.isFinite(angle)) return 0;
  return Math.max(-Math.PI * 2, Math.min(Math.PI * 2, angle));
}

module.exports = {
  setupGameServer
};
