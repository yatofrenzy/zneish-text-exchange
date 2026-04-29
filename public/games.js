const params = new URLSearchParams(window.location.search);
const roomKey = normalizeRoomKey(params.get("room") || localStorage.getItem("zneish-room") || "PUBLIC");
const userName = (params.get("name") || localStorage.getItem("zneish-name") || "Guest").trim().slice(0, 32) || "Guest";

const backToRoom = document.querySelector("#backToRoom");
const homeLink = document.querySelector("#homeLink");
const assistantLink = document.querySelector("#assistantLink");
const gameRoom = document.querySelector("#gameRoom");

const roomUrl = `/?room=${encodeURIComponent(roomKey)}`;
const assistantUrl = `/assistant.html?room=${encodeURIComponent(roomKey)}&name=${encodeURIComponent(userName)}`;
backToRoom.href = roomUrl;
homeLink.href = roomUrl;
assistantLink.href = assistantUrl;
gameRoom.textContent = `Room ${roomKey}`;

setupGames();

function setupGames() {
  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const gameName = document.querySelector("#gameName");
  const gameScore = document.querySelector("#gameScore");
  const gameHelp = document.querySelector("#gameHelp");
  const startGame = document.querySelector("#startGame");
  const murderBox = document.querySelector("#murderBox");
  const murderQuestion = document.querySelector("#murderQuestion");
  const murderChoices = document.querySelector("#murderChoices");
  let activeGame = "snake";
  let timer = null;
  let keys = {};
  let taps = {};
  let state = {};

  const descriptions = {
    snake: ["Snake", "Use arrow keys or WASD. Avoid walls and your tail."],
    tetris: ["Tetris", "Use left/right to move, up to rotate, down to drop faster."],
    flappy: ["Flappy", "Press Space or tap Flap to fly through the gates."],
    murder: ["Murder Guess", "Use the clues to guess the hidden suspect."]
  };

  document.querySelectorAll("[data-game]").forEach((button) => {
    button.addEventListener("click", () => {
      activeGame = button.dataset.game;
      document.querySelectorAll("[data-game]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      stopGame();
      gameName.textContent = descriptions[activeGame][0];
      gameHelp.textContent = descriptions[activeGame][1];
      gameScore.textContent = "Score: 0";
      murderBox.hidden = activeGame !== "murder";
      drawBlank();
      if (activeGame === "murder") startMurder();
    });
  });

  startGame.addEventListener("click", () => {
    stopGame();
    if (activeGame === "snake") startSnake();
    if (activeGame === "tetris") startTetris();
    if (activeGame === "flappy") startFlappy();
    if (activeGame === "murder") startMurder();
  });

  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;
    keys[event.key.toLowerCase()] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  });

  window.addEventListener("keyup", (event) => {
    if (isTypingTarget(event.target)) return;
    keys[event.key.toLowerCase()] = false;
  });

  document.querySelectorAll("[data-control]").forEach((button) => {
    const key = button.dataset.control;
    const press = (event) => {
      event.preventDefault();
      keys[key] = true;
      taps[key] = true;
    };
    const release = (event) => {
      event.preventDefault();
      keys[key] = false;
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  drawBlank();

  function startSnake() {
    state = {
      snake: [{ x: 8, y: 8 }],
      dir: { x: 1, y: 0 },
      food: { x: 14, y: 11 },
      score: 0
    };
    timer = window.setInterval(updateSnake, 115);
  }

  function updateSnake() {
    if (keys.arrowup || keys.w || taps.arrowup) state.dir = { x: 0, y: -1 };
    if (keys.arrowdown || keys.s || taps.arrowdown) state.dir = { x: 0, y: 1 };
    if (keys.arrowleft || keys.a || taps.arrowleft) state.dir = { x: -1, y: 0 };
    if (keys.arrowright || keys.d || taps.arrowright) state.dir = { x: 1, y: 0 };
    taps = {};

    const head = { x: state.snake[0].x + state.dir.x, y: state.snake[0].y + state.dir.y };
    const hit = head.x < 0 || head.y < 0 || head.x >= 20 || head.y >= 20 || state.snake.some((part) => part.x === head.x && part.y === head.y);
    if (hit) return gameOver("Snake over");

    state.snake.unshift(head);
    if (head.x === state.food.x && head.y === state.food.y) {
      state.score += 10;
      state.food = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
    } else {
      state.snake.pop();
    }

    clearCanvas();
    drawCell(state.food.x, state.food.y, "#ff6269");
    state.snake.forEach((part, index) => drawCell(part.x, part.y, index ? "#51d0ae" : "#ffffff"));
    gameScore.textContent = `Score: ${state.score}`;
  }

  function startFlappy() {
    state = {
      bird: { x: 70, y: 170, velocity: 0 },
      pipes: [{ x: 360, gap: 150 }],
      score: 0
    };
    timer = window.setInterval(updateFlappy, 26);
  }

  function updateFlappy() {
    if (keys[" "] || keys.arrowup || keys.w || taps[" "] || taps.arrowup) {
      state.bird.velocity = -5.5;
      keys[" "] = false;
      keys.arrowup = false;
      keys.w = false;
      taps[" "] = false;
      taps.arrowup = false;
    }

    state.bird.velocity += 0.35;
    state.bird.y += state.bird.velocity;
    state.pipes.forEach((pipe) => (pipe.x -= 2.4));
    const last = state.pipes[state.pipes.length - 1];
    if (last.x < 170) state.pipes.push({ x: 380, gap: 80 + Math.random() * 170 });
    state.pipes = state.pipes.filter((pipe) => pipe.x > -60);

    clearCanvas();
    ctx.fillStyle = "#51d0ae";
    ctx.beginPath();
    ctx.arc(state.bird.x, state.bird.y, 12, 0, Math.PI * 2);
    ctx.fill();

    for (const pipe of state.pipes) {
      ctx.fillStyle = "#ff6269";
      ctx.fillRect(pipe.x, 0, 44, pipe.gap - 58);
      ctx.fillRect(pipe.x, pipe.gap + 58, 44, 360);
      const hitX = state.bird.x + 12 > pipe.x && state.bird.x - 12 < pipe.x + 44;
      const hitY = state.bird.y - 12 < pipe.gap - 58 || state.bird.y + 12 > pipe.gap + 58;
      if (hitX && hitY) return gameOver("Flappy over");
      if (Math.abs(pipe.x - state.bird.x) < 1.3) state.score += 1;
    }

    if (state.bird.y > 360 || state.bird.y < 0) return gameOver("Flappy over");
    gameScore.textContent = `Score: ${state.score}`;
  }

  function startTetris() {
    state = {
      grid: Array.from({ length: 18 }, () => Array(10).fill(0)),
      piece: newPiece(),
      score: 0,
      tick: 0
    };
    timer = window.setInterval(updateTetris, 80);
  }

  function updateTetris() {
    if (keys.arrowleft || keys.a || taps.arrowleft) {
      movePiece(-1, 0);
      keys.arrowleft = false;
      keys.a = false;
      taps.arrowleft = false;
    }
    if (keys.arrowright || keys.d || taps.arrowright) {
      movePiece(1, 0);
      keys.arrowright = false;
      keys.d = false;
      taps.arrowright = false;
    }
    if (keys.arrowup || keys.w || taps.arrowup) {
      rotatePiece();
      keys.arrowup = false;
      keys.w = false;
      taps.arrowup = false;
    }

    state.tick += keys.arrowdown || keys.s || taps.arrowdown ? 6 : 1;
    taps.arrowdown = false;
    if (state.tick >= 8) {
      state.tick = 0;
      if (!movePiece(0, 1)) lockPiece();
    }

    clearCanvas();
    drawTetrisGrid();
    gameScore.textContent = `Score: ${state.score}`;
  }

  function newPiece() {
    const shapes = [
      [[1, 1, 1, 1]],
      [[1, 1], [1, 1]],
      [[0, 1, 0], [1, 1, 1]],
      [[1, 0, 0], [1, 1, 1]],
      [[0, 0, 1], [1, 1, 1]]
    ];
    return { x: 3, y: 0, shape: shapes[Math.floor(Math.random() * shapes.length)] };
  }

  function movePiece(dx, dy) {
    const next = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy };
    if (collides(next)) return false;
    state.piece = next;
    return true;
  }

  function rotatePiece() {
    const shape = state.piece.shape[0].map((_, index) => state.piece.shape.map((row) => row[index]).reverse());
    const next = { ...state.piece, shape };
    if (!collides(next)) state.piece = next;
  }

  function collides(piece) {
    return piece.shape.some((row, y) => row.some((cell, x) => cell && (piece.x + x < 0 || piece.x + x >= 10 || piece.y + y >= 18 || state.grid[piece.y + y]?.[piece.x + x])));
  }

  function lockPiece() {
    state.piece.shape.forEach((row, y) => row.forEach((cell, x) => {
      if (cell && state.grid[state.piece.y + y]) state.grid[state.piece.y + y][state.piece.x + x] = 1;
    }));
    state.grid = state.grid.filter((row) => {
      if (row.every(Boolean)) {
        state.score += 100;
        return false;
      }
      return true;
    });
    while (state.grid.length < 18) state.grid.unshift(Array(10).fill(0));
    state.piece = newPiece();
    if (collides(state.piece)) gameOver("Tetris over");
  }

  function drawTetrisGrid() {
    const size = 20;
    const offsetX = 80;
    state.grid.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) drawRect(offsetX + x * size, y * size, size - 1, size - 1, "#51d0ae");
    }));
    state.piece.shape.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) drawRect(offsetX + (state.piece.x + x) * size, (state.piece.y + y) * size, size - 1, size - 1, "#ff6269");
    }));
  }

  function startMurder() {
    stopGame();
    murderBox.hidden = false;
    const suspects = [
      { name: "Asha", clues: ["wears glasses", "was in the kitchen", "likes chess"] },
      { name: "Milan", clues: ["wears a hat", "was near the garden", "plays guitar"] },
      { name: "Riya", clues: ["has a red scarf", "was in the library", "likes puzzles"] },
      { name: "Dev", clues: ["wears boots", "was near the garage", "collects coins"] }
    ];
    const secret = suspects[Math.floor(Math.random() * suspects.length)];
    state = { suspects, secret, questions: 0 };
    clearCanvas();
    ctx.fillStyle = "#ffffff";
    ctx.font = "22px sans-serif";
    ctx.fillText("Find the suspect", 86, 160);
    murderQuestion.textContent = `Clue ${state.questions + 1}: The suspect ${secret.clues[state.questions]}. Who is it?`;
    murderChoices.replaceChildren();
    suspects.forEach((suspect) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = suspect.name;
      button.addEventListener("click", () => {
        if (suspect.name === secret.name) {
          gameScore.textContent = `Solved: ${secret.name}`;
          murderQuestion.textContent = "Correct. You solved the room mystery.";
        } else {
          state.questions = Math.min(state.questions + 1, secret.clues.length - 1);
          gameScore.textContent = "Wrong guess";
          murderQuestion.textContent = `New clue: The suspect ${secret.clues[state.questions]}. Try again.`;
        }
      });
      murderChoices.append(button);
    });
  }

  function drawCell(x, y, color) {
    drawRect(x * 18, y * 18, 17, 17, color);
  }

  function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  function clearCanvas() {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawBlank() {
    clearCanvas();
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.fillText("Choose a game and press Start", 52, 180);
  }

  function gameOver(label) {
    stopGame();
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px sans-serif";
    ctx.fillText(label, 112, 180);
  }

  function stopGame() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }
}

function normalizeRoomKey(value) {
  return String(value || "PUBLIC").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PUBLIC";
}

function isTypingTarget(target) {
  return target?.matches?.("input, textarea, select, [contenteditable='true']");
}
