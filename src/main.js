/**
 * Color Maze — Main Entry Point
 * Orchestrates all game systems
 */

import "./style.css";

import { LEVELS } from "./data/levels.js";
import { GridManager, CELL } from "./core/GridManager.js";
import { InputManager } from "./core/InputManager.js";
import { AudioManager } from "./core/AudioManager.js";
import { LevelGenerator } from "./core/LevelGenerator.js";
import { SceneSetup } from "./rendering/SceneSetup.js";
import { MazeRenderer } from "./rendering/MazeRenderer.js";
import { BallRenderer } from "./rendering/BallRenderer.js";
import { ParticleSystem } from "./rendering/ParticleSystem.js";

// ============================================
// STATE
// ============================================

let inputQueue = null;

const State = {
  MENU: "MENU",
  LEVEL_SELECT: "LEVEL_SELECT",
  PLAYING: "PLAYING",
  ANIMATING: "ANIMATING",
  WIN: "WIN",
  STUCK: "STUCK",
};

let currentState = State.MENU;
let currentLevelIndex = 0;
let moveCount = 0;
let ballRow = 0;
let ballCol = 0;



// Save data
let saveData = loadSave();

// ============================================
// SYSTEMS
// ============================================

const container = document.getElementById("game-container");
const sceneSetup = new SceneSetup(container);
const mazeRenderer = new MazeRenderer(sceneSetup.scene);
const ballRenderer = new BallRenderer(sceneSetup.scene);
const particleSystem = new ParticleSystem(sceneSetup.scene);
const grid = new GridManager();
const input = new InputManager();
const audio = new AudioManager();

// ============================================
// UI REFERENCES
// ============================================

const menuScreen = document.getElementById("menu-screen");
const levelSelectScreen = document.getElementById("level-select-screen");
const hudEl = document.getElementById("hud");
const winScreen = document.getElementById("win-screen");
const stuckScreen = document.getElementById("stuck-screen");

const moveCountEl = document.getElementById("move-count");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const levelNameEl = document.getElementById("level-name");
const winMovesEl = document.getElementById("win-moves");
const winParEl = document.getElementById("win-par");
const winStarsEl = document.getElementById("win-stars");
const levelGrid = document.getElementById("level-grid");

// ============================================
// SAVE / LOAD
// ============================================

let playerName = localStorage.getItem("colormaze_player_id");
if (!playerName) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomID = "";
  for (let i = 0; i < 4; i++) randomID += chars.charAt(Math.floor(Math.random() * chars.length));
  playerName = "Guest-" + randomID;
  localStorage.setItem("colormaze_player_id", playerName);
}
document.getElementById("identity-span").textContent = playerName;

// Username Edit Logic
const nameDisplay = document.getElementById("player-identity-container");
const nameEdit = document.getElementById("name-edit-container");
const nameInput = document.getElementById("input-name");

document.getElementById("btn-edit-name").addEventListener("click", () => {
   nameDisplay.style.display = "none";
   nameEdit.style.display = "flex";
   nameInput.value = playerName;
   nameInput.focus();
});

document.getElementById("btn-save-name").addEventListener("click", () => {
   const val = nameInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, ""); // basic sanitization
   if (val.length > 0) {
      playerName = val.substring(0, 12);
      localStorage.setItem("colormaze_player_id", playerName);
      document.getElementById("identity-span").textContent = playerName;
   }
   nameEdit.style.display = "none";
   nameDisplay.style.display = "flex";
});

function loadSave() {
  try {
    const data = localStorage.getItem("colorMazeSave");
    if (data) return JSON.parse(data);
  } catch (e) {}
  return { unlockedLevel: 1, stars: {} };
}

function persistSave() {
  try {
    localStorage.setItem("colorMazeSave", JSON.stringify(saveData));
  } catch (e) {}
}

// ============================================
// SCREEN TRANSITIONS
// ============================================

function showScreen(screen) {
  [menuScreen, levelSelectScreen, winScreen, stuckScreen].forEach((s) =>
    s.classList.remove("active")
  );
  if (screen) screen.classList.add("active");
}

function showHUD(visible) {
  hudEl.classList.toggle("hidden", !visible);
}

// ============================================
// LEVEL SELECT
// ============================================

let currentLevelPage = 0;

