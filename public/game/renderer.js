export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.camera = { x: 0, y: 0, scale: 1 };
    this.renderPlayers = new Map();
  }

  draw(snapshot, selfId) {
    this.resizeForDevice();
    const ctx = this.ctx;
    const world = snapshot?.world || { width: 2200, height: 1400 };
    const players = snapshot?.players || [];
    const self = players.find((player) => player.id === selfId) || players[0];

    this.updateCamera(self, world);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawArena(world);
    this.drawBullets(snapshot?.bullets || []);
    this.drawPlayers(players, selfId);
  }

  updateCamera(self, world) {
    const viewW = this.canvas.width / this.camera.scale;
    const viewH = this.canvas.height / this.camera.scale;
    const targetX = self ? self.x - viewW / 2 : world.width / 2 - viewW / 2;
    const targetY = self ? self.y - viewH / 2 : world.height / 2 - viewH / 2;
    this.camera.x = lerp(this.camera.x, clamp(targetX, 0, world.width - viewW), 0.16);
    this.camera.y = lerp(this.camera.y, clamp(targetY, 0, world.height - viewH), 0.16);
  }

  drawArena(world) {
    const ctx = this.ctx;
    const { scale } = this.camera;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-this.camera.x, -this.camera.y);

    ctx.fillStyle = "#08111f";
    ctx.fillRect(0, 0, world.width, world.height);

    ctx.strokeStyle = "rgba(34, 211, 238, 0.11)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= world.width; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, world.height);
      ctx.stroke();
    }
    for (let y = 0; y <= world.height; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(world.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(30, 203, 225, 0.72)";
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, world.width, world.height);
    ctx.restore();
  }

  drawPlayers(players, selfId) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.camera.scale, this.camera.scale);
    ctx.translate(-this.camera.x, -this.camera.y);

    for (const player of players) {
      // Interpolation makes remote players glide instead of snapping between server snapshots.
      const previous = this.renderPlayers.get(player.id) || player;
      const shown = {
        ...player,
        x: lerp(previous.x, player.x, 0.35),
        y: lerp(previous.y, player.y, 0.35),
        angle: player.angle
      };
      this.renderPlayers.set(player.id, shown);

      ctx.globalAlpha = player.alive ? 1 : 0.36;
      ctx.fillStyle = player.id === selfId ? "#1ecbe1" : "#fb4d8d";
      ctx.beginPath();
      ctx.arc(shown.x, shown.y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(shown.x, shown.y);
      ctx.lineTo(shown.x + Math.cos(shown.angle) * 30, shown.y + Math.sin(shown.angle) * 30);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(player.name, shown.x, shown.y - 30);

      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(shown.x - 22, shown.y + 25, 44, 5);
      ctx.fillStyle = player.health > 35 ? "#22d3ee" : "#fb4d8d";
      ctx.fillRect(shown.x - 22, shown.y + 25, 44 * (player.health / 100), 5);
    }

    ctx.restore();
  }

  drawBullets(bullets) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.camera.scale, this.camera.scale);
    ctx.translate(-this.camera.x, -this.camera.y);
    ctx.fillStyle = "#facc15";
    for (const bullet of bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  resizeForDevice() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(640, Math.round(rect.width * window.devicePixelRatio));
    const height = Math.max(360, Math.round(rect.height * window.devicePixelRatio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
