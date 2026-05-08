const WORLD_WIDTH = 2200;
const WORLD_HEIGHT = 1400;
const MAX_PLAYERS = 8;
const PUBLIC_MIN_PLAYERS = 2;

const rooms = new Map();

function createPrivateRoom(ownerSocketId, ownerName, customKey = "") {
  const roomKey = normalizeRoomKey(customKey) || createUniqueRoomKey();
  const existing = findPrivateRoomByKey(roomKey);
  if (existing) {
    throw new Error("That private room key is already being used.");
  }

  const room = createRoom({
    type: "private",
    roomKey,
    ownerSocketId
  });
  addPlayer(room, ownerSocketId, ownerName);
  return room;
}

function joinPrivateRoom(socketId, name, roomKey) {
  const room = findPrivateRoomByKey(roomKey);
  if (!room) throw new Error("Private room not found. Check the room key.");
  if (room.players.size >= room.maxPlayers) throw new Error("That room is full.");
  addPlayer(room, socketId, name);
  return room;
}

function joinQuickMatch(socketId, name) {
  let room = Array.from(rooms.values()).find((candidate) =>
    candidate.type === "public"
    && candidate.players.size < candidate.maxPlayers
    && candidate.status !== "ended"
  );

  if (!room) {
    room = createRoom({ type: "public", roomKey: createUniqueRoomKey() });
  }

  addPlayer(room, socketId, name);
  if (room.players.size >= PUBLIC_MIN_PLAYERS && room.status === "waiting") {
    startRoom(room);
  }
  return room;
}

function leaveRoom(socketId) {
  const room = getRoomByPlayer(socketId);
  if (!room) return null;

  room.players.delete(socketId);
  room.bullets = room.bullets.filter((bullet) => bullet.ownerId !== socketId);

  if (room.ownerSocketId === socketId) {
    room.ownerSocketId = room.players.keys().next().value || "";
  }

  if (!room.players.size) {
    rooms.delete(room.id);
  }

  return room;
}

function startRoom(room) {
  if (!room || room.status === "playing") return;
  room.status = "playing";
  room.startedAt = Date.now();
  room.endsAt = room.startedAt + room.matchDurationMs;
  room.winner = null;
  room.killFeed = [];
  room.bullets = [];

  for (const player of room.players.values()) {
    player.health = 100;
    player.kills = 0;
    player.deaths = 0;
    player.alive = true;
    player.respawnAt = 0;
    Object.assign(player, randomSpawn());
  }
}

function resetEndedRoom(room) {
  room.status = "waiting";
  room.startedAt = 0;
  room.endsAt = 0;
  room.winner = null;
  room.bullets = [];
  room.killFeed = [];
  for (const player of room.players.values()) {
    player.health = 100;
    player.alive = true;
    player.respawnAt = 0;
    player.kills = 0;
    player.deaths = 0;
    Object.assign(player, randomSpawn());
  }
}

function addPlayer(room, socketId, name) {
  const spawn = randomSpawn();
  room.players.set(socketId, {
    id: socketId,
    name: cleanPlayerName(name),
    x: spawn.x,
    y: spawn.y,
    angle: 0,
    health: 100,
    kills: 0,
    deaths: 0,
    alive: true,
    respawnAt: 0,
    lastShotAt: 0,
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
      shooting: false,
      aimAngle: 0
    }
  });
}

function createRoom({ type, roomKey, ownerSocketId = "" }) {
  const room = {
    id: `arena-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    roomKey,
    type,
    ownerSocketId,
    maxPlayers: MAX_PLAYERS,
    players: new Map(),
    bullets: [],
    killFeed: [],
    status: "waiting",
    matchDurationMs: 180000,
    startedAt: 0,
    endsAt: 0,
    winner: null,
    lastActiveAt: Date.now()
  };
  rooms.set(room.id, room);
  return room;
}

function roomSummary(room) {
  return {
    roomId: room.id,
    roomKey: room.roomKey,
    type: room.type,
    maxPlayers: room.maxPlayers,
    status: room.status,
    ownerSocketId: room.ownerSocketId,
    matchDurationMs: room.matchDurationMs,
    timeLeftMs: room.endsAt ? Math.max(0, room.endsAt - Date.now()) : room.matchDurationMs,
    players: Array.from(room.players.values()).map(publicPlayer),
    winner: room.winner,
    world: {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT
    }
  };
}

function snapshotRoom(room) {
  return {
    ...roomSummary(room),
    bullets: room.bullets.map((bullet) => ({
      id: bullet.id,
      x: Math.round(bullet.x),
      y: Math.round(bullet.y),
      vx: Math.round(bullet.vx),
      vy: Math.round(bullet.vy)
    })),
    killFeed: room.killFeed.slice(-6)
  };
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    x: Math.round(player.x),
    y: Math.round(player.y),
    angle: Number(player.angle.toFixed(3)),
    health: Math.max(0, Math.round(player.health)),
    kills: player.kills,
    deaths: player.deaths,
    alive: player.alive,
    respawnAt: player.respawnAt
  };
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function getRoomByPlayer(socketId) {
  return Array.from(rooms.values()).find((room) => room.players.has(socketId));
}

function getRooms() {
  return rooms;
}

function findPrivateRoomByKey(roomKey) {
  const key = normalizeRoomKey(roomKey);
  return Array.from(rooms.values()).find((room) => room.type === "private" && room.roomKey === key);
}

function cleanupRooms() {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.players.size || now - room.lastActiveAt > 30 * 60 * 1000) {
      rooms.delete(room.id);
    }
  }
}

function randomSpawn() {
  return {
    x: 120 + Math.random() * (WORLD_WIDTH - 240),
    y: 120 + Math.random() * (WORLD_HEIGHT - 240)
  };
}

function normalizeRoomKey(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function createUniqueRoomKey() {
  let key = "";
  do {
    key = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (Array.from(rooms.values()).some((room) => room.roomKey === key));
  return key;
}

function cleanPlayerName(value) {
  return String(value || "Player").trim().replace(/\s+/g, " ").slice(0, 18) || "Player";
}

module.exports = {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAX_PLAYERS,
  rooms,
  cleanupRooms,
  createPrivateRoom,
  getRoom,
  getRoomByPlayer,
  getRooms,
  joinPrivateRoom,
  joinQuickMatch,
  leaveRoom,
  resetEndedRoom,
  roomSummary,
  snapshotRoom,
  startRoom
};