function buildLevelSelect() {
  levelGrid.innerHTML = "";
  
  // Calculate max page based on unlocked level (0-indexed)
  // e.g. unlockedLevel 11 -> allows Pages 0 and 1
  const maxUnlockedPage = Math.floor(saveData.unlockedLevel / 10);
  
  document.getElementById("page-indicator").textContent = `Page ${currentLevelPage + 1}`;
  
  const btnPrev = document.getElementById("btn-page-prev");
  const btnNext = document.getElementById("btn-page-next");
  
  btnPrev.style.opacity = currentLevelPage === 0 ? "0.3" : "1";
  btnPrev.style.pointerEvents = currentLevelPage === 0 ? "none" : "all";
  
  btnNext.style.opacity = currentLevelPage >= maxUnlockedPage ? "0.3" : "1";
  btnNext.style.pointerEvents = currentLevelPage >= maxUnlockedPage ? "none" : "all";

  const startIdx = currentLevelPage * 10;
  const endIdx = startIdx + 10;

  for (let idx = startIdx; idx < endIdx; idx++) {
    const levelId = idx + 1;
    let name = `Sector ${levelId}`;
    if (idx < LEVELS.length) {
      name = LEVELS[idx].name; // use custom name for first 10
    } // wait we don't display name on the box, just ID

    const card = document.createElement("div");
    card.className = "level-card";
    const unlocked = idx + 1 <= saveData.unlockedLevel;

    if (!unlocked) {
      card.classList.add("locked");
    }
    if (idx === currentLevelIndex) {
      card.classList.add("current");
    }

    const numSpan = document.createElement("span");
    numSpan.textContent = levelId;

    const starsSpan = document.createElement("span");
    starsSpan.className = "level-stars";
    const starCount = saveData.stars[levelId] || 0;
    if (starCount > 0) starsSpan.classList.add("earned");
    starsSpan.textContent = "★".repeat(starCount) + "☆".repeat(3 - starCount);

    card.appendChild(numSpan);
    card.appendChild(starsSpan);

    if (unlocked) {
      card.addEventListener("click", () => {
        audio.playClick();
        currentLevelIndex = idx;
        startLevel(idx);
      });
    }

    levelGrid.appendChild(card);
  }
}

// ============================================
// START LEVEL
// ============================================

const proceduralLevelsCache = {};

async function startLevel(index) {
  currentLevelIndex = index;
  
  let level;
  if (index < LEVELS.length) {
    level = LEVELS[index];
  } else {
    if (!proceduralLevelsCache[index]) {
      // Temporarily mark UI as loading
      document.getElementById("level-name").textContent = "Downloading...";
      
      try {
        const response = await fetch('/api/level?id=' + (index + 1) + '&player=' + encodeURIComponent(playerName));
        if (!response.ok) throw new Error("API not available locally or offline");
        const generatedLevel = await response.json();
        proceduralLevelsCache[index] = generatedLevel;
      } catch (err) {
        console.log(`[Offline/Local fallback] Generating Sector ${index + 1} locally.`);
        proceduralLevelsCache[index] = LevelGenerator.generateLevel(index + 1);
      }
    }
    level = proceduralLevelsCache[index];
  }

  // We actually need the level object globally accessible for `updateHUD` and `handleWin`.
  // Since `startLevel` creates it on the fly, let's store it.
  window.currentLevelData = level;

  // Reset state
  moveCount = 0;

  currentState = State.PLAYING;

  // Load grid
  grid.loadGrid(level.grid);

  // Set ball start
  ballRow = level.start[0];
  ballCol = level.start[1];
  grid.paintStart(ballRow, ballCol);

  // Build 3D scene
  mazeRenderer.buildMaze(level.grid, level.colors);
  mazeRenderer.paintTile(ballRow, ballCol, level.colors);

  ballRenderer.setColor(level.colors.paint);
  ballRenderer.setPosition(ballRow, ballCol);
  ballRenderer.setVisible(true);

  particleSystem.clear();

  // Frame camera
  sceneSetup.frameMaze(grid.rows, grid.cols);

  // Update UI
  showScreen(null);
  showHUD(true);
  updateHUD();
  levelNameEl.textContent = level.name;
  document.getElementById("level-discoverer").textContent = level.discoveredBy ? `First mapped by ${level.discoveredBy}` : "";

  // Enable input
  input.enable();
}

// ============================================
// UPDATE HUD
// ============================================

function updateHUD() {
  const level = window.currentLevelData;
  moveCountEl.textContent = moveCount;
  const progress = grid.getProgress();
  progressBar.style.width = progress + "%";
  progressText.textContent = progress + "%";

  // Color the progress bar with level color
  progressBar.style.background = `linear-gradient(90deg, ${level.colors.paint}, ${level.colors.glow})`;
}

