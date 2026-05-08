const {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  cleanupRooms,
  getRooms,
  resetEndedRoom,
  snapshotRoom
} = require("./roomManager");

const TICK_RATE = 30;
const SNAPSHOT_RATE = 20;
const PLAYER_RADIUS = 18;
const PLAYER_SPEED = 285;
const BULLET_RADIUS = 5;
const BULLET_SPEED = 860;
const BULLET_LIFETIME_MS = 1150;
const SHOT_COOLDOWN_MS = 210;
const DAMAGE = 25;
const RESPAWN_DELAY_MS = 2500;

let tickTimer = null;
let snapshotTimer = null;

function startGameLoop(io) {
  if (tickTimer) return;

  let last = Date.now();
  // Fixed tick rate keeps every room fair and avoids trusting client frame rates.
  tickTimer = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.08, (now - last) / 1000);
    last = now;
    for (const room of getRooms().values()) {
      updateRoom(room, dt, now);
    }
    cleanupRooms();
  }, 1000 / TICK_RATE);

  snapshotTimer = setInterval(() => {
    for (const room of getRooms().values()) {
      io.to(room.id).emit("game:snapshot", snapshotRoom(room));
    }
  }, 1000 / SNAPSHOT_RATE);
}

function updateRoom(room, dt, now) {
  room.lastActiveAt = now;

  if (room.status !== "playing") {
    return;
  }

  if (room.endsAt && now >= room.endsAt) {
    endMatch(room);
    return;
  }

  for (const player of room.players.values()) {
    updatePlayer(room, player, dt, now);
  }

  updateBullets(room, dt, now);
}

function updatePlayer(room, player, dt, now) {
  if (!player.alive) {
    if (player.respawnAt && now >= player.respawnAt) {
      respawnPlayer(player);
    }
    return;
  }

  const input = player.input || {};
  let dx = 0;
  let dy = 0;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;

  const length = Math.hypot(dx, dy) || 1;
  dx /= length;
  dy /= length;

  player.x = clamp(player.x + dx * PLAYER_SPEED * dt, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
  player.y = clamp(player.y + dy * PLAYER_SPEED * dt, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);
  player.angle = sanitizeAngle(input.aimAngle);

  if (input.shooting) {
    shoot(room, player, now);
  }
}

function shoot(room, player, now) {
  // Cooldown is validated on the server so clients cannot fire faster by editing JS.
  if (now - player.lastShotAt < SHOT_COOLDOWN_MS) return;
  player.lastShotAt = now;

  const angle = sanitizeAngle(player.angle);
  const muzzleDistance = PLAYER_RADIUS + 10;
  room.bullets.push({
    id: `b-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ownerId: player.id,
    x: player.x + Math.cos(angle) * muzzleDistance,
    y: player.y + Math.sin(angle) * muzzleDistance,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    createdAt: now
  });
}

function updateBullets(room, dt, now) {
  const kept = [];

  for (const bullet of room.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    const expired = now - bullet.createdAt > BULLET_LIFETIME_MS;
    const outOfBounds = bullet.x < 0 || bullet.y < 0 || bullet.x > WORLD_WIDTH || bullet.y > WORLD_HEIGHT;
    if (expired || outOfBounds) continue;

    const hitPlayer = Array.from(room.players.values()).find((player) =>
      player.id !== bullet.ownerId
      && player.alive
      && distance(player.x, player.y, bullet.x, bullet.y) <= PLAYER_RADIUS + BULLET_RADIUS
    );

    if (hitPlayer) {
      damagePlayer(room, hitPlayer, bullet.ownerId, now);
      continue;
    }

    kept.push(bullet);
  }

  room.bullets = kept.slice(-160);
}

function damagePlayer(room, victim, attackerId, now) {
  victim.health -= DAMAGE;
  if (victim.health > 0) return;

  const attacker = room.players.get(attackerId);
  victim.health = 0;
  victim.alive = false;
  victim.deaths += 1;
  victim.respawnAt = now + RESPAWN_DELAY_MS;

  if (attacker && attacker.id !== victim.id) {
    attacker.kills += 1;
    room.killFeed.push({
      id: `k-${now.toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      attacker: attacker.name,
      victim: victim.name,
      at: now
    });
  }
}

function respawnPlayer(player) {
  player.health = 100;
  player.alive = true;
  player.respawnAt = 0;
  player.x = 120 + Math.random() * (WORLD_WIDTH - 240);
  player.y = 120 + Math.random() * (WORLD_HEIGHT - 240);
}

function endMatch(room) {
  room.status = "ended";
  room.bullets = [];
  const winner = Array.from(room.players.values()).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)[0] || null;
  room.winner = winner ? {
    id: winner.id,
    name: winner.name,
    kills: winner.kills,
    deaths: winner.deaths
  } : null;

  setTimeout(() => {
    if (room.players.size && room.status === "ended") {
      resetEndedRoom(room);
    }
  }, 10000);
}

function sanitizeAngle(value) {
  const angle = Number(value);
  return Number.isFinite(angle) ? angle : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

module.exports = {
  startGameLoop
};
