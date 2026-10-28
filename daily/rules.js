// Fish Tanks web rules: the board, water and calendar rules of the app (Assets/Scripts/Core:
// Board.cs, Water.cs, Daily.cs, Scoring.cs), shared by the Daily page and check.html.
(function () {
  "use strict";
  var GREAT_SLACK = 3;

  // ── The board and its rules (Core/Board.cs, Core/Water.cs) ────────────
  function letterIndex(ch) {
    var code = ch.charCodeAt(0);
    return code >= 97 ? code - 97 : code - 65 + 26;
  }

  function Board(day) {
    var rows = day.t.split("/");
    this.n = day.s;
    this.rows = day.r;
    this.cols = day.c;
    this.par = day.p;
    this.owner = [];
    this.tanks = [];
    for (var r = 0; r < this.n; r++) {
      for (var c = 0; c < this.n; c++) {
        var id = letterIndex(rows[r][c]);
        this.owner.push(id);
        if (!this.tanks[id]) this.tanks[id] = { id: id, cells: [], top: r, bottom: r };
        var t = this.tanks[id];
        t.cells.push(r * this.n + c);
        t.top = Math.min(t.top, r);
        t.bottom = Math.max(t.bottom, r);
      }
    }
  }

  Board.prototype.empty = function () { return this.n; };
  Board.prototype.tankAt = function (r, c) { return this.owner[r * this.n + c]; };
  Board.prototype.isWater = function (levels, cell) { return Math.floor(cell / this.n) >= levels[this.owner[cell]]; };
  Board.prototype.lineNumber = function (line) { return line < this.n ? this.rows[line] : this.cols[line - this.n]; };
  Board.prototype.lineCells = function (line) {
    var out = [], n = this.n;
    for (var k = 0; k < n; k++) out.push(line < n ? line * n + k : k * n + (line - n));
    return out;
  };
  Board.prototype.lineCount = function (levels, line) {
    var self = this;
    return this.lineCells(line).filter(function (cell) { return self.isWater(levels, cell); }).length;
  };
  Board.prototype.lineState = function (levels, line) {
    var number = this.lineNumber(line);
    if (number === null || number === undefined) return "hidden";
    var count = this.lineCount(levels, line);
    return count === number ? "done" : count > number ? "over" : "open";
  };
  Board.prototype.solved = function (levels) {
    for (var line = 0; line < 2 * this.n; line++) {
      var state = this.lineState(levels, line);
      if (state === "open" || state === "over") return false;
    }
    return true;
  };
  /** The level a tap gives: the surface row drops one row (or empties from the floor); any other row moves the line there. */
  Board.prototype.tapLevel = function (levels, r, c) {
    var tank = this.tanks[this.tankAt(r, c)];
    if (levels[tank.id] !== r) return r;
    return r < tank.bottom ? r + 1 : this.n;
  };
  Board.prototype.emptyLevels = function () {
    var self = this;
    return this.tanks.map(function () { return self.n; });
  };

  // ── The calendar (Core/Daily.cs): one board per LOCAL date ─────────────
  function localDayIndex(date) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function dayNumber(now) {
    var p = FT_DATA.epoch.split("-");
    var epoch = new Date(+p[0], +p[1] - 1, +p[2]);
    return localDayIndex(now) - localDayIndex(epoch) + 1;
  }

  function poolIndex(number, size) {
    var i = (number - 1) % size;
    return i < 0 ? i + size : i;
  }

  function clock(seconds) {
    var total = Math.max(0, Math.floor(seconds));
    var h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60;
    var two = function (x) { return (x < 10 ? "0" : "") + x; };
    return h > 0 ? h + ":" + two(m) + ":" + two(s) : m + ":" + two(s);
  }

  function grade(taps, par, assisted) {
    if (taps <= par && !assisted) return "Perfect";
    return taps <= par + GREAT_SLACK ? "Great" : "Solved";
  }

  /** One mark per tap: a fish for a tap that set its tank for good, a bubble for one changed later (at the win every tank sits at its answer). */
  function emojiRow(log) {
    var cap = 15, shown = Math.min(cap, log.length), text = "";
    for (var i = 0; i < shown; i++) text += log[i][2] ? "🫧" : "🐟";
    if (log.length > shown) text += " +" + (log.length - shown);
    return text;
  }

  window.FT = { Board: Board, dayNumber: dayNumber, poolIndex: poolIndex, clock: clock, grade: grade, emojiRow: emojiRow };
})();