// ============================================
// MOVE LOGIC
// ============================================

input.onDirection = (direction) => {
  if (currentState === State.ANIMATING) {
    inputQueue = direction;
    return;
  }
  if (currentState !== State.PLAYING) return;

  executeMove(direction);
};

function executeMove(direction) {
  const result = grid.getStopPosition(ballRow, ballCol, direction);
  if (result.path.length === 0) {
    if (inputQueue) inputQueue = null; // discard queued input if it hits a wall immediately
    return;
  }



  currentState = State.ANIMATING;
  input.disable();
  moveCount++;

  const level = window.currentLevelData;

  // Play roll sound
  audio.playRoll(result.path.length * 0.12);

  // Animate ball and paint cells along the way
  ballRenderer
    .animateMoveTo(result.row, result.col, result.path.length, (cellIndex) => {
      // Paint cell as ball passes through
      const cell = result.path[cellIndex];
      if (cell) {
        const wasNew = grid.paintCell(cell.row, cell.col);
        if (wasNew) {
          mazeRenderer.paintTile(cell.row, cell.col, level.colors);
          particleSystem.spawnPaintSplash(cell.row, cell.col, level.colors.paint, 4);
          audio.playPaint(grid.paintedCount);
        }
        updateHUD();
      }
    })
    .then(() => {
      // Ball has stopped
      ballRow = result.row;
      ballCol = result.col;

      // Wall hit effect
      audio.playHitWall();
      particleSystem.spawnWallHit(ballRow, ballCol, direction, level.colors.paint);

      updateHUD();

      // Check win
      if (grid.isComplete()) {
        handleWin();
        return;
      }

      // Check stuck
      if (grid.isStuck(ballRow, ballCol)) {
        handleStuck();
        return;
      }

      currentState = State.PLAYING;
      input.enable();

      if (inputQueue) {
        const nextDir = inputQueue;
        inputQueue = null;
        if (currentState === State.PLAYING) {
          executeMove(nextDir);
        }
      }
    });
}

// ============================================
// WIN
// ============================================

function handleWin() {
  currentState = State.WIN;
  input.disable();

  const level = window.currentLevelData;

  // Calculate stars
  let stars = 1;
  if (moveCount <= level.par + 2) stars = 2;
  if (moveCount <= level.par) stars = 3;

  // Save progress
  const prevStars = saveData.stars[level.id] || 0;
  saveData.stars[level.id] = Math.max(prevStars, stars);
  // Infinite unlocks
  if (currentLevelIndex + 2 > saveData.unlockedLevel) {
    saveData.unlockedLevel = currentLevelIndex + 2;
  }
  persistSave();

  // Confetti!
  const centerRow = (grid.rows - 1) / 2;
  const centerCol = (grid.cols - 1) / 2;
  particleSystem.spawnConfetti(centerRow, centerCol, level.colors.paint, 50);

  audio.playWin();

  // Show win screen after delay
  setTimeout(() => {
    showHUD(false);
    winMovesEl.textContent = moveCount;
    winParEl.textContent = level.par;

    // Reset Leaderboard UI before fetch
    const winRecord = document.getElementById("win-record");
    const winHolder = document.getElementById("win-record-holder");
    winRecord.textContent = "--";
    winHolder.textContent = "Loading...";

    // Set stars
    const starEls = winStarsEl.querySelectorAll(".star");
    starEls.forEach((el, i) => {
      el.classList.toggle("earned", i < stars);
      if (i < stars) {
        el.style.animationDelay = `${i * 0.15}s`;
      }
    });

    showScreen(winScreen);
    
    // Check and update Leaderboard
    submitAndFetchLeaderboard(level.id, moveCount);
  }, 1200);
}

