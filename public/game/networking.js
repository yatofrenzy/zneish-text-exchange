export class GameNetwork {
  constructor() {
    this.socket = window.io();
    this.selfId = "";
    this.room = null;
    this.snapshot = null;
    this.pingMs = 0;
    this.listeners = new Map();
    this.lastPingAt = 0;

    this.socket.on("connect", () => this.emitLocal("connection", "Online"));
    this.socket.on("disconnect", () => this.emitLocal("connection", "Offline"));
    this.socket.on("game:joined", (payload) => {
      this.selfId = payload.selfId;
      this.room = payload.room;
      this.snapshot = payload.snapshot;
      this.emitLocal("joined", payload);
    });
    this.socket.on("game:room", (room) => {
      this.room = room;
      this.emitLocal("room", room);
    });
    this.socket.on("game:snapshot", (snapshot) => {
      this.snapshot = snapshot;
      this.room = snapshot;
      this.emitLocal("snapshot", snapshot);
    });
    this.socket.on("game:pong", () => {
      this.pingMs = Date.now() - this.lastPingAt;
      this.emitLocal("ping", this.pingMs);
    });

    window.setInterval(() => {
      this.lastPingAt = Date.now();
      this.socket.emit("game:ping");
    }, 1500);
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName).add(callback);
  }

  quickMatch(name) {
    return this.request("game:quickMatch", { name });
  }

  createPrivate(name, roomKey) {
    return this.request("game:createPrivate", { name, roomKey });
  }

  joinPrivate(name, roomKey) {
    return this.request("game:joinPrivate", { name, roomKey });
  }

  startMatch() {
    return this.request("game:start", {});
  }

  leave() {
    return this.request("game:leave", {});
  }

  sendInput(input) {
    if (!this.socket.connected) return;
    this.socket.emit("game:input", input);
  }

  request(eventName, payload) {
    return new Promise((resolve) => {
      this.socket.timeout(3500).emit(eventName, payload, (error, response) => {
        if (error) return resolve({ ok: false, message: "Connection timed out. Try again." });
        resolve(response || { ok: false, message: "No server response." });
      });
    });
  }

  emitLocal(eventName, payload) {
    for (const callback of this.listeners.get(eventName) || []) {
      callback(payload);
    }
  }
}
