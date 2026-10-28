// Fish Tanks web Daily Tank: the app's Daily board and rules in a page (no install needed).
// The rules mirror Assets/Scripts/Core (Water.cs, Session.cs, Scoring.cs, Daily.cs); check.html
// plays every pool board's answer through this file to confirm they agree.
(function () {
  "use strict";

  // Before launch the result card invites people to join the testers; flip once the game is public.
  var STORE_IS_LIVE = false;
  var TESTERS_LINK = "https://play.google.com/apps/testing/com.starladdergames.fishtanks";
  var STORE_LINK = "https://play.google.com/store/apps/details?id=com.starladdergames.fishtanks";
  var SHARE_LINK = "wordclimb.github.io/fishtanks";

  var Board = FT.Board, dayNumber = FT.dayNumber, poolIndex = FT.poolIndex, clock = FT.clock, grade = FT.grade, emojiRow = FT.emojiRow;

  // ── Storage (best effort: private windows may refuse) ──────────────────
  function load(key, fallback) {
    try {
      var text = window.localStorage.getItem(key);
      return text ? JSON.parse(text) : fallback;
    } catch (e) { return fallback; }
  }

  function store(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* not kept: fine */ }
  }

  // ── The session (Core/Session.cs, Daily mode) ─────────────────────────
  var pool = JSON.parse(atob(FT_DATA.pool));
  var today = dayNumber(new Date());
  var board = new Board(pool[poolIndex(today, pool.length)]);
  var saveKey = "ft-day-" + today;
  var state = load(saveKey, null);
  if (!state || !state.levels || state.levels.length !== board.tanks.length) {
    state = { levels: board.emptyLevels(), marks: new Array(board.n * board.n).fill(false), taps: 0, log: [], history: [], seconds: 0, hint: false, done: null };
  }
  function setLevel(tank, level, clearedMarks) {
    if (state.levels[tank] === level) return;
    state.levels[tank] = level;
    state.log.forEach(function (entry) { if (entry[0] === tank) entry[2] = 1; });
    if (clearedMarks) {
      board.tanks[tank].cells.forEach(function (cell) {
        if (state.marks[cell] && Math.floor(cell / board.n) >= level) {
          state.marks[cell] = false;
          clearedMarks.push(cell);
        }
      });
    }
  }

  function tap(r, c) {
    if (state.done) return;
    var tank = board.tankAt(r, c);
    var to = board.tapLevel(state.levels, r, c);
    var entry = { k: "tap", t: tank, f: state.levels[tank], to: to, off: [], on: [] };
    setLevel(tank, to, entry.off);
    state.history.push(entry);
    state.taps++;
    state.log.push([tank, to, 0]);
    changed(true);
  }

  function undo() {
    if (state.done || state.history.length === 0) return;
    var e = state.history.pop();
    if (e.k === "tap") setLevel(e.t, e.f, null);
    if (e.k === "restart") e.old.forEach(function (level, tank) { setLevel(tank, level, null); });
    e.on.forEach(function (cell) { state.marks[cell] = false; });
    e.off.forEach(function (cell) { state.marks[cell] = true; });
    changed(false);
  }

  function restart() {
    if (state.done) return;
    var entry = { k: "restart", old: state.levels.slice(), off: [], on: [] };
    for (var t = 0; t < state.levels.length; t++) setLevel(t, board.n, null);
    state.marks.forEach(function (m, cell) { if (m) { state.marks[cell] = false; entry.off.push(cell); } });
    state.history.push(entry);
    changed(false);
  }

  // ── The share card (Core/Scoring.cs: ShareCard) ──────────────────────
  function streak() {
    var played = load("ft-played", []);
    var day = played.indexOf(today) >= 0 ? today : today - 1, count = 0;
    while (played.indexOf(day) >= 0) { count++; day--; }
    return count;
  }

  function shareText(done) {
    var lines = ["Fish Tanks #" + today + " 🐟 " + done.taps + "/" + done.par + " taps · " + clock(done.seconds) + (done.hint ? " ⚡" : "")];
    if (done.emoji) lines.push(done.emoji);
    var s = streak();
    if (s > 0) lines.push("🔥 Streak " + s + " · Best " + Math.max(s, load("ft-best", 0)));
    lines.push(SHARE_LINK);
    return lines.join("\n");
  }

  // ── Drawing ───────────────────────────────────────────────────────────
  var boardEl = document.getElementById("board");
  var cellEls = [], numberEls = [];

  /** The app's own fish (Blender models, exported by Tools/web_daily_build.py). */
  function fishImg(index, flip) {
    return '<img class="fish' + (flip ? " flip" : "") + '" src="fish/fish' + index + '.png" alt="" draggable="false">';
  }

  function build() {
    var n = board.n;
    boardEl.style.setProperty("--n", n);
    boardEl.innerHTML = "";
    boardEl.appendChild(document.createElement("div")); // the corner
    for (var c = 0; c < n; c++) {
      var col = document.createElement("div");
      col.className = "num col";
      boardEl.appendChild(col);
      numberEls[n + c] = col;
    }
    for (var r = 0; r < n; r++) {
      var row = document.createElement("div");
      row.className = "num row";
      boardEl.appendChild(row);
      numberEls[r] = row;
      for (c = 0; c < n; c++) {
        var cell = document.createElement("div");
        var id = board.tankAt(r, c);
        var walls = [];
        var w = "var(--wall)";
        if (r === 0 || board.tankAt(r - 1, c) !== id) walls.push("inset 0 var(--ww) 0 " + w);
        if (r === n - 1 || board.tankAt(r + 1, c) !== id) walls.push("inset 0 calc(-1 * var(--ww)) 0 " + w);
        if (c === 0 || board.tankAt(r, c - 1) !== id) walls.push("inset var(--ww) 0 0 " + w);
        if (c === n - 1 || board.tankAt(r, c + 1) !== id) walls.push("inset calc(-1 * var(--ww)) 0 0 " + w);
        cell.className = "cell" + (r === n - 1 || board.tankAt(r + 1, c) !== id ? " floor" : "");
        cell.style.boxShadow = walls.join(",");
        cell.dataset.cell = r * n + c;
        boardEl.appendChild(cell);
        cellEls[r * n + c] = cell;
      }
    }
    for (var line = 0; line < 2 * n; line++) {
      var number = board.lineNumber(line);
      numberEls[line].textContent = number === null ? "?" : number;
    }
  }

  function draw() {
    var n = board.n, levels = state.levels;
    var done = [];
    for (var line = 0; line < 2 * n; line++) {
      var s = board.lineState(levels, line);
      numberEls[line].className = "num " + (line < n ? "row " : "col ") + (s === "hidden" ? "unknown" : s);
      done[line] = s === "done";
    }
    for (var cell = 0; cell < n * n; cell++) {
      var r = Math.floor(cell / n), c = cell % n, el = cellEls[cell];
      var water = board.isWater(levels, cell);
      var tank = board.owner[cell];
      var surface = water && levels[tank] === r;
      el.classList.toggle("water", water);
      el.classList.toggle("surface", surface);
      var firstSurface = surface && (c === 0 || board.tankAt(r, c - 1) !== tank || levels[tank] !== r);
      var html = firstSurface ? fishImg(tank % 4, tank % 2 === 1) : "";
      if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    }
    document.getElementById("taps").textContent = state.taps + (state.taps === 1 ? " tap" : " taps");
    document.getElementById("undoBtn").disabled = !!state.done || state.history.length === 0;
    document.getElementById("resultsBtn").classList.toggle("hidden", !state.done);
  }

  function changed(tapped) {
    if (!state.done && board.solved(state.levels)) win();
    store(saveKey, state);
    draw();
    if (tapped && navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* fine */ } }
  }

  function win() {
    var done = { taps: state.taps, par: board.par, seconds: state.seconds, hint: false, emoji: emojiRow(state.log) };
    done.grade = grade(done.taps, done.par, done.hint);
    state.done = done;
    var played = load("ft-played", []);
    if (played.indexOf(today) < 0) { played.push(today); store("ft-played", played.slice(-400)); }
    store("ft-best", Math.max(load("ft-best", 0), streak()));
    boardEl.classList.add("won");
    setTimeout(showResult, 900);
  }

  // ── Result, help, share ───────────────────────────────────────────────
  function showResult() {
    var d = state.done;
    if (!d) return;
    document.getElementById("resultDay").textContent = "Daily Tank #" + today;
    document.getElementById("resultTitle").textContent = d.grade + "!";
    document.getElementById("statTaps").textContent = d.taps + "/" + d.par;
    document.getElementById("statTime").textContent = clock(d.seconds);
    document.getElementById("statStreak").textContent = streak();
    var dots = document.getElementById("resultDots");
    dots.innerHTML = "";
    state.log.slice(0, 15).forEach(function (entry) {
      var dot = document.createElement("span");
      dot.className = entry[2] ? "dot changed" : "dot";
      dots.appendChild(dot);
    });
    var app = document.getElementById("getApp");
    app.href = STORE_IS_LIVE ? STORE_LINK : TESTERS_LINK;
    app.textContent = STORE_IS_LIVE ? "Get Fish Tanks on Google Play" : "Play more on Android";
    document.getElementById("ctaNote").classList.toggle("hidden", STORE_IS_LIVE);
    open("resultModal");
    tickNext();
  }

  function tickNext() {
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var left = Math.max(0, Math.floor((next - now) / 1000));
    document.getElementById("nextIn").textContent = "Next tank in " + clock(left).replace(/^(\d):/, "0$1:");
  }

  function open(id) { document.getElementById(id).classList.remove("hidden"); }
  function close(id) { document.getElementById(id).classList.add("hidden"); }

  function toast(text) {
    var t = document.getElementById("toast");
    t.textContent = text;
    t.classList.remove("hidden");
    setTimeout(function () { t.classList.add("hidden"); }, 1600);
  }

  function share() {
    var text = shareText(state.done);
    if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      navigator.share({ text: text }).catch(function () { /* cancelled */ });
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast("Copied! Paste it anywhere."); }, function () { toast(text); });
    } else {
      toast(text);
    }
  }

  // ── Input: a tap (down and up on the same square) moves the water ─
  var down = null;

  function cellFrom(event) {
    var el = document.elementFromPoint(event.clientX, event.clientY);
    while (el && el !== boardEl && !(el.dataset && el.dataset.cell !== undefined)) el = el.parentElement;
    return el && el.dataset && el.dataset.cell !== undefined ? +el.dataset.cell : -1;
  }

  boardEl.addEventListener("pointerdown", function (e) {
    var cell = cellFrom(e);
    if (cell < 0 || state.done) return;
    e.preventDefault();
    down = { cell: cell };
  });

  window.addEventListener("pointerup", function (e) {
    if (!down) return;
    var cell = cellFrom(e);
    if (cell === down.cell) tap(Math.floor(cell / board.n), cell % board.n);
    down = null;
  });

  document.getElementById("undoBtn").onclick = undo;
  document.getElementById("restartBtn").onclick = function () { if (!state.done && confirm("Start over? Your taps and time keep counting.")) restart(); };
  document.getElementById("helpBtn").onclick = function () { open("helpModal"); };
  document.getElementById("helpClose").onclick = function () { close("helpModal"); store("ft-seen-help", true); };
  document.getElementById("resultsBtn").onclick = showResult;
  document.getElementById("resultClose").onclick = function () { close("resultModal"); };
  document.getElementById("shareBtn").onclick = share;

  // ── The clock: counts while the page is visible and the board unsolved ─
  var last = Date.now();
  setInterval(function () {
    var now = Date.now();
    var dt = Math.min(1, (now - last) / 1000);
    last = now;
    var reading = !document.getElementById("helpModal").classList.contains("hidden");
    if (!state.done && !document.hidden && !reading) {
      state.seconds += dt;
      document.getElementById("clock").textContent = clock(state.seconds);
      if (Math.floor(state.seconds) % 5 === 0) store(saveKey, state);
    }
    if (!document.getElementById("resultModal").classList.contains("hidden")) tickNext();
  }, 250);

  document.getElementById("dayLabel").textContent = "Daily Tank #" + today;
  document.getElementById("clock").textContent = clock(state.seconds);
  build();
  draw();
  if (state.done) { boardEl.classList.add("won"); showResult(); }
  else if (!load("ft-seen-help", false)) open("helpModal");

})();
