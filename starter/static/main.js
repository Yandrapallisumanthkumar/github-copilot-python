// Client-side rendering and interaction for the Flask-backed Sudoku
const SIZE = 9;
let puzzle = [];
// Theme
const THEME_KEY = 'sudoku-theme';
(function applySavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    let theme = saved;
    if (!theme) {
      theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // ignore storage errors
  }
})();

// track selected difficulty (capitalized)
if (typeof window._selectedDifficulty === 'undefined') window._selectedDifficulty = 'Medium';

function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  boardDiv.innerHTML = '';
  // track currently selected empty cell
  if (typeof window._selectedCell === 'undefined') window._selectedCell = null;
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
      // mark 3x3 block for styling (block-0 .. block-8)
      const blockIndex = Math.floor(i/3) * 3 + Math.floor(j/3);
      input.dataset.block = String(blockIndex);
      input.classList.add((blockIndex % 2) === 0 ? 'block-even' : 'block-odd');
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^1-9]/g, '');
        e.target.value = val;
      });
      // selection handling: only allow selecting empty, enabled cells
      input.addEventListener('click', (e) => {
        const tgt = e.currentTarget;
        // do not select disabled or prefilled cells
        if (tgt.disabled || tgt.classList.contains('prefilled')) return;
        // if cell has a value (already filled by player), treat as selectable only if empty
        if (tgt.value && tgt.value.trim() !== '') return;
        // clear previous selection
        if (window._selectedCell && window._selectedCell.el) {
          window._selectedCell.el.classList.remove('selected');
        }
        // set new selection
        tgt.classList.add('selected');
        window._selectedCell = {row: Number(tgt.dataset.row), col: Number(tgt.dataset.col), el: tgt};
        const msg = document.getElementById('message');
        if (msg) msg.innerText = '';
      });
      rowDiv.appendChild(input);
    }
    boardDiv.appendChild(rowDiv);
  }
}
function renderPuzzle(puz) {
  puzzle = puz;
  createBoardElement();
  // apply difficulty accent class to board and keep selected difficulty
  const diffEl = document.getElementById('difficulty-select');
  const boardDiv = document.getElementById('sudoku-board');
  if (boardDiv) {
    const sel = (diffEl && diffEl.value) ? diffEl.value.toLowerCase() : (window._selectedDifficulty || 'Medium').toLowerCase();
    boardDiv.classList.remove('diff-easy', 'diff-medium', 'diff-hard');
    if (sel === 'easy') boardDiv.classList.add('diff-easy');
    else if (sel === 'hard') boardDiv.classList.add('diff-hard');
    else boardDiv.classList.add('diff-medium');
    window._selectedDifficulty = sel.charAt(0).toUpperCase() + sel.slice(1);
  }
  const inputs = boardDiv.getElementsByTagName('input');
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = puzzle[i][j];
      const inp = inputs[idx];
      if (val !== 0) {
        inp.value = val;
        inp.disabled = true;
        inp.classList.add('prefilled');
      } else {
        inp.value = '';
        inp.disabled = false;
        inp.classList.remove('prefilled', 'incorrect');
      }
    }
  }
}

