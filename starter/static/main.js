// Client-side rendering and interaction for the Flask-backed Sudoku
const SIZE = 9;
let puzzle = [];
// Timer state (client-side only)
let _timerIntervalId = null;
let _timerStartMs = null;
let _elapsedSeconds = 0;
let _timerRunning = false;
// Scoreboard and game state
const SCORE_KEY = 'sudoku_top_scores_v1';
let _hintsUsed = 0;
let _scoreRecorded = false;

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

function updateTimerDisplay() {
  const el = document.getElementById('timer');
  if (!el) return;
  if (_timerRunning && _timerStartMs !== null) {
    const now = Date.now();
    _elapsedSeconds = Math.floor((now - _timerStartMs) / 1000);
  }
  el.innerText = formatTime(_elapsedSeconds);
}

function startTimer() {
  // ensure previous interval cleared
  stopTimer();
  _timerStartMs = Date.now() - (_elapsedSeconds * 1000);
  _timerRunning = true;
  updateTimerDisplay();
  _timerIntervalId = setInterval(updateTimerDisplay, 250);
}

function stopTimer() {
  if (_timerIntervalId !== null) {
    clearInterval(_timerIntervalId);
    _timerIntervalId = null;
  }
  if (_timerRunning && _timerStartMs !== null) {
    _elapsedSeconds = Math.floor((Date.now() - _timerStartMs) / 1000);
  }
  _timerRunning = false;
  _timerStartMs = null;
  updateTimerDisplay();
}

function resetTimer() {
  stopTimer();
  _elapsedSeconds = 0;
  updateTimerDisplay();
}

// --- Scoreboard helpers ---
function validateScore(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.timeSeconds !== 'number' || !Number.isFinite(obj.timeSeconds) || obj.timeSeconds < 0) return false;
  if (typeof obj.difficulty !== 'string') return false;
  if (typeof obj.hintsUsed !== 'number' || !Number.isInteger(obj.hintsUsed) || obj.hintsUsed < 0) return false;
  return true;
}

function loadScores() {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(validateScore);
  } catch (e) {
    return [];
  }
}

function saveScores(scores) {
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
  } catch (e) {
    // ignore localStorage failures
  }
}

function addScore(score) {
  if (!validateScore(score)) return;
  const scores = loadScores();
  scores.push(score);
  scores.sort((a, b) => a.timeSeconds - b.timeSeconds);
  const top = scores.slice(0, 10);
  saveScores(top);
  renderScoreboard();
}

function difficultyFromPuzzle(puz) {
  const clues = puz.flat().filter(v => v !== 0).length;
  if (clues === 45) return 'easy';
  if (clues === 35) return 'medium';
  if (clues === 28) return 'hard';
  return 'custom';
}

function renderScoreboard() {
  const container = document.getElementById('scoreboard');
  if (!container) return;
  const scores = loadScores();
  container.innerHTML = '';
  const title = document.createElement('h2');
  title.innerText = 'Top 10 Scores';
  container.appendChild(title);

  if (scores.length === 0) {
    const p = document.createElement('p');
    p.innerText = 'No top scores yet — finish a game to appear here.';
    container.appendChild(p);
    return;
  }

  const table = document.createElement('table');
  table.className = 'scoreboard-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>#</th><th>Name</th><th>Time</th><th>Difficulty</th><th>Hints</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  scores.forEach((s, i) => {
    const tr = document.createElement('tr');
    const tdRank = document.createElement('td'); tdRank.innerText = String(i + 1);
    const tdName = document.createElement('td'); tdName.innerText = s.name;
    const tdTime = document.createElement('td'); tdTime.innerText = formatTime(Math.floor(s.timeSeconds));
    const tdDiff = document.createElement('td'); tdDiff.innerText = s.difficulty;
    const tdHints = document.createElement('td'); tdHints.innerText = String(s.hintsUsed);
    tr.appendChild(tdRank);
    tr.appendChild(tdName);
    tr.appendChild(tdTime);
    tr.appendChild(tdDiff);
    tr.appendChild(tdHints);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  boardDiv.innerHTML = '';
  for (let i = 0; i < SIZE; i++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'sudoku-row';
    for (let j = 0; j < SIZE; j++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = 'sudoku-cell';
      input.dataset.row = i;
      input.dataset.col = j;
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^1-9]/g, '');
        e.target.value = val;
      });
      rowDiv.appendChild(input);
    }
    boardDiv.appendChild(rowDiv);
  }
}

function renderPuzzle(puz) {
  puzzle = puz;
  createBoardElement();
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = puzzle[i][j];
      const inp = inputs[idx];
      if (val !== 0) {
        inp.value = val;
        inp.disabled = true;
        inp.className += ' prefilled';
      } else {
        inp.value = '';
        inp.disabled = false;
      }
    }
  }
}

async function newGame() {
  const res = await fetch('/new');
  const data = await res.json();
  renderPuzzle(data.puzzle);
  document.getElementById('message').innerText = '';
  // Timer: reset and start whenever a new puzzle is loaded
  resetTimer();
  startTimer();
  // reset per-game score state
  _hintsUsed = 0;
  _scoreRecorded = false;
  renderScoreboard();
}

async function checkSolution() {
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  const board = [];
  for (let i = 0; i < SIZE; i++) {
    board[i] = [];
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = inputs[idx].value;
      board[i][j] = val ? parseInt(val, 10) : 0;
    }
  }
  const res = await fetch('/check', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({board})
  });
  const data = await res.json();
  const msg = document.getElementById('message');
  if (data.error) {
    msg.style.color = '#d32f2f';
    msg.innerText = data.error;
    return;
  }
  const incorrect = new Set(data.incorrect.map(x => x[0]*SIZE + x[1]));
  for (let idx = 0; idx < inputs.length; idx++) {
    const inp = inputs[idx];
    if (inp.disabled) continue;
    inp.className = 'sudoku-cell';
    if (incorrect.has(idx)) {
      inp.className = 'sudoku-cell incorrect';
    }
  }
  if (incorrect.size === 0) {
    msg.style.color = '#388e3c';
    msg.innerText = 'Congratulations! You solved it!';
    // Stop the timer once the puzzle is correctly completed
    stopTimer();
    // Record score once per completed game
    if (!_scoreRecorded) {
      _scoreRecorded = true;
      const name = (prompt('You solved it! Enter your name for the Top 10 scoreboard:') || '').trim() || 'Anonymous';
      const difficulty = difficultyFromPuzzle(puzzle);
      const score = {
        name,
        timeSeconds: Math.floor(_elapsedSeconds),
        difficulty,
        hintsUsed: Number.isInteger(_hintsUsed) ? _hintsUsed : 0,
      };
      addScore(score);
    }
  } else {
    msg.style.color = '#d32f2f';
    msg.innerText = 'Some cells are incorrect.';
  }
}

// Wire buttons
window.addEventListener('load', () => {
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  // initialize
  newGame();
  renderScoreboard();
});