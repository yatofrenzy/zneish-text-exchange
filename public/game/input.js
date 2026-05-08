export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mobile = new Set();
    this.mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };
    this.sequence = 0;

    window.addEventListener("keydown", (event) => {
      if (isTyping(event.target)) return;
      this.keys.add(event.key.toLowerCase());
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.key.toLowerCase());
    });

    canvas.addEventListener("mousemove", (event) => {
      this.mouse = { ...this.mouse, ...this.relativePoint(event) };
    });

    canvas.addEventListener("mousedown", (event) => {
      if (event.button === 0) this.mouse.down = true;
    });

    window.addEventListener("mouseup", () => {
      this.mouse.down = false;
    });

    canvas.addEventListener("touchmove", (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      this.mouse = { ...this.mouse, ...this.relativePoint(touch) };
    }, { passive: true });

    document.querySelectorAll("[data-mobile]").forEach((button) => {
      const key = button.dataset.mobile;
      const press = (event) => {
        event.preventDefault();
        this.mobile.add(key);
      };
      const release = (event) => {
        event.preventDefault();
        this.mobile.delete(key);
      };
      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("pointerleave", release);
    });
  }

  state(camera, self) {
    const worldMouseX = camera.x + this.mouse.x / camera.scale;
    const worldMouseY = camera.y + this.mouse.y / camera.scale;
    const aimAngle = self
      ? Math.atan2(worldMouseY - self.y, worldMouseX - self.x)
      : 0;

    return {
      seq: ++this.sequence,
      up: this.keys.has("w") || this.keys.has("arrowup") || this.mobile.has("up"),
      down: this.keys.has("s") || this.keys.has("arrowdown") || this.mobile.has("down"),
      left: this.keys.has("a") || this.keys.has("arrowleft") || this.mobile.has("left"),
      right: this.keys.has("d") || this.keys.has("arrowright") || this.mobile.has("right"),
      shooting: this.mouse.down || this.keys.has(" ") || this.mobile.has("fire"),
      aimAngle
    };
  }

  relativePoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (event.clientY - rect.top) * (this.canvas.height / rect.height)
    };
  }
}

function isTyping(target) {
  return target?.matches?.("input, textarea, select, [contenteditable='true']");
}