async function newGame() {
  const diffEl = document.getElementById('difficulty-select');
  const difficulty = diffEl ? diffEl.value : undefined;
  // Store selected difficulty in active client game state immediately
  try {
    if (diffEl && diffEl.value) {
      window._selectedDifficulty = diffEl.value.charAt(0).toUpperCase() + diffEl.value.slice(1);
    }
  } catch (e) {}
  const url = difficulty ? `/new?difficulty=${encodeURIComponent(difficulty)}` : '/new';
  const res = await fetch(url);
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

// Minimal timer and scoreboard state/helpers (keeps UI functional)
var _elapsedSeconds = 0;
var _timerInterval = null;
var _hintsUsed = 0;
var _scoreRecorded = false;

function startTimer() {
  stopTimer();
  _timerInterval = setInterval(() => {
    _elapsedSeconds += 1;
    const m = String(Math.floor(_elapsedSeconds / 60)).padStart(2, '0');
    const s = String(_elapsedSeconds % 60).padStart(2, '0');
    const el = document.getElementById('timer');
    if (el) el.innerText = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
}

function resetTimer() {
  stopTimer();
  _elapsedSeconds = 0;
  const el = document.getElementById('timer');
  if (el) el.innerText = '00:00';
}

function difficultyFromPuzzle(_p) {
  return 'Unknown';
}

const SCORE_KEY = 'sudoku_top_scores_v1';
const LEGACY_SCORE_KEY = 'sudoku-scores';

function formatTimeMMSS(totalSeconds) {
  const secs = Number(totalSeconds) || 0;
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function getScores() {
  try {
    // Prefer canonical key
    const raw = localStorage.getItem(SCORE_KEY);
    if (raw) return JSON.parse(raw);
    // Migrate legacy key if present
    const legacy = localStorage.getItem(LEGACY_SCORE_KEY);
    if (legacy) {
      const arr = JSON.parse(legacy || '[]');
      try { localStorage.setItem(SCORE_KEY, JSON.stringify(arr)); } catch (e) {}
      try { localStorage.removeItem(LEGACY_SCORE_KEY); } catch (e) {}
      return arr;
    }
  } catch (e) {
    // fallthrough
  }
  return [];
}

function saveScores(scores) {
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(scores)); } catch (e) {}
}

function addScore(score) {
  try {
    const scores = getScores() || [];
    const normalized = Object.assign({}, score);
    normalized.timeSeconds = Number(normalized.timeSeconds) || 0;
    scores.push(normalized);
    scores.sort((a, b) => (Number(a.timeSeconds) || 0) - (Number(b.timeSeconds) || 0));
    // keep only top 10
    if (scores.length > 10) scores.splice(10);
    saveScores(scores);
    renderScoreboard();
  } catch (e) {
    console.error('Failed to add score', e);
  }
}

function renderScoreboard() {
  const container = document.getElementById('scoreboard');
  if (!container) return;
  const scores = getScores() || [];
  let html = '<h2>Top 10 Fastest Times</h2>';
  html += '<div class="score-table-wrap">';
  html += '<table class="scoreboard-table">';
  html += '<thead><tr><th>Rank</th><th>Name</th><th>Time</th><th>Level</th><th>Hints</th></tr></thead>';
  html += '<tbody>';
  if (!scores || scores.length === 0) {
    html += '<tr><td colspan="5">No scores yet</td></tr>';
  } else {
    for (let idx = 0; idx < scores.length; idx++) {
      const s = scores[idx];
      const rank = idx + 1;
      const name = s.name || 'Anonymous';
      const time = formatTimeMMSS(s.timeSeconds);
        const level = s.difficulty || s.level || 'Unknown';
      const hints = Number(s.hintsUsed) || 0;
      html += `<tr><td>${rank}</td><td>${name}</td><td>${time}</td><td>${level}</td><td>${hints}</td></tr>`;
    }
  }
  html += '</tbody></table></div>';
  container.innerHTML = html;
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
    inp.classList.remove('incorrect');
    if (incorrect.has(idx)) {
      inp.classList.add('incorrect');
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
      // use selected difficulty from UI if present, fallback to difficultyFromPuzzle
      const diffEl = document.getElementById('difficulty-select');
      let difficulty = 'Medium';
      if (diffEl && diffEl.value) {
        // Capitalize
        difficulty = diffEl.value.charAt(0).toUpperCase() + diffEl.value.slice(1);
      } else {
        difficulty = difficultyFromPuzzle(puzzle) || 'Medium';
      }
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
  // Theme toggle wiring
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const iconSpan = document.getElementById('theme-icon');
    const setIcon = (theme) => {
      if (!iconSpan) return;
      if (theme === 'dark') {
        // moon icon
        iconSpan.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>';
        themeToggle.setAttribute('aria-label', 'Switch to light mode');
        themeToggle.title = 'Switch to light mode';
        try {
          const rootPrimary = getComputedStyle(document.documentElement).getPropertyValue('--primary') || '#1976d2';
          iconSpan.style.color = rootPrimary.trim();
        } catch (e) {}
      } else {
        // sun icon
        iconSpan.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10 8h2v-3h-2v3zm7.03-3.21l1.79 1.79 1.79-1.79-1.79-1.79-1.79 1.79zM17.24 4.84l1.79-1.79 1.79 1.79-1.79 1.79-1.79-1.79zM4.22 19.78l1.79-1.79-1.79-1.79L2.43 18l1.79 1.78zM12 6a6 6 0 100 12 6 6 0 000-12z" fill="currentColor"/></svg>';
        themeToggle.setAttribute('aria-label', 'Switch to dark mode');
        themeToggle.title = 'Switch to dark mode';
        try {
          // Sun should appear orange/yellow in light mode
          iconSpan.style.color = '#ffb300';
        } catch (e) {}
      }
    };
    const updateIcon = () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      setIcon(cur);
    };
    themeToggle.addEventListener('click', () => {
      try {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
        updateIcon();
      } catch (e) {
        // ignore
      }
    });
    updateIcon();
  }
  // Hint button wiring
  const hintBtn = document.getElementById('hint-button');
  if (hintBtn) {
    hintBtn.addEventListener('click', async () => {
      try {
        // Ensure a cell is selected
        const sel = window._selectedCell;
        const msg = document.getElementById('message');
        if (!sel || !sel.el) {
          if (msg) {
            msg.style.color = '#d32f2f';
            msg.innerText = 'Please select an empty cell first.';
          }
          return;
        }
        const absolute = '/hint';
        const relative = new URL('hint', window.location.href).href;
        const body = JSON.stringify({row: sel.row, col: sel.col});
        console.debug('Requesting hint for selected cell', sel.row, sel.col);
        let res = await fetch(absolute, {method: 'POST', headers: {'Content-Type': 'application/json'}, body}).catch(e => {
          console.debug('Absolute /hint request failed:', e);
          return null;
        });
        if (res && res.status === 404) {
          console.debug('Absolute /hint returned 404, trying relative URL:', relative);
          res = await fetch(relative, {method: 'POST'}).catch(e => {
            console.debug('Relative hint request failed:', e);
            return null;
          });
        }
        if (!res) {
          const msg = document.getElementById('message');
          if (msg) {
            msg.style.color = '#d32f2f';
            msg.innerText = 'Hint request failed (network)';
          }
          console.error('Both absolute and relative hint requests failed');
          return;
        }
        // Try to parse JSON only if content-type is JSON; otherwise read text
        let data = null;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            data = await res.json();
          } catch (e) {
            console.error('Failed to parse /hint response as JSON', e);
            const text = await res.text().catch(() => '');
            const msg = document.getElementById('message');
            if (msg) {
              msg.style.color = '#d32f2f';
              msg.innerText = text || 'Unexpected response from server';
            }
            return;
          }
        } else {
          // non-JSON response
          const text = await res.text().catch(() => '');
          console.error('Non-JSON /hint response', res.status, text);
          const msg = document.getElementById('message');
          if (msg) {
            msg.style.color = '#d32f2f';
            // show a short excerpt rather than dumping full HTML
            msg.innerText = (text && text.slice(0, 300) + (text.length > 300 ? '…' : '')) || 'Unexpected response from server';
          }
          return;
        }

        if (!res.ok) {
          console.error('Hint request failed', res.status, data);
          const msg = document.getElementById('message');
          if (msg) {
            msg.style.color = '#d32f2f';
            msg.innerText = (data && (data.error || data.details)) || 'Hint failed';
          }
          return;
        }
        const {row, col, value} = data;
        if (typeof row !== 'number' || typeof col !== 'number') {
          console.error('Invalid hint payload', data);
          return;
        }
        const boardDiv = document.getElementById('sudoku-board');
        if (!boardDiv) {
          console.error('Board element not found when applying hint');
          return;
        }
        // Find the exact input by its data-row and data-col attributes
        const inpSelector = `input[data-row="${row}"][data-col="${col}"]`;
        const inp = boardDiv.querySelector(inpSelector);
        if (!inp) {
          console.error('Could not find input for', inpSelector);
          return;
        }
        const idx = row * SIZE + col;
        console.debug('Applying hint to idx,row,col,value:', idx, row, col, value, 'inputFound=', !!inp);
        if (inp) {
          console.debug('before value:', inp.value);
          inp.value = String(value);
          inp.setAttribute('value', String(value));
          inp.disabled = true;
          inp.classList.add('prefilled');
          // ensure hinted value is visible regardless of theme/block bg
          try {
            const rootStyles = getComputedStyle(document.documentElement);
            const textColor = rootStyles.getPropertyValue('--text') || '';
            const prefilledBg = rootStyles.getPropertyValue('--prefilled-bg') || '';
            if (textColor) inp.style.color = textColor.trim();
            if (prefilledBg) inp.style.background = prefilledBg.trim();
            inp.style.fontWeight = '700';
          } catch (e) {
            // ignore styling errors
          }
          // notify any listeners of the programmatic change
          try { inp.dispatchEvent(new Event('input', {bubbles: true})); } catch (e) {}
          console.debug('after value:', inp.value, 'disabled=', inp.disabled);
        }
        // update client-side puzzle model so future hints don't reuse same cell
        try {
          if (Array.isArray(puzzle) && Array.isArray(puzzle[row])) {
            puzzle[row][col] = value;
          }
        } catch (e) {
          console.error('Failed to update client puzzle state', e);
        }
        // increment hint counter used by scoring
        if (Number.isInteger(_hintsUsed)) _hintsUsed += 1;
        // clear selection highlight
        try {
          if (window._selectedCell && window._selectedCell.el) {
            window._selectedCell.el.classList.remove('selected');
          }
        } catch (e) {}
        window._selectedCell = null;
        if (msg) {
          msg.style.color = '#388e3c';
          msg.innerText = 'Hint applied';
        }
      } catch (e) {
        console.error('Network error while requesting hint', e);
        const msg = document.getElementById('message');
        if (msg) {
          msg.style.color = '#d32f2f';
          msg.innerText = 'Network error requesting hint';
        }
      }
    });
  }
  // difficulty select change -> update selected difficulty and board accent
  const diffSel = document.getElementById('difficulty-select');
  if (diffSel) {
    const setSelectClass = (el, v) => {
      try {
        el.classList.remove('easy', 'medium', 'hard');
        const cls = (v || '').toLowerCase();
        if (cls === 'easy' || cls === 'medium' || cls === 'hard') el.classList.add(cls);
      } catch (e) {}
    };
    diffSel.addEventListener('change', (e) => {
      const v = e.target.value || 'Medium';
      window._selectedDifficulty = v.charAt(0).toUpperCase() + v.slice(1);
      // style the select to reflect difficulty
      setSelectClass(diffSel, v);
      // re-render board accent
      const boardDiv = document.getElementById('sudoku-board');
      if (boardDiv) {
        boardDiv.classList.remove('diff-easy', 'diff-medium', 'diff-hard');
        const sel = v.toLowerCase();
        if (sel === 'easy') boardDiv.classList.add('diff-easy');
        else if (sel === 'hard') boardDiv.classList.add('diff-hard');
        else boardDiv.classList.add('diff-medium');
      }
    });
  }
  // initialize
  // ensure difficulty select shows current selection styling
  try {
    const _initSel = document.getElementById('difficulty-select');
    if (_initSel) {
      _initSel.classList.remove('easy', 'medium', 'hard');
      const vv = _initSel.value || 'medium';
      _initSel.classList.add(vv.toLowerCase());
      window._selectedDifficulty = vv.charAt(0).toUpperCase() + vv.slice(1);
    }
  } catch (e) {}
  newGame();
  renderScoreboard();
});