async function submitAndFetchLeaderboard(levelId, moves) {
  // Reset banners
  const recordBrokenBanner = document.getElementById("record-broken-banner");
  const firstDiscoveryBanner = document.getElementById("first-discovery-banner");
  recordBrokenBanner.classList.add("hidden");
  firstDiscoveryBanner.classList.add("hidden");
  
  try {
    // 1. Submit score and get the exact updated global rank in one trip!
    const response = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelId, playerName, moves })
    });
    
    if (response.ok) {
      const data = await response.json();
      const winRecord = document.getElementById("win-record");
      const winHolder = document.getElementById("win-record-holder");
      
      if (data.hasRecord) {
        winRecord.textContent = data.bestMoves;

        // Case 1: First-ever completion of this level — player is the pioneer
        // No "record broken" message since there was no previous record to break
        if (data.isFirstCompletion) {
          firstDiscoveryBanner.classList.remove("hidden");
          winHolder.textContent = "(You set the first World Record!)";
          winHolder.style.color = "var(--accent-cyan)";
        }
        // Case 2: Player broke the existing world record (strictly fewer moves)
        else if (data.isNewRecord) {
          recordBrokenBanner.classList.remove("hidden");
          const detail = document.getElementById("record-broken-detail");
          detail.textContent = `You beat ${data.previousHolder}'s record of ${data.previousRecord} moves!`;
          winHolder.textContent = "(You hold the World Record!)";
          winHolder.style.color = "var(--accent-pink)";
        }
        // Case 3: Normal completion — current record remains
        else {
          if (data.holder === playerName) {
             winHolder.textContent = "(You hold the World Record!)";
             winHolder.style.color = "var(--accent-pink)";
          } else {
             winHolder.textContent = `(held by ${data.holder})`;
             winHolder.style.color = "var(--text-muted)";
          }
        }
      }
    }
  } catch (err) {
    document.getElementById("win-record-holder").textContent = "Leaderboard offline";
  }
}

// ============================================
// STUCK
// ============================================

function handleStuck() {
  currentState = State.STUCK;
  input.disable();

  setTimeout(() => {
    showHUD(false);
    showScreen(stuckScreen);
  }, 500);
}



// ============================================
// LEADERBOARD
// ============================================

let leaderboardData = null;
let currentTab = 'records';

async function fetchLeaderboard() {
  const loading = document.getElementById('lb-loading');
  const emptyEl = document.getElementById('lb-empty');
  const tableRecords = document.getElementById('lb-table-records');
  const tableExplorers = document.getElementById('lb-table-explorers');
  
  loading.style.display = 'block';
  tableRecords.style.display = 'none';
  tableExplorers.style.display = 'none';
  emptyEl.classList.add('hidden');

  try {
    const response = await fetch('/api/leaderboard');
    if (!response.ok) throw new Error('API failed');
    leaderboardData = await response.json();
    loading.style.display = 'none';
    renderLeaderboardTab(currentTab);
  } catch (err) {
    loading.textContent = 'Leaderboard offline';
  }
}

function renderLeaderboardTab(tab) {
  const tableRecords = document.getElementById('lb-table-records');
  const tableExplorers = document.getElementById('lb-table-explorers');
  const emptyEl = document.getElementById('lb-empty');

  tableRecords.style.display = 'none';
  tableExplorers.style.display = 'none';
  emptyEl.classList.add('hidden');

  if (!leaderboardData) return;

  if (tab === 'records') {
    const data = leaderboardData.worldRecordLeaders;
    if (!data || data.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }
    const tbody = document.getElementById('lb-tbody-records');
    tbody.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    data.forEach((entry, i) => {
      const tr = document.createElement('tr');
      if (entry.player === playerName) tr.classList.add('lb-self');
      tr.innerHTML = `
        <td>${i < 3 ? medals[i] : i + 1}</td>
        <td>${entry.player}</td>
        <td>${entry.records}</td>
      `;
      tbody.appendChild(tr);
    });
    tableRecords.style.display = 'table';
  } else {
    const data = leaderboardData.discoveryLeaders;
    if (!data || data.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }
    const tbody = document.getElementById('lb-tbody-explorers');
    tbody.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    data.forEach((entry, i) => {
      const tr = document.createElement('tr');
      if (entry.player === playerName) tr.classList.add('lb-self');
      tr.innerHTML = `
        <td>${i < 3 ? medals[i] : i + 1}</td>
        <td>${entry.player}</td>
        <td>${entry.discoveries}</td>
      `;
      tbody.appendChild(tr);
    });
    tableExplorers.style.display = 'table';
  }
}

// Tab switching
document.querySelectorAll('.lb-tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    tabBtn.classList.add('active');
    currentTab = tabBtn.dataset.tab;
    renderLeaderboardTab(currentTab);
  });
});

// ============================================
// BUTTON HANDLERS
// ============================================

// Mobile leaderboard modal handlers
document.getElementById("btn-leaderboard-mobile").addEventListener("click", () => {
  audio.playClick();
  document.getElementById("leaderboard-panel").classList.add("show-modal");
  document.getElementById("lb-overlay").classList.add("show-overlay");
});

