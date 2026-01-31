const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const express = require("express");

// -------------------- FILE SETUP (PRODUCTION SAFE) --------------------
const dataDir = path.join(app.getPath("documents"), "BetterScore");

function writeFile(name, content) {
  fs.writeFileSync(path.join(dataDir, name), content, "utf8");
}

// -------------------- GAME STATE --------------------
let state = {
  home: 0,
  away: 0,
  period: 1,
  powerPlay: "",
  seconds: 20 * 60,
  powerPlaySeconds: 0
};

let timer = null;

// -------------------- HELPERS --------------------
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatOrdinal(num) {
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  switch (num % 10) {
    case 1:
      return `${num}st`;
    case 2:
      return `${num}nd`;
    case 3:
      return `${num}rd`;
    default:
      return `${num}th`;
  }
}

function syncFiles() {
  writeFile("home_score.txt", String(state.home));
  writeFile("away_score.txt", String(state.away));
  writeFile("period.txt", formatOrdinal(state.period));
  writeFile("time.txt", formatTime(state.seconds));
  writeFile("pp.txt", state.powerPlay);
  writeFile("pp_time.txt", formatTime(state.powerPlaySeconds));
}

// -------------------- INIT FILES --------------------
function initFiles() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("Created BetterScore folder:", dataDir);
  }
  syncFiles();
}

// -------------------- CLOCK --------------------
function startClock() {
  if (timer) return;

  timer = setInterval(() => {
    if (state.seconds > 0) {
      state.seconds--;
      writeFile("time.txt", formatTime(state.seconds));
    } else {
      stopClock();
    }

    if (state.powerPlay && state.powerPlaySeconds > 0) {
      state.powerPlaySeconds--;
      writeFile("pp_time.txt", formatTime(state.powerPlaySeconds));

      if (state.powerPlaySeconds === 0) {
        state.powerPlay = "";
        writeFile("pp.txt", "");
      }
    }
  }, 1000);
}

function stopClock() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// -------------------- STREAM DECK / HTTP API --------------------
const api = express();
api.use(express.json());

// STATE
api.get("/state", (req, res) => res.json(state));

// SCORE
api.post("/score/home", (req, res) => {
  state.home++;
  syncFiles();
  res.send("OK");
});

api.post("/score/away", (req, res) => {
  state.away++;
  syncFiles();
  res.send("OK");
});

api.post("/score/reset", (req, res) => {
  state.home = 0;
  state.away = 0;
  syncFiles();
  res.send("OK");
});

// PERIOD
api.post("/period/next", (req, res) => {
  state.period++;
  syncFiles();
  res.send("OK");
});

api.post("/period/reset", (req, res) => {
  state.period = 1;
  syncFiles();
  res.send("OK");
});

// POWER PLAY
api.post("/pp/home", (req, res) => {
  state.powerPlay = "PP: HOME";
  if (state.powerPlaySeconds === 0) {
    state.powerPlaySeconds = 2 * 60;
  }
  syncFiles();
  res.send("OK");
});

api.post("/pp/away", (req, res) => {
  state.powerPlay = "PP: AWAY";
  if (state.powerPlaySeconds === 0) {
    state.powerPlaySeconds = 2 * 60;
  }
  syncFiles();
  res.send("OK");
});

api.post("/pp/clear", (req, res) => {
  state.powerPlay = "";
  state.powerPlaySeconds = 0;
  syncFiles();
  res.send("OK");
});

// CLOCK CONTROL
api.post("/clock/start", (req, res) => {
  startClock();
  res.send("OK");
});

api.post("/clock/stop", (req, res) => {
  stopClock();
  res.send("OK");
});

api.post("/clock/reset", (req, res) => {
  stopClock();
  state.seconds = 20 * 60;
  syncFiles();
  res.send("OK");
});

// DIRECT SETTERS (OPTIONAL)
api.post("/set/score", (req, res) => {
  state.home = req.body.home ?? state.home;
  state.away = req.body.away ?? state.away;
  syncFiles();
  res.send("OK");
});

api.post("/set/period", (req, res) => {
  state.period = req.body.period ?? state.period;
  syncFiles();
  res.send("OK");
});

api.post("/set/time", (req, res) => {
  stopClock();
  state.seconds = req.body.seconds ?? state.seconds;
  syncFiles();
  res.send("OK");
});

api.post("/set/pp/time", (req, res) => {
  state.powerPlaySeconds = req.body.seconds ?? state.powerPlaySeconds;
  if (state.powerPlaySeconds === 0) {
    state.powerPlay = "";
  }
  syncFiles();
  res.send("OK");
});

// START API
api.listen(3000, () => {
  console.log("Stream Deck API running at http://localhost:3000");
});

// -------------------- ELECTRON WINDOW --------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: false
  });

  win.loadFile("index.html");
}

// -------------------- APP START --------------------
app.whenReady().then(() => {
  initFiles();
  createWindow();
});