document.getElementById("lb-close-btn").addEventListener("click", () => {
  audio.playClick();
  document.getElementById("leaderboard-panel").classList.remove("show-modal");
  document.getElementById("lb-overlay").classList.remove("show-overlay");
});

document.getElementById("lb-overlay").addEventListener("click", () => {
  document.getElementById("leaderboard-panel").classList.remove("show-modal");
  document.getElementById("lb-overlay").classList.remove("show-overlay");
});

document.getElementById("btn-play").addEventListener("click", () => {
  audio.playClick();
  // Start from the latest unlocked level
  const startIdx = saveData.unlockedLevel - 1;
  startLevel(startIdx);
});

document.getElementById("btn-levels").addEventListener("click", () => {
  audio.playClick();
  // Auto-jump to the page holding the latest unlocked level
  currentLevelPage = Math.floor(Math.max(0, saveData.unlockedLevel - 1) / 10);
  buildLevelSelect();
  showScreen(levelSelectScreen);
});

document.getElementById("btn-back-menu").addEventListener("click", () => {
  audio.playClick();
  showScreen(menuScreen);
  fetchLeaderboard();
});

// Pagination event listeners
document.getElementById("btn-page-prev").addEventListener("click", () => {
  if (currentLevelPage > 0) {
    audio.playClick();
    currentLevelPage--;
    buildLevelSelect();
  }
});

document.getElementById("btn-page-next").addEventListener("click", () => {
  const maxUnlockedPage = Math.floor(saveData.unlockedLevel / 10);
  if (currentLevelPage < maxUnlockedPage) {
    audio.playClick();
    currentLevelPage++;
    buildLevelSelect();
  }
});

document.getElementById("btn-restart").addEventListener("click", () => {
  audio.playClick();
  startLevel(currentLevelIndex);
});



document.getElementById("btn-menu-return").addEventListener("click", () => {
  audio.playClick();
  currentState = State.MENU;
  input.disable();
  showHUD(false);
  ballRenderer.setVisible(false);
  showScreen(menuScreen);
  fetchLeaderboard();
});

document.getElementById("btn-next").addEventListener("click", () => {
  audio.playClick();
  startLevel(currentLevelIndex + 1); // Always go to next since it's infinite!
});

document.getElementById("btn-win-menu").addEventListener("click", () => {
  audio.playClick();
  currentState = State.MENU;
  input.disable();
  showHUD(false);
  ballRenderer.setVisible(false);
  showScreen(menuScreen);
  fetchLeaderboard();
});

document.getElementById("btn-replay").addEventListener("click", () => {
  audio.playClick();
  startLevel(currentLevelIndex);
});

document.getElementById("btn-retry").addEventListener("click", () => {
  audio.playClick();
  startLevel(currentLevelIndex);
});

document.getElementById("btn-stuck-menu").addEventListener("click", () => {
  audio.playClick();
  showScreen(menuScreen);
  showHUD(false);
  ballRenderer.setVisible(false);
  fetchLeaderboard();
});

// ============================================
// RENDER LOOP
// ============================================

let lastTime = 0;

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  const time = timestamp / 1000;

  // Idle animation for ball
  if (currentState === State.PLAYING) {
    ballRenderer.updateIdle(time);
  }

  // Update particles
  particleSystem.update();

  // Update camera
  sceneSetup.updateCamera(dt);

  // Render
  sceneSetup.render();
}

// ============================================
// INIT
// ============================================

function init() {
  // Hide ball initially
  ballRenderer.setVisible(false);

  // Start menu scene — show a distant maze preview
  const previewLevel = LEVELS[0];
  mazeRenderer.buildMaze(previewLevel.grid, previewLevel.colors);
  sceneSetup.frameMaze(previewLevel.grid.length, previewLevel.grid[0].length);

  // Paint some tiles for visual interest
  for (let r = 0; r < previewLevel.grid.length; r++) {
    for (let c = 0; c < previewLevel.grid[0].length; c++) {
      if (previewLevel.grid[r][c] === CELL.EMPTY && Math.random() > 0.5) {
        mazeRenderer.paintTile(r, c, previewLevel.colors, Math.random() * 1000);
      }
    }
  }

  // Start render loop
  requestAnimationFrame(gameLoop);

  // Show menu
  showScreen(menuScreen);
  showHUD(false);

  // Load leaderboard
  fetchLeaderboard();
}

init();
