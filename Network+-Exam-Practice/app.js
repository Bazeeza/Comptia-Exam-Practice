/*
 * Network+ (N10-009) practice exam simulator.
 * Static, dependency-free. All bank text is rendered with createElement + textContent.
 * No eval, no HTML string sinks, no inline styles. Data is validated as data and frozen.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Constants                                                           */
  /* ------------------------------------------------------------------ */

  var LS_PREFIX = "cep:nplus:";
  var EXAM_CODE = "N10-009";
  var MAX_FILE_CHARS = 2 * 1024 * 1024;
  var TYPES = ["single", "multiple", "order", "match", "subnet"];
  var PBQ_TYPES = ["order", "match", "subnet"];
  var ITEM_KEYS = ["id", "domain", "objective", "type", "difficulty", "stem", "exhibit",
    "options", "selectCount", "data", "answer", "explanation"];
  var SUBNET_COLS = ["network", "prefix", "mask", "first", "last", "broadcast", "hosts"];
  var COL_LABELS = {
    network: "Network address", prefix: "Prefix", mask: "Subnet mask", first: "First usable",
    last: "Last usable", broadcast: "Broadcast", hosts: "Usable hosts"
  };
  var LETTERS = ["A", "B", "C", "D", "E", "F"];
  var NUM_WORDS = { 1: "one", 2: "two", 3: "three" };
  var OBJECTIVE_IDS = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "2.1", "2.2", "2.3", "2.4",
    "3.1", "3.2", "3.3", "3.4", "3.5", "4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "5.4", "5.5"];
  var FALLBACK_DOMAINS = [
    { id: 1, title: "Networking Concepts", weight: 23 },
    { id: 2, title: "Network Implementation", weight: 20 },
    { id: 3, title: "Network Operations", weight: 19 },
    { id: 4, title: "Network Security", weight: 14 },
    { id: 5, title: "Network Troubleshooting", weight: 24 }
  ];
  var CFG = Object.freeze({
    examItems: 90,
    examPbq: 4,
    examSeconds: 90 * 60,
    cut: 0.75,          /* assumed share of points that maps to the passing mark */
    passScore: 720,
    pbqWeight: 3,
    pbqFloor: 0.5,      /* a PBQ under this fraction earns nothing */
    maxAttempts: 50,
    fontLevels: 5
  });

  var ITEM_ID_RE = /^N9-([1-5]\.[1-9])-[0-9]{4}$/;
  var PART_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/;
  var OPTION_ID_RE = /^[a-f]$/;
  var RESERVED_IDS = ["constructor", "prototype", "toString", "valueOf", "hasOwnProperty",
    "isPrototypeOf", "propertyIsEnumerable", "toLocaleString"];
  /* control characters, soft hyphen, zero-width and bidirectional controls */
  var BAD_CHARS = /[\u0000-\u001F\u007F-\u009F­؜​-‏‪-‮⁠-⁩﻿]/;

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function isInt(v, min, max) { return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max; }
  function isNum(v, min, max) { return typeof v === "number" && isFinite(v) && v >= min && v <= max; }
  function $(id) { return document.getElementById(id); }

  function deepFreeze(o) {
    if (o && typeof o === "object" && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function sameArray(a, b) {
    if (a.length !== b.length) { return false; }
    for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) { return false; } }
    return true;
  }

  function isPermutation(a, b) {
    if (!Array.isArray(a) || a.length !== b.length) { return false; }
    var seen = new Set();
    for (var i = 0; i < a.length; i++) {
      if (typeof a[i] !== "string" || b.indexOf(a[i]) < 0 || seen.has(a[i])) { return false; }
      seen.add(a[i]);
    }
    return true;
  }

  function fmtTime(sec) {
    var s = Math.max(0, Math.floor(sec));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function fmtNum(x) { return String(Math.round(x * 100) / 100); }
  function pct(part, whole) { return whole > 0 ? Math.round((part / whole) * 100) : 0; }
  function plain(t) { return String(t).replace(/\*\*|`/g, ""); }
  function isPbq(it) { return PBQ_TYPES.indexOf(it.type) >= 0; }

  /* ------------------------------------------------------------------ */
  /* DOM building (never from HTML strings)                              */
  /* ------------------------------------------------------------------ */

  function append(node, kids) {
    var list = Array.isArray(kids) ? kids : [kids];
    list.forEach(function (c) {
      if (c === null || c === undefined || c === false) { return; }
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) { return; }
        if (k === "class") { node.className = v; }
        else if (k === "text") { node.textContent = String(v); }
        else if (k === "on") { Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); }); }
        else if (k === "style" || /^on/i.test(k)) { throw new Error("Blocked attribute: " + k); }
        else { node.setAttribute(k, v === true ? "" : String(v)); }
      });
    }
    if (kids !== undefined) { append(node, kids); }
    return node;
  }

  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } return node; }

  function emitPlain(parent, s, emphasize) {
    if (!s) { return; }
    if (!emphasize) { parent.appendChild(document.createTextNode(s)); return; }
    var re = /\b(NOT|EXCEPT)\b/g, last = 0, m;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) { parent.appendChild(document.createTextNode(s.slice(last, m.index))); }
      parent.appendChild(el("strong", { text: m[0] }));
      last = m.index + m[0].length;
    }
    if (last < s.length) { parent.appendChild(document.createTextNode(s.slice(last))); }
  }

  /* Tiny formatter: `code` and **bold** only. Everything else stays literal text. */
  function rich(parent, text, emphasize) {
    var s = String(text), i = 0, buf = "", end;
    while (i < s.length) {
      var ch = s.charAt(i);
      if (ch === "`") {
        end = s.indexOf("`", i + 1);
        if (end > i + 1) {
          emitPlain(parent, buf, emphasize); buf = "";
          parent.appendChild(el("code", { text: s.slice(i + 1, end) }));
          i = end + 1;
          continue;
        }
      } else if (ch === "*" && s.charAt(i + 1) === "*") {
        end = s.indexOf("**", i + 2);
        if (end > i + 2) {
          emitPlain(parent, buf, emphasize); buf = "";
          parent.appendChild(el("strong", { text: s.slice(i + 2, end) }));
          i = end + 2;
          continue;
        }
      }
      buf += ch;
      i++;
    }
    emitPlain(parent, buf, emphasize);
    return parent;
  }

  /* ------------------------------------------------------------------ */
  /* localStorage (untrusted: validated on read, never trusted to exist) */
  /* ------------------------------------------------------------------ */

  function lsGet(key) {
    try {
      var raw = window.localStorage.getItem(LS_PREFIX + key);
      if (raw === null || raw.length > 600000) { return null; }
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function lsDel(key) {
    try { window.localStorage.removeItem(LS_PREFIX + key); } catch (e) { /* ignore */ }
  }
  function lsClearAll() {
    try {
      var keys = [];
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (typeof k === "string" && k.indexOf(LS_PREFIX) === 0) { keys.push(k); }
      }
      keys.forEach(function (k2) { window.localStorage.removeItem(k2); });
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  var bank = {
    items: [],
    byId: Object.create(null),
    domains: FALLBACK_DOMAINS,
    objectives: [],
    objTitle: Object.create(null),
    notices: [],
    rejected: 0
  };
  var settings = { font: 1, theme: "auto", timerHidden: false };
  var session = null;        /* attempt in progress */
  var saved = null;          /* validated attempt found in storage, not resumed yet */
  var result = null;         /* last finished attempt (memory only) */
  var view = "loading";
  var tool = null;           /* "h" (highlight) | "s" (strikethrough) | null */
  var tickId = null;
  var lastRemain = null;
  var activeDialog = null;
  var reviewFilter = "all";
  var answersFilter = "all";

  /* ------------------------------------------------------------------ */
  /* Bank validation at load time                                        */
  /* ------------------------------------------------------------------ */

  function fail(msg) { throw new Error(msg); }

  function txt(v, min, max, what) {
    if (typeof v !== "string") { fail(what + " must be a string"); }
    if (v.length < min || v.length > max) { fail(what + " length out of range"); }
    if (BAD_CHARS.test(v)) { fail(what + " contains a forbidden character"); }
    return v;
  }

  function onlyKeys(o, keys, what) {
    if (!isObj(o)) { fail(what + " must be an object"); }
    Object.keys(o).forEach(function (k) {
      if (keys.indexOf(k) < 0) { fail(what + " has an unknown key"); }
    });
  }

  function partId(v, what) {
    if (typeof v !== "string" || !PART_ID_RE.test(v) || RESERVED_IDS.indexOf(v) >= 0) { fail(what + " has an invalid id"); }
    return v;
  }

  function partList(arr, min, max, textKey, what) {
    if (!Array.isArray(arr) || arr.length < min || arr.length > max) { fail(what + " count out of range"); }
    var seen = new Set();
    return arr.map(function (p) {
      onlyKeys(p, ["id", textKey], what + " entry");
      var id = partId(p.id, what);
      if (seen.has(id)) { fail(what + " has a duplicate id"); }
      seen.add(id);
      var out = { id: id };
      out[textKey] = txt(p[textKey], 1, 300, what + " text");
      return out;
    });
  }

  function ids(list) { return list.map(function (p) { return p.id; }); }

  function normItem(raw, fileDomain, seenIds) {
    onlyKeys(raw, ITEM_KEYS, "item");
    var m = typeof raw.id === "string" ? ITEM_ID_RE.exec(raw.id) : null;
    if (!m) { fail("invalid item id"); }
    if (seenIds.has(raw.id)) { fail("duplicate item id"); }
    if (typeof raw.objective !== "string" || OBJECTIVE_IDS.indexOf(raw.objective) < 0) { fail("unknown objective"); }
    if (m[1] !== raw.objective) { fail("id does not match the objective"); }
    if (raw.domain !== fileDomain || String(raw.domain) !== raw.objective.charAt(0)) { fail("domain mismatch"); }
    if (TYPES.indexOf(raw.type) < 0) { fail("unknown type"); }
    if (!isInt(raw.difficulty, 1, 3)) { fail("invalid difficulty"); }

    var it = {
      id: raw.id,
      domain: raw.domain,
      objective: raw.objective,
      type: raw.type,
      difficulty: raw.difficulty,
      stem: txt(raw.stem, 20, 1200, "stem"),
      explanation: txt(raw.explanation, 20, 1500, "explanation"),
      exhibit: null
    };

    if (hasOwn(raw, "exhibit") && raw.exhibit !== null) {
      onlyKeys(raw.exhibit, ["title", "lines"], "exhibit");
      if (!Array.isArray(raw.exhibit.lines) || raw.exhibit.lines.length < 1 || raw.exhibit.lines.length > 40) { fail("exhibit lines count out of range"); }
      it.exhibit = {
        title: txt(raw.exhibit.title, 1, 120, "exhibit title"),
        lines: raw.exhibit.lines.map(function (l) { return txt(l, 0, 120, "exhibit line"); })
      };
    }

    if (!isObj(raw.answer)) { fail("answer must be an object"); }

    if (it.type === "single" || it.type === "multiple") {
      var multi = it.type === "multiple";
      if (hasOwn(raw, "data")) { fail("data is not allowed on a choice item"); }
      if (!Array.isArray(raw.options) || raw.options.length < (multi ? 3 : 2) || raw.options.length > 6) { fail("options count out of range"); }
      var seenOpt = new Set(), seenText = new Set();
      it.options = raw.options.map(function (o) {
        onlyKeys(o, ["id", "text", "why"], "option");
        if (typeof o.id !== "string" || !OPTION_ID_RE.test(o.id) || seenOpt.has(o.id)) { fail("invalid or duplicate option id"); }
        seenOpt.add(o.id);
        var t = txt(o.text, 1, 300, "option text");
        var key = t.trim().toLowerCase();
        if (seenText.has(key)) { fail("duplicate option text"); }
        seenText.add(key);
        return { id: o.id, text: t, why: txt(o.why, 10, 400, "option why") };
      });
      onlyKeys(raw.answer, ["correct"], "answer");
      var correct = raw.answer.correct;
      if (!Array.isArray(correct) || correct.length < 1) { fail("answer.correct must be a non-empty array"); }
      var seenCorrect = new Set();
      correct.forEach(function (c) {
        if (typeof c !== "string" || !seenOpt.has(c) || seenCorrect.has(c)) { fail("answer.correct has an invalid id"); }
        seenCorrect.add(c);
      });
      if (multi) {
        if (!isInt(raw.selectCount, 2, 3) || raw.selectCount !== correct.length || correct.length >= it.options.length) { fail("selectCount does not match the answer"); }
        it.selectCount = raw.selectCount;
      } else {
        if (correct.length !== 1) { fail("single needs exactly one correct option"); }
        if (hasOwn(raw, "selectCount") && raw.selectCount !== 1) { fail("selectCount must be 1 on a single item"); }
        it.selectCount = 1;
      }
      it.answer = { correct: correct.slice() };
      return it;
    }

    if (hasOwn(raw, "options") || hasOwn(raw, "selectCount")) { fail("options are not allowed on a performance-based item"); }

    if (it.type === "order") {
      onlyKeys(raw.data, ["prompt", "items"], "data");
      onlyKeys(raw.answer, ["order"], "answer");
      var steps = partList(raw.data.items, 3, 8, "text", "order items");
      if (!isPermutation(raw.answer.order, ids(steps))) { fail("answer.order must list every item once"); }
      it.data = { prompt: txt(raw.data.prompt, 1, 400, "prompt"), items: steps };
      it.answer = { order: raw.answer.order.slice() };
      return it;
    }

    if (it.type === "match") {
      onlyKeys(raw.data, ["prompt", "left", "right"], "data");
      onlyKeys(raw.answer, ["pairs"], "answer");
      var left = partList(raw.data.left, 3, 8, "text", "left items");
      var right = partList(raw.data.right, 2, 11, "text", "right items");
      if (right.length > left.length + 3) { fail("too many right items"); }
      if (!isObj(raw.answer.pairs)) { fail("answer.pairs must be an object"); }
      var leftIds = ids(left), rightIds = ids(right);
      if (!isPermutation(Object.keys(raw.answer.pairs), leftIds)) { fail("answer.pairs must cover every left item"); }
      var pairs = {}, used = new Set(), dup = false;
      leftIds.forEach(function (l) {
        var r = raw.answer.pairs[l];
        if (typeof r !== "string" || rightIds.indexOf(r) < 0) { fail("answer.pairs points to an unknown right item"); }
        if (used.has(r)) { dup = true; }
        used.add(r);
        pairs[l] = r;
      });
      var reuse = /options may be used more than once/i.test(it.stem);
      if (dup && !reuse) { fail("a right item is used twice but the stem does not allow reuse"); }
      if (!reuse && right.length < left.length) { fail("not enough right items"); }
      it.reuse = reuse;
      it.data = { prompt: txt(raw.data.prompt, 1, 400, "prompt"), left: left, right: right };
      it.answer = { pairs: pairs };
      return it;
    }

    /* subnet */
    onlyKeys(raw.data, ["prompt", "columns", "rows"], "data");
    onlyKeys(raw.answer, ["rows"], "answer");
    var cols = raw.data.columns;
    if (!Array.isArray(cols) || cols.length < 1 || cols.length > SUBNET_COLS.length) { fail("columns count out of range"); }
    var seenCol = new Set();
    cols.forEach(function (c) {
      if (typeof c !== "string" || SUBNET_COLS.indexOf(c) < 0 || seenCol.has(c)) { fail("invalid or duplicate column"); }
      seenCol.add(c);
    });
    var rows = partList(raw.data.rows, 2, 5, "label", "subnet rows");
    if (!isObj(raw.answer.rows) || !isPermutation(Object.keys(raw.answer.rows), ids(rows))) { fail("answer.rows must cover every row"); }
    var cells = {};
    rows.forEach(function (r) {
      var src = raw.answer.rows[r.id];
      if (!isObj(src) || !isPermutation(Object.keys(src), cols)) { fail("answer row must have exactly the declared columns"); }
      var rowCells = {};
      cols.forEach(function (c) { rowCells[c] = txt(src[c], 1, 40, "answer cell"); });
      cells[r.id] = rowCells;
    });
    it.data = { prompt: txt(raw.data.prompt, 1, 400, "prompt"), columns: cols.slice(), rows: rows };
    it.answer = { rows: cells };
    return it;
  }

  function loadObjectives(res) {
    var titles = Object.create(null), ok = false;
    if (res.ok && Array.isArray(res.value) && res.value.length === OBJECTIVE_IDS.length) {
      try {
        res.value.forEach(function (o) {
          onlyKeys(o, ["id", "domain", "title"], "objective");
          if (typeof o.id !== "string" || OBJECTIVE_IDS.indexOf(o.id) < 0 || titles[o.id] !== undefined) { fail("bad objective id"); }
          if (String(o.domain) !== o.id.charAt(0)) { fail("bad objective domain"); }
          titles[o.id] = txt(o.title, 1, 90, "objective title");
        });
        ok = true;
      } catch (e) { ok = false; }
    }
    if (!ok) {
      titles = Object.create(null);
      bank.notices.push("The list of objective titles could not be loaded. Objectives are shown by number only.");
    }
    bank.objectives = OBJECTIVE_IDS.map(function (id) {
      var t = titles[id] !== undefined && ok ? titles[id] : "Objective " + id;
      bank.objTitle[id] = t;
      return { id: id, domain: Number(id.charAt(0)), title: t };
    });
  }

  function loadDomains(res) {
    var ok = false, list = [];
    if (res.ok && Array.isArray(res.value) && res.value.length === 5) {
      try {
        var sum = 0;
        res.value.forEach(function (d, i) {
          onlyKeys(d, ["id", "title", "weight"], "domain");
          if (d.id !== i + 1 || !isNum(d.weight, 1, 100)) { fail("bad domain"); }
          sum += d.weight;
          list.push({ id: d.id, title: txt(d.title, 1, 60, "domain title"), weight: d.weight });
        });
        ok = Math.abs(sum - 100) < 0.001;
      } catch (e) { ok = false; }
    }
    if (!ok) { bank.notices.push("The domain list could not be loaded. Built-in domain names and weights are used."); }
    bank.domains = ok ? list : FALLBACK_DOMAINS;
  }

  function loadDomainFile(n, res, seenIds) {
    if (!res.ok) {
      bank.notices.push("The question file for domain " + n + " is missing or could not be read. The simulator works with the other domains.");
      return;
    }
    var file = res.value, accepted = 0, rejected = 0;
    try {
      onlyKeys(file, ["schemaVersion", "exam", "domain", "items"], "file");
      if (file.schemaVersion !== 1 || file.exam !== EXAM_CODE || file.domain !== n || !Array.isArray(file.items)) { fail("bad header"); }
    } catch (e) {
      bank.notices.push("The question file for domain " + n + " is not valid and was ignored. The simulator works with the other domains.");
      return;
    }
    file.items.forEach(function (raw, index) {
      try {
        var it = deepFreeze(normItem(raw, n, seenIds));
        seenIds.add(it.id);
        bank.items.push(it);
        bank.byId[it.id] = it;
        accepted++;
      } catch (e) {
        rejected++;
        if (window.console && console.warn) { console.warn("Bank: domain " + n + ", item #" + (index + 1) + " rejected: " + e.message); }
      }
    });
    if (rejected > 0) {
      bank.rejected += rejected;
      bank.notices.push("Domain " + n + ": " + rejected + " question" + (rejected === 1 ? " was" : "s were") + " rejected by the load-time checks and " + (rejected === 1 ? "is" : "are") + " not used.");
    }
    if (accepted === 0 && rejected === 0) {
      bank.notices.push("The question file for domain " + n + " is empty.");
    }
  }

  function getJson(url) {
    return fetch(url, { credentials: "same-origin", cache: "no-cache", redirect: "error" })
      .then(function (r) {
        if (!r.ok) { throw new Error("HTTP " + r.status); }
        return r.text();
      })
      .then(function (t) {
        if (t.length > MAX_FILE_CHARS) { throw new Error("file too large"); }
        return { ok: true, value: JSON.parse(t) };
      })
      .catch(function (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; });
  }

  function loadBank() {
    var urls = ["data/objectives.json", "data/domains.json"];
    for (var n = 1; n <= 5; n++) { urls.push("data/domain-" + n + ".json"); }
    return Promise.all(urls.map(getJson)).then(function (res) {
      loadObjectives(res[0]);
      loadDomains(res[1]);
      var seenIds = new Set();
      for (var d = 1; d <= 5; d++) { loadDomainFile(d, res[d + 1], seenIds); }
      Object.freeze(bank.items);
      Object.freeze(bank.byId);
      deepFreeze(bank.domains);
      deepFreeze(bank.objectives);
      Object.freeze(bank.objTitle);
      if (window.console && console.info) {
        console.info("Bank loaded: " + bank.items.length + " questions accepted, " + bank.rejected + " rejected.");
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Settings and progress                                               */
  /* ------------------------------------------------------------------ */

  function readSettings() {
    var raw = lsGet("settings");
    var s = { font: 1, theme: "auto", timerHidden: false };
    if (isObj(raw)) {
      if (isInt(raw.font, 0, CFG.fontLevels - 1)) { s.font = raw.font; }
      if (raw.theme === "auto" || raw.theme === "light" || raw.theme === "dark") { s.theme = raw.theme; }
      if (raw.timerHidden === true) { s.timerHidden = true; }
    }
    return s;
  }

  function applySettings() {
    var root = document.documentElement;
    root.setAttribute("data-fs", String(settings.font));
    root.setAttribute("data-theme", settings.theme);
    $("btn-theme").textContent = "Theme: " + settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1);
    $("btn-font-dec").disabled = settings.font <= 0;
    $("btn-font-inc").disabled = settings.font >= CFG.fontLevels - 1;
    var hidden = settings.timerHidden;
    $("timer").hidden = hidden;
    $("btn-timer-toggle").textContent = hidden ? "Show" : "Hide";
    $("btn-timer-toggle").setAttribute("aria-pressed", hidden ? "true" : "false");
    $("btn-timer-toggle").setAttribute("aria-label", hidden ? "Show the timer" : "Hide the timer");
  }

  function saveSettings() { lsSet("settings", settings); applySettings(); }

  function cleanAttempt(a) {
    if (!isObj(a)) { return null; }
    if (a.mode !== "exam" && a.mode !== "practice") { return null; }
    if (!isNum(a.t, 0, 4e12) || !isInt(a.count, 1, 500) || !isNum(a.possible, 0, 5000) || !isNum(a.earned, 0, a.possible)) { return null; }
    if (!isInt(a.usedSec, 0, 1000000) || typeof a.pass !== "boolean") { return null; }
    if (a.mode === "exam" ? !isInt(a.scaled, 100, 900) : a.scaled !== null) { return null; }
    return { t: a.t, mode: a.mode, count: a.count, earned: a.earned, possible: a.possible, scaled: a.scaled, pass: a.pass, usedSec: a.usedSec };
  }

  function readProgress() {
    var out = { v: 1, attempts: [], objectives: {} };
    var raw = lsGet("progress");
    if (!isObj(raw) || raw.v !== 1) { return out; }
    if (Array.isArray(raw.attempts)) {
      raw.attempts.slice(0, CFG.maxAttempts).forEach(function (a) {
        var c = cleanAttempt(a);
        if (c) { out.attempts.push(c); }
      });
    }
    if (isObj(raw.objectives)) {
      OBJECTIVE_IDS.forEach(function (id) {
        var v = hasOwn(raw.objectives, id) ? raw.objectives[id] : null;
        if (Array.isArray(v) && v.length === 2 && isInt(v[1], 1, 1000000) && isInt(v[0], 0, v[1])) {
          out.objectives[id] = [v[0], v[1]];
        }
      });
    }
    return out;
  }

  function recordProgress(res) {
    if (res.count < 1) { return; }
    var p = readProgress();
    p.attempts.unshift({
      t: Date.now(), mode: res.mode, count: res.count, earned: Math.round(res.earned * 100) / 100,
      possible: res.possible, scaled: res.mode === "exam" ? res.scaled : null, pass: res.pass, usedSec: res.usedSec
    });
    p.attempts = p.attempts.slice(0, CFG.maxAttempts);
    res.rows.forEach(function (r) {
      if (!r.attempted) { return; }
      var obj = bank.byId[r.id].objective;
      var cur = hasOwn(p.objectives, obj) ? p.objectives[obj] : [0, 0];
      p.objectives[obj] = [cur[0] + (r.g.full ? 1 : 0), cur[1] + 1];
    });
    lsSet("progress", p);
  }

  /* ------------------------------------------------------------------ */
  /* Answers: sanitising, completeness, grading                          */
  /* ------------------------------------------------------------------ */

  function optionIds(it) { return ids(it.options); }
  function optionOf(it, oid) {
    for (var i = 0; i < it.options.length; i++) { if (it.options[i].id === oid) { return it.options[i]; } }
    return null;
  }
  function textOfPart(list, id, key) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i][key]; } }
    return "";
  }

  function sanitizeAnswer(it, raw) {
    if (raw === null || raw === undefined) { return null; }
    if (it.type === "single" || it.type === "multiple") {
      if (!Array.isArray(raw) || raw.length < 1 || raw.length > it.selectCount) { return null; }
      var valid = optionIds(it), seen = new Set(), out = [];
      for (var i = 0; i < raw.length; i++) {
        if (typeof raw[i] !== "string" || valid.indexOf(raw[i]) < 0 || seen.has(raw[i])) { return null; }
        seen.add(raw[i]); out.push(raw[i]);
      }
      return out;
    }
    if (!isObj(raw)) { return null; }
    if (it.type === "order") {
      /* Slots may be empty (null) while the candidate is still placing steps. */
      var all = ids(it.data.items), seenO = new Set(), outO = [], filled = 0;
      if (!Array.isArray(raw.order) || raw.order.length !== all.length) { return null; }
      for (var k = 0; k < raw.order.length; k++) {
        var v = raw.order[k];
        if (v === null) { outO.push(null); continue; }
        if (typeof v !== "string" || all.indexOf(v) < 0 || seenO.has(v)) { return null; }
        seenO.add(v); outO.push(v); filled++;
      }
      return filled ? { order: outO } : null;
    }
    if (it.type === "match") {
      var rightIds = ids(it.data.right), pairs = {}, n = 0;
      it.data.left.forEach(function (l) {
        if (hasOwn(raw, l.id) && typeof raw[l.id] === "string" && rightIds.indexOf(raw[l.id]) >= 0) { pairs[l.id] = raw[l.id]; n++; }
      });
      return n ? pairs : null;
    }
    var cells = {}, count = 0;
    it.data.rows.forEach(function (r) {
      if (!hasOwn(raw, r.id) || !isObj(raw[r.id])) { return; }
      var row = {}, any = false;
      it.data.columns.forEach(function (c) {
        var v = hasOwn(raw[r.id], c) ? raw[r.id][c] : "";
        if (typeof v === "string" && v.length > 0 && v.length <= 40 && !BAD_CHARS.test(v)) { row[c] = v; any = true; }
      });
      if (any) { cells[r.id] = row; count++; }
    });
    return count ? cells : null;
  }

  function isAnswered(it, ans) {
    if (!ans) { return false; }
    if (it.type === "single" || it.type === "multiple") { return ans.length === it.selectCount; }
    if (it.type === "order") { return ans.order.every(function (v) { return v !== null; }); }
    if (it.type === "match") {
      return it.data.left.every(function (l) { return hasOwn(ans, l.id); });
    }
    return it.data.rows.every(function (r) {
      return hasOwn(ans, r.id) && it.data.columns.every(function (c) {
        return hasOwn(ans[r.id], c) && String(ans[r.id][c]).trim() !== "";
      });
    });
  }

  function normCell(col, v) {
    var s = String(v === null || v === undefined ? "" : v).trim().toLowerCase().replace(/\s+/g, "");
    if (col === "prefix") { s = s.replace(/^\//, ""); }
    if (col === "hosts") { s = s.replace(/,/g, ""); }
    if (col === "prefix" || col === "hosts") {
      return /^[0-9]{1,10}$/.test(s) ? String(parseInt(s, 10)) : s;
    }
    var m = /^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/.exec(s);
    return m ? [m[1], m[2], m[3], m[4]].map(function (x) { return String(parseInt(x, 10)); }).join(".") : s;
  }

  function cellValue(ans, rid, col) {
    return ans && hasOwn(ans, rid) && hasOwn(ans[rid], col) ? String(ans[rid][col]) : "";
  }

  function cellCorrect(it, ans, rid, col) {
    var mine = normCell(col, cellValue(ans, rid, col));
    return mine !== "" && mine === normCell(col, it.answer.rows[rid][col]);
  }

  function grade(it, ans) {
    var total = 1, good = 0;
    if (it.type === "single" || it.type === "multiple") {
      var mine = (ans || []).slice().sort(), key = it.answer.correct.slice().sort();
      good = sameArray(mine, key) ? 1 : 0;
    } else if (it.type === "order") {
      total = it.answer.order.length;
      if (ans) { it.answer.order.forEach(function (id, i) { if (ans.order[i] === id) { good++; } }); }
    } else if (it.type === "match") {
      total = it.data.left.length;
      if (ans) { it.data.left.forEach(function (l) { if (hasOwn(ans, l.id) && ans[l.id] === it.answer.pairs[l.id]) { good++; } }); }
    } else {
      total = it.data.rows.length * it.data.columns.length;
      it.data.rows.forEach(function (r) {
        it.data.columns.forEach(function (c) { if (cellCorrect(it, ans, r.id, c)) { good++; } });
      });
    }
    var frac = total > 0 ? good / total : 0;
    var pbq = isPbq(it);
    var possible = pbq ? CFG.pbqWeight : 1;
    var points = pbq ? (frac < CFG.pbqFloor ? 0 : CFG.pbqWeight * frac) : frac;
    return { good: good, total: total, frac: frac, possible: possible, points: points, full: good === total };
  }

  /* Approximation only: piecewise linear mapping of the share of points onto 100-900. */
  function scaledScore(p) {
    var c = CFG.cut;
    var s = p <= c ? 100 + (p / c) * (CFG.passScore - 100) : CFG.passScore + ((p - c) / (1 - c)) * (900 - CFG.passScore);
    return Math.min(900, Math.max(100, Math.round(s)));
  }

  /* ------------------------------------------------------------------ */
  /* Building an attempt                                                 */
  /* ------------------------------------------------------------------ */

  function allocate(total, domains) {
    var raw = domains.map(function (d) { return total * d.weight / 100; });
    var out = raw.map(Math.floor);
    var left = total - out.reduce(function (a, b) { return a + b; }, 0);
    var order = raw.map(function (v, i) { return { i: i, r: v - Math.floor(v) }; })
      .sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    for (var k = 0; k < left; k++) { out[order[k % order.length].i]++; }
    return out;
  }

  function planExam() {
    var pbq = shuffle(bank.items.filter(isPbq)).slice(0, CFG.examPbq);
    var target = CFG.examItems - pbq.length;
    var alloc = allocate(target, bank.domains);
    var picked = [], spare = [];
    bank.domains.forEach(function (d, i) {
      var pool = shuffle(bank.items.filter(function (it) { return !isPbq(it) && it.domain === d.id; }));
      picked = picked.concat(pool.slice(0, alloc[i]));
      spare = spare.concat(pool.slice(alloc[i]));
    });
    if (picked.length < target) { picked = picked.concat(shuffle(spare).slice(0, target - picked.length)); }
    var list = ids(pbq.concat(shuffle(picked)));
    return { ids: list, seconds: examSeconds(list.length) };
  }

  function examSize() {
    var pbq = Math.min(CFG.examPbq, bank.items.filter(isPbq).length);
    var mcq = bank.items.length - bank.items.filter(isPbq).length;
    return pbq + Math.min(CFG.examItems - pbq, mcq);
  }

  /* Full form: 90 minutes. Shorter bank: one minute per question (same pace), at least five. */
  function examSeconds(count) {
    return count >= CFG.examItems ? CFG.examSeconds : Math.max(300, count * 60);
  }

  function layoutFor(it) {
    if (it.type === "single" || it.type === "multiple") { return shuffle(optionIds(it)); }
    if (it.type === "match") { return shuffle(ids(it.data.right)); }
    if (it.type === "order") {
      var base = ids(it.data.items), out = shuffle(base), guard = 0;
      while (sameArray(out, it.answer.order) && guard < 20) { out = shuffle(base); guard++; }
      if (sameArray(out, it.answer.order)) { out = out.slice(1).concat(out.slice(0, 1)); }
      return out;
    }
    return [];
  }

  function expectedLayout(it) {
    if (it.type === "single" || it.type === "multiple") { return optionIds(it); }
    if (it.type === "match") { return ids(it.data.right); }
    if (it.type === "order") { return ids(it.data.items); }
    return [];
  }

  function newSession(mode, list, seconds, clock, note) {
    var s = {
      v: 1, mode: mode, ids: list, lay: {}, ans: {}, flags: {}, marks: {}, checked: {},
      startedAt: Date.now(), durationSec: seconds, idx: 0, clock: !!clock, note: note || ""
    };
    list.forEach(function (id) { s.lay[id] = layoutFor(bank.byId[id]); });
    return s;
  }

  function saveSession() { if (session) { lsSet("session", session); } }

  function readSession() {
    var raw = lsGet("session");
    try {
      if (!isObj(raw) || raw.v !== 1) { return null; }
      if (raw.mode !== "exam" && raw.mode !== "practice") { return null; }
      if (!Array.isArray(raw.ids) || raw.ids.length < 1 || raw.ids.length > 200) { return null; }
      var seen = new Set(), i;
      for (i = 0; i < raw.ids.length; i++) {
        var id = raw.ids[i];
        if (typeof id !== "string" || !ITEM_ID_RE.test(id) || !bank.byId[id] || seen.has(id)) { return null; }
        seen.add(id);
      }
      var now = Date.now();
      if (!isNum(raw.startedAt, now - 30 * 86400000, now + 60000)) { return null; }
      if (!isInt(raw.durationSec, 60, 4 * 3600)) { return null; }
      var s = {
        v: 1, mode: raw.mode, ids: raw.ids.slice(), lay: {}, ans: {}, flags: {}, marks: {}, checked: {},
        startedAt: raw.startedAt, durationSec: raw.durationSec,
        idx: isInt(raw.idx, 0, raw.ids.length - 1) ? raw.idx : 0,
        clock: raw.clock === true, note: ""
      };
      var rl = isObj(raw.lay) ? raw.lay : {}, ra = isObj(raw.ans) ? raw.ans : {};
      var rf = isObj(raw.flags) ? raw.flags : {}, rm = isObj(raw.marks) ? raw.marks : {};
      var rc = isObj(raw.checked) ? raw.checked : {};
      s.ids.forEach(function (qid) {
        var it = bank.byId[qid], want = expectedLayout(it);
        s.lay[qid] = hasOwn(rl, qid) && isPermutation(rl[qid], want) && want.length > 0 ? rl[qid].slice() : layoutFor(it);
        var a = hasOwn(ra, qid) ? sanitizeAnswer(it, ra[qid]) : null;
        if (a) { s.ans[qid] = a; }
        if (hasOwn(rf, qid) && rf[qid] === true) { s.flags[qid] = true; }
        if (s.mode === "practice" && hasOwn(rc, qid) && rc[qid] === true) { s.checked[qid] = true; }
        if (!isPbq(it) && hasOwn(rm, qid) && isObj(rm[qid])) {
          var marks = {}, any = false;
          optionIds(it).forEach(function (oid) {
            var v = hasOwn(rm[qid], oid) ? rm[qid][oid] : null;
            if (v === "h" || v === "s" || v === "hs") { marks[oid] = v; any = true; }
          });
          if (any) { s.marks[qid] = marks; }
        }
      });
      return s;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ */
  /* Announcements and dialog                                            */
  /* ------------------------------------------------------------------ */

  function announce(msg) {
    var node = $("announcer");
    node.textContent = "";
    window.setTimeout(function () { node.textContent = msg; }, 40);
  }

  function openDialog(opts) {
    return new Promise(function (resolve) {
      if (activeDialog) { activeDialog.close(null); }
      var prev = document.activeElement;
      var app = $("app"), root = $("dialog-root");
      var handle = { close: close };
      var body = el("div", { id: "dialog-body", class: "dialog-body" });
      opts.lines.forEach(function (line) { body.appendChild(el("p", { text: line })); });
      var buttons = opts.actions.map(function (a) {
        return el("button", {
          type: "button", "data-value": a.value,
          class: "btn" + (a.primary ? " btn-primary" : "") + (a.danger ? " btn-danger" : ""),
          text: a.label,
          on: { click: function () { close(a.value); } }
        });
      });
      var box = el("div", {
        class: "dialog", role: opts.alert ? "alertdialog" : "dialog", "aria-modal": "true",
        "aria-labelledby": "dialog-title", "aria-describedby": "dialog-body", tabindex: "-1"
      }, [el("h2", { id: "dialog-title", text: opts.title }), body, el("div", { class: "dialog-actions" }, buttons)]);
      var backdrop = el("div", { class: "dialog-backdrop" }, [box]);
      var dismissable = opts.dismissable !== false;

      function onKey(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          if (dismissable) { close(null); }
          return;
        }
        if (e.key !== "Tab") { return; }
        var first = buttons[0], last = buttons[buttons.length - 1], cur = document.activeElement;
        if (!box.contains(cur)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && (cur === first || cur === box)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
      }

      function close(value) {
        if (activeDialog !== handle) { return; }
        activeDialog = null;
        document.removeEventListener("keydown", onKey, true);
        if (backdrop.parentNode) { backdrop.parentNode.removeChild(backdrop); }
        app.inert = false;
        app.removeAttribute("aria-hidden");
        if (prev && typeof prev.focus === "function" && document.contains(prev)) { prev.focus(); }
        resolve(value);
      }

      backdrop.addEventListener("mousedown", function (e) {
        if (e.target === backdrop && dismissable) { close(null); }
      });
      document.addEventListener("keydown", onKey, true);
      activeDialog = handle;
      app.inert = true;
      app.setAttribute("aria-hidden", "true");
      root.appendChild(backdrop);
      var focusIndex = 0;
      opts.actions.forEach(function (a, i) { if (a.focus) { focusIndex = i; } });
      buttons[focusIndex].focus();
    });
  }

  function confirmDialog(title, lines, confirmLabel, danger) {
    return openDialog({
      title: title, lines: lines,
      actions: [
        { label: "Cancel", value: "cancel", focus: true },
        { label: confirmLabel, value: "confirm", primary: !danger, danger: !!danger }
      ]
    }).then(function (v) { return v === "confirm"; });
  }

  /* ------------------------------------------------------------------ */
  /* Views                                                               */
  /* ------------------------------------------------------------------ */

  var VIEWS = ["loading", "home", "item", "review", "report", "answers", "progress"];
  var VIEW_FOCUS = { home: "home-title", item: "item-title", review: "review-title", report: "report-title", answers: "answers-title", progress: "progress-title" };

  function showView(name, keepFocus) {
    view = name;
    VIEWS.forEach(function (v) { $("view-" + v).hidden = v !== name; });
    var inSession = !!session && (name === "item" || name === "review");
    document.body.setAttribute("data-view", name);
    $("site-nav").hidden = inSession;
    $("session-status").hidden = !inSession;
    $("session-tools").hidden = !(inSession && name === "item");
    $("navbar").hidden = !(inSession && name === "item");
    if (inSession) { $("timer-box").hidden = session.mode !== "exam" && !session.clock; }
    if (!keepFocus) {
      window.scrollTo(0, 0);
      var target = VIEW_FOCUS[name] ? $(VIEW_FOCUS[name]) : null;
      if (target) { target.focus(); }
    }
  }

  /* ---------- home ---------- */

  function renderHome() {
    var notices = clear($("bank-notices"));
    var list = bank.notices.slice();
    if (bank.items.length === 0) {
      list.unshift("No question could be loaded. If you opened this file directly from disk, serve the folder over HTTP instead (see the README).");
    }
    list.forEach(function (n) { notices.appendChild(el("p", { class: "notice", text: n })); });

    var pbqCount = bank.items.filter(isPbq).length;
    $("bank-summary").textContent = "Question bank: " + bank.items.length + " questions (" +
      (bank.items.length - pbqCount) + " multiple choice, " + pbqCount + " performance-based).";

    saved = session ? null : readSession();
    var card = $("resume-card");
    card.hidden = !saved;
    if (saved) {
      var txtParts = (saved.mode === "exam" ? "Exam mode" : "Practice mode") + ", question " + (saved.idx + 1) + " of " + saved.ids.length + ".";
      if (saved.mode === "exam") {
        var remain = saved.durationSec - Math.floor((Date.now() - saved.startedAt) / 1000);
        txtParts += remain > 0 ? " Time remaining: " + fmtTime(remain) + " (the exam clock kept running)." : " The time has expired: resuming will show the score report.";
      }
      $("resume-text").textContent = txtParts;
    }

    var size = examSize(), note = $("exam-note");
    $("btn-start-exam").disabled = size === 0;
    if (size < CFG.examItems && size > 0) {
      note.hidden = false;
      note.textContent = "The bank currently provides " + size + " question" + (size === 1 ? "" : "s") + " for an exam, so this exam will have " + size +
        " instead of " + CFG.examItems + ", with " + Math.round(examSeconds(size) / 60) + " minutes on the clock (one minute per question).";
    } else {
      note.hidden = true;
    }
    updatePracticeAvail();
  }

  function buildPracticeForm() {
    var doms = clear($("practice-domains")), objs = clear($("practice-objectives"));
    bank.domains.forEach(function (d) {
      var count = bank.items.filter(function (it) { return it.domain === d.id; }).length;
      var input = el("input", { type: "checkbox", name: "pd", value: String(d.id) });
      input.checked = count > 0;
      input.disabled = count === 0;
      input.addEventListener("change", updatePracticeAvail);
      doms.appendChild(el("label", { class: "check" }, [input, el("span", { text: d.id + ".0 " + d.title + " (" + count + ")" })]));

      var group = el("fieldset", { class: "field obj-group" }, [el("legend", { text: d.id + ".0 " + d.title })]);
      bank.objectives.forEach(function (o) {
        if (o.domain !== d.id) { return; }
        var n = bank.items.filter(function (it) { return it.objective === o.id; }).length;
        var box = el("input", { type: "checkbox", name: "po", value: o.id, "data-domain": String(d.id) });
        box.disabled = n === 0;
        box.addEventListener("change", updatePracticeAvail);
        group.appendChild(el("label", { class: "check" }, [box, el("span", { text: o.id + " " + o.title + " (" + n + ")" })]));
      });
      objs.appendChild(group);
    });
    $("practice-types").addEventListener("change", updatePracticeAvail);
    $("practice-count").addEventListener("input", updatePracticeAvail);
  }

  function practicePool() {
    var doms = [], objs = [];
    Array.prototype.forEach.call(document.querySelectorAll('#practice-domains input[name="pd"]'), function (i) {
      if (i.checked) { doms.push(Number(i.value)); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('#practice-objectives input[name="po"]'), function (i) {
      var domOn = doms.indexOf(Number(i.getAttribute("data-domain"))) >= 0;
      if (i.checked && domOn) { objs.push(i.value); }
    });
    var types = $("practice-types").value;
    return bank.items.filter(function (it) {
      if (doms.indexOf(it.domain) < 0) { return false; }
      if (objs.length && objs.indexOf(it.objective) < 0) { return false; }
      if (types === "mcq") { return !isPbq(it); }
      if (types === "pbq") { return isPbq(it); }
      return true;
    });
  }

  function practiceCount() {
    var n = parseInt($("practice-count").value, 10);
    return isInt(n, 1, 200) ? n : 0;
  }

  function updatePracticeAvail() {
    var pool = practicePool().length, want = practiceCount();
    var msg = pool + " question" + (pool === 1 ? "" : "s") + " match" + (pool === 1 ? "es" : "") + " this selection.";
    if (want === 0) { msg += " Enter a number of questions between 1 and 200."; }
    else if (pool > 0 && pool < want) { msg += " The session will have " + pool + " instead of " + want + "."; }
    $("practice-avail").textContent = msg;
    $("btn-start-practice").disabled = pool === 0 || want === 0;
  }

  function confirmReplaceSaved() {
    if (!saved) { return Promise.resolve(true); }
    return confirmDialog("Discard the attempt in progress?", ["Starting a new attempt erases the one you have not finished."], "Discard and start", true);
  }

  function begin(s) {
    session = s;
    saved = null;
    result = null;
    tool = null;
    saveSession();
    renderItem();
    showView("item");
    startTicker();
  }

  function startExam() {
    confirmReplaceSaved().then(function (ok) {
      if (!ok) { return; }
      var plan = planExam();
      if (!plan.ids.length) { return; }
      var note = plan.ids.length < CFG.examItems ? "The bank is smaller than a full exam: this exam has " + plan.ids.length +
        " questions and " + Math.round(plan.seconds / 60) + " minutes." : "";
      begin(newSession("exam", plan.ids, plan.seconds, true, note));
    });
  }

  function startPractice() {
    confirmReplaceSaved().then(function (ok) {
      if (!ok) { return; }
      var want = practiceCount(), pool = shuffle(practicePool());
      if (!want || !pool.length) { return; }
      var list = ids(pool.slice(0, want));
      var note = list.length < want ? "Only " + list.length + " question" + (list.length === 1 ? " matches" : "s match") +
        " your selection, so this session has " + list.length + " instead of " + want + "." : "";
      begin(newSession("practice", list, 4 * 3600, $("practice-clock").checked, note));
    });
  }

  function resumeSaved() {
    if (!saved) { return; }
    session = saved;
    saved = null;
    result = null;
    tool = null;
    if (session.mode === "exam" && Date.now() - session.startedAt >= session.durationSec * 1000) {
      finish("time");
      return;
    }
    renderItem();
    showView("item");
    startTicker();
  }

  function discardSaved() {
    confirmDialog("Discard this attempt?", ["The unfinished attempt will be erased. It is not added to your progress."], "Discard", true).then(function (ok) {
      if (!ok) { return; }
      lsDel("session");
      saved = null;
      renderHome();
      $("home-title").focus();
    });
  }

  /* ---------- timer ---------- */

  function stopTicker() {
    if (tickId !== null) { window.clearInterval(tickId); tickId = null; }
  }

  function startTicker() {
    stopTicker();
    lastRemain = null;
    $("timer-live").textContent = "";
    tick();
    if (session) { tickId = window.setInterval(tick, 250); }
  }

  function tick() {
    if (!session) { stopTicker(); return; }
    var elapsed = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
    var timer = $("timer");
    if (session.mode !== "exam") {
      $("timer-label").textContent = "Elapsed";
      timer.classList.remove("is-warn", "is-danger");
      if (session.clock) { var up = fmtTime(elapsed); if (timer.textContent !== up) { timer.textContent = up; } }
      return;
    }
    $("timer-label").textContent = "Time remaining";
    var remain = Math.max(0, session.durationSec - elapsed);
    var shown = fmtTime(remain);
    if (timer.textContent !== shown) { timer.textContent = shown; }
    timer.classList.toggle("is-warn", remain <= 600 && remain > 300);
    timer.classList.toggle("is-danger", remain <= 300);
    if (lastRemain !== null && remain > 0) {
      if (lastRemain > 300 && remain <= 300) { $("timer-live").textContent = "5 minutes remaining."; }
      else if (lastRemain > 600 && remain <= 600) { $("timer-live").textContent = "10 minutes remaining."; }
    }
    lastRemain = remain;
    if (remain <= 0) { finish("time"); }
  }

  /* ---------- item screen ---------- */

  function curItem() { return bank.byId[session.ids[session.idx]]; }
  function isLocked(id) { return session.mode === "practice" && session.checked[id] === true; }

  function touch() {
    saveSession();
    refreshChrome();
  }

  function refreshChrome() {
    if (!session) { return; }
    var it = curItem(), id = it.id, locked = isLocked(id);
    var flagged = session.flags[id] === true;
    $("status-pos").textContent = "Question " + (session.idx + 1) + " of " + session.ids.length;
    $("btn-flag").setAttribute("aria-pressed", flagged ? "true" : "false");
    $("item-flagged").hidden = !flagged;
    $("btn-prev").disabled = session.idx === 0;
    var noTools = isPbq(it) || locked;
    if (noTools) { tool = null; }
    $("btn-highlight").disabled = noTools;
    $("btn-strike").disabled = noTools;
    $("btn-highlight").setAttribute("aria-pressed", tool === "h" ? "true" : "false");
    $("btn-strike").setAttribute("aria-pressed", tool === "s" ? "true" : "false");
    $("item").setAttribute("data-tool", tool || "none");
    var canCheck = session.mode === "practice" && !locked;
    $("item-actions").hidden = !canCheck;
    if (canCheck) { $("btn-check").disabled = !isPbq(it) && !isAnswered(it, session.ans[id]); }
  }

  function renderExhibit(host, it) {
    clear(host);
    if (!it.exhibit) { return; }
    var pre = el("pre", { class: "exhibit-pre", tabindex: "0" });
    pre.textContent = it.exhibit.lines.join("\n");
    host.appendChild(el("figure", { class: "exhibit" }, [
      el("figcaption", { text: "Exhibit: " + it.exhibit.title }), pre
    ]));
  }

  function kindLabel(it) {
    if (isPbq(it)) { return "Performance-based"; }
    return it.type === "multiple" ? "Multiple response" : "Multiple choice";
  }

  function renderItem() {
    var it = curItem(), id = it.id, locked = isLocked(id);
    var host = $("item");
    host.setAttribute("data-item-id", id);
    host.setAttribute("data-type", it.type);
    host.setAttribute("data-locked", locked ? "true" : "false");
    $("item-title").textContent = "Question " + (session.idx + 1) + " of " + session.ids.length;
    $("item-kind").textContent = kindLabel(it);
    rich(clear($("item-stem")), it.stem, true);
    renderExhibit($("item-exhibit"), it);
    var body = clear($("item-body"));
    clear($("item-feedback"));
    if (locked) {
      $("item-feedback").appendChild(solutionView(it, session.ans[id], session.lay[id], grade(it, session.ans[id])));
    } else if (it.type === "order") { mountOrder(body, it); }
    else if (it.type === "match") { mountMatch(body, it); }
    else if (it.type === "subnet") { mountSubnet(body, it); }
    else { mountChoice(body, it); }
    var note = $("session-note");
    note.hidden = !(session.note && session.idx === 0);
    note.textContent = session.note || "";
    refreshChrome();
  }

  function goTo(index) {
    if (!session) { return; }
    if (index >= session.ids.length) { openReview(); return; }
    if (index < 0) { return; }
    session.idx = index;
    saveSession();
    renderItem();
    showView("item");
  }

  function toggleFlag() {
    if (!session || view !== "item") { return; }
    var id = curItem().id;
    if (session.flags[id]) { delete session.flags[id]; } else { session.flags[id] = true; }
    touch();
    announce(session.flags[id] ? "Question flagged for review." : "Flag removed.");
  }

  function setTool(name) {
    if (!session || view !== "item") { return; }
    tool = tool === name ? null : name;
    refreshChrome();
    if (tool) { announce((tool === "h" ? "Highlight" : "Strikethrough") + " is on. Select an option to mark it."); }
    else { announce("Marking tool off."); }
  }

  /* ---------- multiple choice ---------- */

  function paintMarks(label, mark) {
    label.classList.toggle("is-hl", !!mark && mark.indexOf("h") >= 0);
    label.classList.toggle("is-st", !!mark && mark.indexOf("s") >= 0);
    var note = label.querySelector(".opt-marks");
    var words = [];
    if (mark && mark.indexOf("h") >= 0) { words.push("highlighted"); }
    if (mark && mark.indexOf("s") >= 0) { words.push("struck out"); }
    note.textContent = words.length ? " (" + words.join(", ") + ")" : "";
  }

  function toggleMark(itemId, oid, which) {
    var marks = session.marks[itemId] || {};
    var cur = marks[oid] || "";
    var h = cur.indexOf("h") >= 0, s = cur.indexOf("s") >= 0;
    if (which === "h") { h = !h; } else { s = !s; }
    var next = (h ? "h" : "") + (s ? "s" : "");
    if (next) { marks[oid] = next; } else { delete marks[oid]; }
    if (Object.keys(marks).length) { session.marks[itemId] = marks; } else { delete session.marks[itemId]; }
    saveSession();
    return next;
  }

  function mountChoice(host, it) {
    var multi = it.type === "multiple", id = it.id;
    var fs = el("fieldset", { class: "options" }, [
      el("legend", { text: multi ? "Choose " + NUM_WORDS[it.selectCount] + "." : "Select one answer." })
    ]);
    var hint = el("p", { class: "hint", role: "status" });
    var inputs = [];
    var chosen = session.ans[id] || [];
    session.lay[id].forEach(function (oid, i) {
      var o = optionOf(it, oid);
      var input = el("input", { type: multi ? "checkbox" : "radio", name: "opt", value: oid });
      input.checked = chosen.indexOf(oid) >= 0;
      inputs.push(input);
      var label = el("label", { class: "opt", "data-opt": oid }, [
        input,
        el("span", { class: "opt-letter", text: LETTERS[i] + "." }),
        rich(el("span", { class: "opt-text" }), o.text),
        el("span", { class: "opt-marks sr-only" })
      ]);
      paintMarks(label, (session.marks[id] || {})[oid]);
      label.addEventListener("click", function (e) {
        if (!tool) { return; }
        e.preventDefault();
        paintMarks(label, toggleMark(id, oid, tool));
      });
      input.addEventListener("change", function () {
        hint.textContent = "";
        if (!multi) { session.ans[id] = [oid]; touch(); return; }
        var picked = inputs.filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
        if (picked.length > it.selectCount) {
          input.checked = false;
          hint.textContent = "You can select only " + NUM_WORDS[it.selectCount] + " options. Clear one before choosing another.";
          return;
        }
        if (picked.length) { session.ans[id] = picked; } else { delete session.ans[id]; }
        touch();
      });
      fs.appendChild(label);
    });
    host.appendChild(fs);
    host.appendChild(hint);
  }

  function pickOptionByIndex(i) {
    if (!session || view !== "item") { return; }
    var it = curItem();
    if (isPbq(it) || isLocked(it.id)) { return; }
    var labels = $("item-body").querySelectorAll("label.opt");
    if (i >= labels.length) { return; }
    var input = labels[i].querySelector("input");
    input.focus();
    input.click();
  }

  /* ---------- performance-based: shared shell ---------- */

  function pbqShell(host, it, help) {
    var content = el("div", { class: "pbq-content" });
    var reset = el("button", { type: "button", class: "btn pbq-reset", text: "Reset" });
    reset.addEventListener("click", function () {
      confirmDialog("Reset this question?", ["Your work on this question will be cleared. Other questions are not affected."], "Reset", true).then(function (ok) {
        if (!ok || !session || curItem().id !== it.id) { return; }
        delete session.ans[it.id];
        saveSession();
        renderItem();
        announce("Question reset.");
        var again = $("item-body").querySelector(".pbq-reset");
        if (again) { again.focus(); }
      });
    });
    host.appendChild(el("div", { class: "pbq" }, [
      rich(el("p", { class: "pbq-prompt" }), it.data.prompt),
      el("p", { class: "pbq-help muted small", text: help }),
      content,
      el("div", { class: "btn-row" }, [reset])
    ]));
    return content;
  }

  /* ---------- performance-based: order ---------- */

  /* Exam style: the steps start in an unordered pool; the candidate drags each one
     into a numbered slot. Tap fallback: select a step, then select a slot. */
  function mountOrder(host, it) {
    var id = it.id, poolOrder = session.lay[id], n = poolOrder.length;
    var sel = null, drag = null;
    var content = pbqShell(host, it, "Drag each step from the list into a numbered box. Without a mouse: select a step, then select a box.");
    var pool = el("div", { class: "match-pool order-pool", role: "group", "aria-label": "Steps to place" });
    var slots = el("ol", { class: "match-rows order-slots" });
    content.appendChild(el("div", { class: "match" }, [slots, pool]));

    function cur() {
      var a = session.ans[id];
      if (a && Array.isArray(a.order) && a.order.length === n) { return a.order.slice(); }
      var empty = []; for (var i = 0; i < n; i++) { empty.push(null); } return empty;
    }
    function commit(arr) {
      if (arr.some(function (v) { return v !== null; })) { session.ans[id] = { order: arr }; } else { delete session.ans[id]; }
      touch();
    }
    function label(sid) { return textOfPart(it.data.items, sid, "text"); }

    function place(pos, sid, fromPos) {
      var arr = cur();
      var prev = arr.indexOf(sid);
      if (prev >= 0) { arr[prev] = null; }
      if (fromPos !== null && fromPos !== undefined && fromPos >= 0 && arr[pos] !== null) { arr[fromPos] = arr[pos]; }
      arr[pos] = sid;
      sel = null;
      commit(arr);
      draw("slot", pos);
      announce(plain(label(sid)) + " placed in box " + (pos + 1) + ".");
    }
    function unplace(pos, thenSelect) {
      var arr = cur(), sid = arr[pos];
      arr[pos] = null;
      sel = thenSelect ? sid : null;
      commit(arr);
      draw("slot", pos);
    }

    pool.addEventListener("dragover", function (e) { if (drag && drag.from !== null) { e.preventDefault(); } });
    pool.addEventListener("drop", function (e) {
      e.preventDefault();
      var d = drag; drag = null;
      if (d && d.from !== null) { unplace(d.from, false); }
    });

    function draw(focusKind, focusKey) {
      clear(pool); clear(slots);
      var arr = cur(), focusNode = null;
      poolOrder.forEach(function (sid) {
        if (arr.indexOf(sid) >= 0) { return; }
        var chip = rich(el("button", {
          type: "button", class: "chip" + (sel === sid ? " is-selected" : ""), "data-id": sid,
          draggable: "true", "aria-pressed": sel === sid ? "true" : "false"
        }), label(sid));
        chip.addEventListener("click", function () {
          sel = sel === sid ? null : sid;
          draw("chip", sid);
          if (sel) { announce("Selected. Now select a numbered box."); }
        });
        chip.addEventListener("dragstart", function (e) {
          drag = { sid: sid, from: null };
          if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", sid); } catch (err) { /* ignore */ } }
        });
        chip.addEventListener("dragend", function () { drag = null; });
        pool.appendChild(chip);
        if (focusKind === "chip" && focusKey === sid) { focusNode = chip; }
      });
      if (!pool.firstChild) { pool.appendChild(el("p", { class: "muted", text: "All steps placed." })); }

      arr.forEach(function (sid, pos) {
        var slot = el("button", {
          type: "button", class: "slot" + (sid ? " is-filled" : ""), "data-pos": String(pos),
          "aria-label": "Box " + (pos + 1) + ": " + (sid ? plain(label(sid)) : "empty")
        });
        if (sid) { rich(slot, label(sid)); slot.setAttribute("draggable", "true"); slot.setAttribute("data-id", sid); }
        else { slot.textContent = "Place a step here"; }
        slot.addEventListener("click", function () {
          if (sel) { place(pos, sel, cur().indexOf(sel)); }
          else if (sid) { unplace(pos, true); announce("Picked up. Select another box to move it."); }
          else { announce("Select a step first."); }
        });
        slot.addEventListener("dragstart", function (e) {
          if (!sid) { e.preventDefault(); return; }
          drag = { sid: sid, from: pos };
          if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", sid); } catch (err) { /* ignore */ } }
        });
        slot.addEventListener("dragend", function () { drag = null; });
        slot.addEventListener("dragover", function (e) { if (!drag) { return; } e.preventDefault(); if (e.dataTransfer) { e.dataTransfer.dropEffect = "move"; } });
        slot.addEventListener("drop", function (e) {
          e.preventDefault();
          var d = drag; drag = null;
          if (d) { place(pos, d.sid, d.from); }
        });
        var clearBtn = el("button", { type: "button", class: "mini-btn slot-clear", "aria-label": "Clear box " + (pos + 1), text: "Clear" });
        clearBtn.hidden = !sid;
        clearBtn.addEventListener("click", function () { unplace(pos, false); });
        slots.appendChild(el("li", { class: "match-row" }, [
          el("span", { class: "match-left order-num", text: String(pos + 1) }), slot, clearBtn
        ]));
        if (focusKind === "slot" && focusKey === pos) { focusNode = slot; }
      });
      if (focusNode) { focusNode.focus(); }
    }
    draw(null, null);
  }

  /* ---------- performance-based: match ---------- */

  function mountMatch(host, it) {
    var id = it.id, chips = session.lay[id];
    var sel = null, drag = null;
    var content = pbqShell(host, it, "Drag an answer onto a slot. Without a mouse: select an answer, then select the slot. " +
      (it.reuse ? "Answers may be used more than once." : "Each answer can be used once."));
    var pool = el("div", { class: "match-pool", role: "group", "aria-label": "Available answers" });
    var rows = el("ul", { class: "match-rows" });
    content.appendChild(el("div", { class: "match" }, [rows, pool]));

    function cur() {
      var m = {}, a = session.ans[id];
      if (a) { Object.keys(a).forEach(function (k) { m[k] = a[k]; }); }
      return m;
    }
    function commit(m) {
      if (Object.keys(m).length) { session.ans[id] = m; } else { delete session.ans[id]; }
      touch();
    }
    function rightText(rid) { return textOfPart(it.data.right, rid, "text"); }

    function assign(lid, rid, fromLid) {
      var m = cur();
      if (fromLid && fromLid !== lid) { delete m[fromLid]; }
      if (!it.reuse) { Object.keys(m).forEach(function (k) { if (m[k] === rid) { delete m[k]; } }); }
      m[lid] = rid;
      sel = null;
      commit(m);
      draw("slot", lid);
      announce(plain(rightText(rid)) + " placed.");
    }
    function unassign(lid, thenSelect) {
      var m = cur(), rid = m[lid];
      delete m[lid];
      sel = thenSelect ? rid : null;
      commit(m);
      draw("slot", lid);
    }

    pool.addEventListener("dragover", function (e) { if (drag && drag.from) { e.preventDefault(); } });
    pool.addEventListener("drop", function (e) {
      e.preventDefault();
      var d = drag;
      drag = null;
      if (d && d.from) { unassign(d.from, false); }
    });

    function draw(focusKind, focusId) {
      clear(pool);
      clear(rows);
      var m = cur(), focusNode = null;
      var usedIds = Object.keys(m).map(function (k) { return m[k]; });
      chips.forEach(function (rid) {
        var used = !it.reuse && usedIds.indexOf(rid) >= 0;
        var chip = rich(el("button", {
          type: "button", class: "chip" + (sel === rid ? " is-selected" : "") + (used ? " is-used" : ""),
          "data-id": rid, draggable: "true", "aria-pressed": sel === rid ? "true" : "false"
        }), rightText(rid));
        if (used) { chip.appendChild(el("span", { class: "sr-only", text: " (already placed)" })); }
        chip.addEventListener("click", function () {
          sel = sel === rid ? null : rid;
          draw("chip", rid);
          if (sel) { announce("Selected. Now select a slot."); }
        });
        chip.addEventListener("dragstart", function (e) {
          drag = { rid: rid, from: null };
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            try { e.dataTransfer.setData("text/plain", rid); } catch (err) { /* ignore */ }
          }
        });
        chip.addEventListener("dragend", function () { drag = null; });
        pool.appendChild(chip);
        if (focusKind === "chip" && focusId === rid) { focusNode = chip; }
      });

      it.data.left.forEach(function (l) {
        var rid = hasOwn(m, l.id) ? m[l.id] : null;
        var slot = el("button", {
          type: "button", class: "slot" + (rid ? " is-filled" : ""), "data-left": l.id,
          "aria-label": "Slot for " + plain(l.text) + ": " + (rid ? plain(rightText(rid)) : "empty")
        });
        if (rid) { rich(slot, rightText(rid)); slot.setAttribute("draggable", "true"); slot.setAttribute("data-right", rid); }
        else { slot.textContent = "Place an answer here"; }
        slot.addEventListener("click", function () {
          if (sel) { assign(l.id, sel, null); }
          else if (rid) { unassign(l.id, true); announce("Picked up. Select another slot to move it, or select an answer."); }
          else { announce("Select an answer first."); }
        });
        slot.addEventListener("dragstart", function (e) {
          if (!rid) { e.preventDefault(); return; }
          drag = { rid: rid, from: l.id };
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            try { e.dataTransfer.setData("text/plain", rid); } catch (err) { /* ignore */ }
          }
        });
        slot.addEventListener("dragend", function () { drag = null; });
        slot.addEventListener("dragover", function (e) {
          if (!drag) { return; }
          e.preventDefault();
          if (e.dataTransfer) { e.dataTransfer.dropEffect = "move"; }
        });
        slot.addEventListener("drop", function (e) {
          e.preventDefault();
          var d = drag;
          drag = null;
          if (d) { assign(l.id, d.rid, d.from); }
        });
        var clearBtn = el("button", { type: "button", class: "mini-btn slot-clear", "aria-label": "Clear the answer for " + plain(l.text), text: "Clear" });
        clearBtn.hidden = !rid;
        clearBtn.addEventListener("click", function () { unassign(l.id, false); });
        rows.appendChild(el("li", { class: "match-row" }, [
          rich(el("span", { class: "match-left" }), l.text), slot, clearBtn
        ]));
        if (focusKind === "slot" && focusId === l.id) { focusNode = slot; }
      });
      if (focusNode) { focusNode.focus(); }
    }
    draw(null, null);
  }

  /* ---------- performance-based: subnet table ---------- */

  function mountSubnet(host, it) {
    var id = it.id;
    var content = pbqShell(host, it, "Type each value. Addresses and masks in dotted decimal; a prefix can be written /26 or 26.");
    var head = el("tr", null, [el("th", { scope: "col", text: "Subnet" })]);
    it.data.columns.forEach(function (c) { head.appendChild(el("th", { scope: "col", text: COL_LABELS[c] })); });
    var tbody = el("tbody");
    it.data.rows.forEach(function (r, ri) {
      var tr = el("tr", null, [rich(el("th", { scope: "row" }), r.label)]);
      it.data.columns.forEach(function (c, ci) {
        var inputId = "sn-" + ri + "-" + ci;
        var input = el("input", {
          type: "text", id: inputId, class: "cell-input", "data-row": r.id, "data-col": c, maxlength: "40",
          autocomplete: "off", autocapitalize: "off", spellcheck: "false", inputmode: c === "prefix" ? "text" : "decimal",
          "aria-label": plain(r.label) + ": " + COL_LABELS[c]
        });
        input.value = cellValue(session.ans[id], r.id, c);
        input.addEventListener("input", function () {
          var a = session.ans[id] || {};
          var row = hasOwn(a, r.id) ? a[r.id] : {};
          var v = input.value.replace(BAD_CHARS, "").slice(0, 40);
          if (v === "") { delete row[c]; } else { row[c] = v; }
          if (Object.keys(row).length) { a[r.id] = row; } else { delete a[r.id]; }
          if (Object.keys(a).length) { session.ans[id] = a; } else { delete session.ans[id]; }
          touch();
        });
        tr.appendChild(el("td", null, [
          el("label", { class: "cell-label", for: inputId, "aria-hidden": "true", text: COL_LABELS[c] }), input
        ]));
      });
      tbody.appendChild(tr);
    });
    content.appendChild(el("table", { class: "subnet-table" }, [el("thead", null, [head]), tbody]));
  }

  /* ---------- solution (practice feedback and answer review) ---------- */

  function tag(cls, text) { return el("span", { class: "tag " + cls, text: text }); }

  function scrollTable(caption, headCells, bodyRows) {
    var head = el("tr");
    headCells.forEach(function (h) { head.appendChild(el("th", { scope: "col", text: h })); });
    var tbody = el("tbody");
    bodyRows.forEach(function (r) { tbody.appendChild(r); });
    return el("div", { class: "table-wrap", tabindex: "0", role: "group", "aria-label": caption }, [
      el("table", { class: "data-table" }, [el("caption", { class: "sr-only", text: caption }), el("thead", null, [head]), tbody])
    ]);
  }

  function resultCell(ok) {
    return el("td", null, [tag(ok ? "tag-correct" : "tag-wrong", ok ? "Correct" : "Incorrect")]);
  }

  function solutionView(it, ans, lay, g) {
    var box = el("div", { class: "solution" });
    var verdict = !ans ? "Not answered" : g.full ? "Correct" : (isPbq(it) && g.good > 0 ? "Partially correct" : "Incorrect");
    var line = el("p", { class: "verdict " + (g.full ? "is-correct" : "is-wrong") }, [el("strong", { text: verdict })]);
    if (isPbq(it)) {
      line.appendChild(document.createTextNode(" - " + g.good + " of " + g.total + " parts right, " + fmtNum(g.points) + " of " + g.possible + " points."));
    }
    box.appendChild(line);

    if (it.type === "single" || it.type === "multiple") {
      var ul = el("ul", { class: "sol-options" });
      var order = Array.isArray(lay) && lay.length === it.options.length ? lay : optionIds(it);
      order.forEach(function (oid, i) {
        var o = optionOf(it, oid);
        var chosen = !!ans && ans.indexOf(oid) >= 0;
        var correct = it.answer.correct.indexOf(oid) >= 0;
        var headLine = el("p", { class: "sol-opt-head" }, [
          el("span", { class: "opt-letter", text: LETTERS[i] + "." }),
          rich(el("span", { class: "opt-text" }), o.text)
        ]);
        if (chosen) { headLine.appendChild(tag("tag-yours", "Your answer")); }
        if (correct) { headLine.appendChild(tag("tag-correct", "Correct answer")); }
        ul.appendChild(el("li", {
          class: "sol-opt" + (correct ? " is-correct" : "") + (chosen && !correct ? " is-wrong" : ""), "data-opt": oid
        }, [headLine, rich(el("p", { class: "sol-why" }), o.why)]));
      });
      box.appendChild(ul);
    } else if (it.type === "order") {
      box.appendChild(scrollTable("Your order compared with the correct order", ["Position", "Your order", "Correct order", "Result"],
        it.answer.order.map(function (cid, i) {
          var mine = ans ? ans.order[i] : null;
          return el("tr", null, [
            el("td", { text: String(i + 1) }),
            mine ? rich(el("td"), textOfPart(it.data.items, mine, "text")) : el("td", { class: "muted", text: "Not answered" }),
            rich(el("td"), textOfPart(it.data.items, cid, "text")),
            resultCell(mine === cid)
          ]);
        })));
    } else if (it.type === "match") {
      box.appendChild(scrollTable("Your matches compared with the correct matches", ["Item", "Your answer", "Correct answer", "Result"],
        it.data.left.map(function (l) {
          var mine = ans && hasOwn(ans, l.id) ? ans[l.id] : null;
          var key = it.answer.pairs[l.id];
          return el("tr", null, [
            rich(el("th", { scope: "row" }), l.text),
            mine ? rich(el("td"), textOfPart(it.data.right, mine, "text")) : el("td", { class: "muted", text: "Not answered" }),
            rich(el("td"), textOfPart(it.data.right, key, "text")),
            resultCell(mine === key)
          ]);
        })));
    } else {
      box.appendChild(scrollTable("Your table compared with the correct values", ["Subnet"].concat(it.data.columns.map(function (c) { return COL_LABELS[c]; })),
        it.data.rows.map(function (r) {
          var tr = el("tr", null, [rich(el("th", { scope: "row" }), r.label)]);
          it.data.columns.forEach(function (c) {
            var mine = cellValue(ans, r.id, c), ok = cellCorrect(it, ans, r.id, c);
            var td = el("td", { class: ok ? "cell-ok" : "cell-bad" }, [
              el("span", { class: "cell-mine", text: mine === "" ? "(empty)" : mine }),
              tag(ok ? "tag-correct" : "tag-wrong", ok ? "Correct" : "Incorrect")
            ]);
            if (!ok) { td.appendChild(el("span", { class: "cell-key", text: "Expected: " + it.answer.rows[r.id][c] })); }
            tr.appendChild(td);
          });
          return tr;
        })));
    }

    box.appendChild(el("div", { class: "explanation" }, [
      el("h3", { text: "Explanation" }),
      rich(el("p"), it.explanation),
      el("p", { class: "muted small", text: "Objective " + it.objective + " - " + bank.objTitle[it.objective] + ". Question id " + it.id + "." })
    ]));
    return box;
  }

  function checkAnswer() {
    if (!session || session.mode !== "practice" || view !== "item") { return; }
    var it = curItem();
    if (isLocked(it.id)) { return; }
    if (!isPbq(it) && !isAnswered(it, session.ans[it.id])) { return; }
    session.checked[it.id] = true;
    saveSession();
    renderItem();
    var g = grade(it, session.ans[it.id]);
    announce(g.full ? "Correct." : "Not fully correct. The explanation is shown.");
    $("item-feedback").setAttribute("tabindex", "-1");
    $("item-feedback").focus();
  }

  /* ---------- review screen ---------- */

  function sessionCounts() {
    var answered = 0, flagged = 0;
    session.ids.forEach(function (id) {
      if (isAnswered(bank.byId[id], session.ans[id])) { answered++; }
      if (session.flags[id]) { flagged++; }
    });
    return { total: session.ids.length, answered: answered, unanswered: session.ids.length - answered, flagged: flagged };
  }

  function renderReview() {
    var c = sessionCounts();
    $("review-title").textContent = session.mode === "exam" ? "Review" : "Review (practice)";
    $("review-summary").textContent = c.answered + " answered, " + c.unanswered + " unanswered, " + c.flagged + " flagged, " + c.total + " in total. Select a question to go to it.";
    $("btn-end").textContent = session.mode === "exam" ? "End Exam" : "Finish practice";
    Array.prototype.forEach.call($("review-filters").querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-filter") === reviewFilter ? "true" : "false");
    });
    var grid = clear($("review-grid")), shown = 0;
    session.ids.forEach(function (id, i) {
      var answered = isAnswered(bank.byId[id], session.ans[id]), flagged = session.flags[id] === true;
      if (reviewFilter === "unanswered" && answered) { return; }
      if (reviewFilter === "flagged" && !flagged) { return; }
      shown++;
      var cell = el("button", {
        type: "button", class: "review-cell" + (answered ? " is-answered" : " is-unanswered") + (flagged ? " is-flagged" : ""),
        "data-idx": String(i), "data-state": answered ? "answered" : "unanswered", "data-flagged": flagged ? "true" : "false"
      }, [
        el("span", { class: "cell-num", text: "Question " + (i + 1) }),
        el("span", { class: "cell-state", text: answered ? "Answered" : "Unanswered" }),
        flagged ? el("span", { class: "cell-flag", text: "Flagged" }) : null
      ]);
      cell.addEventListener("click", function () { goTo(i); });
      grid.appendChild(cell);
    });
    $("review-empty").hidden = shown > 0;
  }

  function openReview() {
    if (!session) { return; }
    tool = null;
    renderReview();
    showView("review");
  }

  function endAttempt() {
    if (!session) { return; }
    var c = sessionCounts(), exam = session.mode === "exam";
    var lines = ["You answered " + c.answered + " of " + c.total + " questions (" + c.unanswered + " unanswered, " + c.flagged + " flagged)."];
    if (exam) { lines.push("Unanswered questions count as incorrect."); }
    else { lines.push("Only the questions you checked are counted in the summary."); }
    lines.push("You cannot return to the questions after ending.");
    confirmDialog(exam ? "End the exam?" : "Finish this practice session?", lines, exam ? "End Exam" : "Finish", true).then(function (ok) {
      if (ok) { finish("user"); }
    });
  }

  /* ---------- finishing and report ---------- */

  function computeResult(reason) {
    var exam = session.mode === "exam";
    var domains = {};
    bank.domains.forEach(function (d) { domains[d.id] = { earned: 0, possible: 0, count: 0 }; });
    var earned = 0, possible = 0, count = 0, unanswered = 0, missed = new Set();
    var rows = session.ids.map(function (id, i) {
      var it = bank.byId[id], ans = session.ans[id];
      var g = grade(it, ans);
      var attempted = exam || session.checked[id] === true;
      if (attempted) {
        earned += g.points; possible += g.possible; count++;
        domains[it.domain].earned += g.points; domains[it.domain].possible += g.possible; domains[it.domain].count++;
        if (!g.full) { missed.add(it.objective); }
        if (!isAnswered(it, ans)) { unanswered++; }
      }
      return { id: id, n: i + 1, g: g, attempted: attempted };
    });
    var p = possible > 0 ? earned / possible : 0;
    var scaled = scaledScore(p);
    var used = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
    return {
      mode: session.mode, reason: reason, rows: rows, ans: session.ans, lay: session.lay, note: session.note,
      earned: earned, possible: possible, p: p, scaled: scaled, pass: exam ? scaled >= CFG.passScore : p >= CFG.cut,
      count: count, total: session.ids.length, unanswered: unanswered,
      usedSec: exam ? Math.min(used, session.durationSec) : used, durationSec: session.durationSec,
      domains: domains, missed: OBJECTIVE_IDS.filter(function (o) { return missed.has(o); })
    };
  }

  function finish(reason) {
    if (!session) { return; }
    stopTicker();
    if (activeDialog) { activeDialog.close(null); }
    result = computeResult(reason);
    recordProgress(result);
    lsDel("session");
    session = null;
    tool = null;
    answersFilter = "all";
    renderReport();
    showView("report");
    if (reason === "time") {
      openDialog({
        title: "Time expired", alert: true, dismissable: false,
        lines: ["The exam time is over. Your answers were submitted as they were; unanswered questions count as incorrect."],
        actions: [{ label: "See results", value: "ok", primary: true }]
      });
    }
  }

  function bar(percent, cls) {
    var fill = el("span", { class: "bar-fill" });
    fill.style.setProperty("width", Math.max(0, Math.min(100, percent)) + "%");
    return el("span", { class: "bar " + (cls || ""), "aria-hidden": "true" }, [fill]);
  }

  function renderReport() {
    var r = result, body = clear($("report-body")), exam = r.mode === "exam";
    $("report-title").textContent = exam ? "Score report" : "Practice summary";
    $("btn-review-answers").disabled = r.count === 0;
    var card = el("div", { class: "card score-card" });
    if (exam) {
      card.appendChild(el("p", { class: "score-label", text: "Estimated score (approximation, not an official CompTIA score)" }));
      card.appendChild(el("p", { id: "report-score", class: "score-value", "data-scaled": String(r.scaled), text: String(r.scaled) }));
      card.appendChild(el("p", { id: "report-result", class: "result " + (r.pass ? "is-pass" : "is-fail"), "data-pass": r.pass ? "true" : "false",
        text: (r.pass ? "PASS" : "FAIL") + " - the passing mark is " + CFG.passScore + " on a scale of 100 to 900." }));
      var marker = el("span", { class: "scale-marker" });
      marker.style.setProperty("left", ((r.scaled - 100) / 8) + "%");
      var passMark = el("span", { class: "scale-pass" });
      passMark.style.setProperty("left", ((CFG.passScore - 100) / 8) + "%");
      card.appendChild(el("div", { class: "scale", "aria-hidden": "true" }, [passMark, marker]));
      card.appendChild(el("p", { class: "scale-legend muted small", "aria-hidden": "true" }, [
        el("span", { text: "100" }), el("span", { text: "Pass " + CFG.passScore }), el("span", { text: "900" })
      ]));
    } else {
      card.appendChild(el("p", { class: "score-label", text: "Share of points on the questions you checked" }));
      card.appendChild(el("p", { id: "report-score", class: "score-value", text: r.count ? pct(r.earned, r.possible) + " %" : "-" }));
      card.appendChild(el("p", { id: "report-result", class: "result", text: r.count ? r.rows.filter(function (x) { return x.attempted && x.g.full; }).length + " of " + r.count + " checked questions fully correct." : "No question was checked, so nothing was recorded." }));
    }
    var raw = "Points: " + fmtNum(r.earned) + " of " + fmtNum(r.possible) + " (" + pct(r.earned, r.possible) + " %). Questions: " + r.count +
      (exam ? "" : " of " + r.total) + ". Unanswered: " + r.unanswered + ". Time used: " + fmtTime(r.usedSec) + (exam ? " of " + fmtTime(r.durationSec) : "") + ".";
    card.appendChild(el("p", { id: "report-raw", "data-earned": fmtNum(r.earned), "data-possible": fmtNum(r.possible), text: raw }));
    if (r.note) { card.appendChild(el("p", { class: "notice", text: r.note })); }
    body.appendChild(card);

    body.appendChild(el("h2", { text: "Results per domain" }));
    var rows = bank.domains.map(function (d) {
      var s = r.domains[d.id], percent = pct(s.earned, s.possible);
      return el("tr", { "data-domain": String(d.id) }, [
        el("th", { scope: "row", text: d.id + ".0 " + d.title }),
        el("td", { text: d.weight + " %" }),
        el("td", { text: String(s.count) }),
        s.count ? el("td", { class: "bar-cell" }, [el("span", { class: "bar-num", text: percent + " %" }), bar(percent, percent < 70 ? "is-low" : "")]) : el("td", { class: "muted", text: "No question" })
      ]);
    });
    var table = scrollTable("Results per domain", ["Domain", "Exam weight", "Questions", "Points earned"], rows);
    table.id = "report-domains";
    body.appendChild(table);

    body.appendChild(el("h2", { text: "Objectives to revisit" }));
    var missed = el("ul", { id: "report-missed", class: "plain-list" });
    if (!r.missed.length) {
      missed.appendChild(el("li", { text: r.count ? "None: every question was fully correct." : "Nothing to show." }));
    }
    r.missed.forEach(function (o) {
      missed.appendChild(el("li", { "data-objective": o }, [el("strong", { text: o }), " " + bank.objTitle[o]]));
    });
    body.appendChild(missed);
    body.appendChild(el("p", { class: "muted small", text: exam ?
      "How the estimate works: multiple choice 1 point (all or nothing); performance-based 3 points with partial credit, nothing under half right. The share of points is mapped onto 100-900 with an assumed passing point of 75 % = 720. The real exam uses statistical scaling that is not published, and this bank is smaller than the real item pool, so repeated attempts inflate the score." :
      "Practice sessions do not produce an estimated exam score. Use Exam mode for that." }));
  }

  /* ---------- answer review ---------- */

  function renderAnswers() {
    var r = result, list = clear($("answers-list"));
    Array.prototype.forEach.call($("answers-filters").querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-filter") === answersFilter ? "true" : "false");
    });
    var shown = 0;
    r.rows.forEach(function (row) {
      if (!row.attempted) { return; }
      if (answersFilter === "missed" && row.g.full) { return; }
      shown++;
      var it = bank.byId[row.id];
      var exhibit = el("div");
      renderExhibit(exhibit, it);
      list.appendChild(el("article", { class: "card item answer-item", "data-item-id": it.id, "data-full": row.g.full ? "true" : "false" }, [
        el("header", { class: "item-head" }, [
          el("h2", { text: "Question " + row.n }),
          el("span", { class: "badge", text: kindLabel(it) })
        ]),
        rich(el("div", { class: "stem" }), it.stem, true),
        exhibit,
        isPbq(it) ? rich(el("p", { class: "pbq-prompt" }), it.data.prompt) : null,
        solutionView(it, hasOwn(r.ans, row.id) ? r.ans[row.id] : null, r.lay[row.id], row.g)
      ]));
    });
    if (!shown) { list.appendChild(el("p", { class: "muted", text: "No question matches this filter." })); }
  }

  /* ---------- progress ---------- */

  function renderProgress() {
    var p = readProgress();
    var attempts = clear($("progress-attempts"));
    if (!p.attempts.length) {
      attempts.appendChild(el("p", { class: "muted", text: "No attempt recorded yet." }));
    } else {
      attempts.appendChild(scrollTable("Attempt history", ["Date", "Mode", "Questions", "Result", "Time used"], p.attempts.map(function (a) {
        var res = a.mode === "exam" ? a.scaled + " (" + (a.pass ? "pass" : "fail") + ", estimated)" : pct(a.earned, a.possible) + " % of points";
        return el("tr", { "data-mode": a.mode }, [
          el("td", { text: new Date(a.t).toLocaleString() }),
          el("td", { text: a.mode === "exam" ? "Exam" : "Practice" }),
          el("td", { text: String(a.count) }),
          el("td", { text: res }),
          el("td", { text: fmtTime(a.usedSec) })
        ]);
      })));
    }
    var objs = clear($("progress-objectives"));
    bank.domains.forEach(function (d) {
      objs.appendChild(el("h3", { text: d.id + ".0 " + d.title }));
      var ul = el("ul", { class: "obj-list" });
      bank.objectives.forEach(function (o) {
        if (o.domain !== d.id) { return; }
        var v = hasOwn(p.objectives, o.id) ? p.objectives[o.id] : null;
        var percent = v ? pct(v[0], v[1]) : 0;
        ul.appendChild(el("li", { class: "obj-row", "data-objective": o.id, "data-seen": v ? String(v[1]) : "0" }, [
          el("span", { class: "obj-name" }, [el("strong", { text: o.id }), " " + o.title]),
          v ? el("span", { class: "obj-score", text: v[0] + " of " + v[1] + " correct (" + percent + " %)" }) : el("span", { class: "obj-score muted", text: "Not attempted yet" }),
          v ? bar(percent, percent < 70 ? "is-low" : "") : null
        ]));
      });
      objs.appendChild(ul);
    });
  }

  function clearData() {
    confirmDialog("Clear all saved data?", ["This erases the attempt history, the accuracy per objective, any attempt in progress and your display settings from this browser. It cannot be undone."], "Clear data", true).then(function (ok) {
      if (!ok) { return; }
      lsClearAll();
      saved = null;
      settings = readSettings();
      applySettings();
      renderProgress();
      announce("Saved data cleared.");
      $("progress-title").focus();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  function isTypingTarget(t) {
    if (!t || !t.tagName) { return false; }
    var tag = t.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) { return true; }
    return tag === "INPUT" && ["text", "number", "search", "email", "url", "password", "tel"].indexOf(t.type) >= 0;
  }

  function onKeydown(e) {
    if (activeDialog || !session || e.ctrlKey || e.metaKey) { return; }
    if (e.altKey) {
      if (e.shiftKey) { return; }
      if (e.code === "KeyN" && view === "item") { e.preventDefault(); goTo(session.idx + 1); }
      else if (e.code === "KeyP" && view === "item") { e.preventDefault(); goTo(session.idx - 1); }
      else if (e.code === "KeyF" && view === "item") { e.preventDefault(); toggleFlag(); }
      else if (e.code === "KeyR") {
        e.preventDefault();
        if (view === "item") { openReview(); } else if (view === "review") { goTo(session.idx); }
      }
      return;
    }
    if (view !== "item" || isTypingTarget(e.target)) { return; }
    if (/^[1-6]$/.test(e.key)) { e.preventDefault(); pickOptionByIndex(Number(e.key) - 1); }
  }

  function bind() {
    $("nav-home").addEventListener("click", function () { renderHome(); showView("home"); });
    $("nav-progress").addEventListener("click", function () { renderProgress(); showView("progress"); });
    $("btn-start-exam").addEventListener("click", startExam);
    $("btn-start-practice").addEventListener("click", startPractice);
    $("btn-resume").addEventListener("click", resumeSaved);
    $("btn-discard").addEventListener("click", discardSaved);

    $("btn-timer-toggle").addEventListener("click", function () { settings.timerHidden = !settings.timerHidden; saveSettings(); });
    $("btn-font-dec").addEventListener("click", function () { if (settings.font > 0) { settings.font--; saveSettings(); } });
    $("btn-font-inc").addEventListener("click", function () { if (settings.font < CFG.fontLevels - 1) { settings.font++; saveSettings(); } });
    $("btn-theme").addEventListener("click", function () {
      settings.theme = settings.theme === "auto" ? "light" : settings.theme === "light" ? "dark" : "auto";
      saveSettings();
    });

    $("btn-flag").addEventListener("click", toggleFlag);
    $("btn-highlight").addEventListener("click", function () { setTool("h"); });
    $("btn-strike").addEventListener("click", function () { setTool("s"); });
    $("btn-prev").addEventListener("click", function () { goTo(session.idx - 1); });
    $("btn-next").addEventListener("click", function () { goTo(session.idx + 1); });
    $("btn-review").addEventListener("click", openReview);
    $("btn-check").addEventListener("click", checkAnswer);

    Array.prototype.forEach.call($("review-filters").querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () { reviewFilter = b.getAttribute("data-filter"); renderReview(); });
    });
    $("btn-back-to-item").addEventListener("click", function () { goTo(session.idx); });
    $("btn-end").addEventListener("click", endAttempt);

    $("btn-review-answers").addEventListener("click", function () { if (result) { renderAnswers(); showView("answers"); } });
    $("btn-report-progress").addEventListener("click", function () { renderProgress(); showView("progress"); });
    $("btn-new").addEventListener("click", function () { renderHome(); showView("home"); });
    Array.prototype.forEach.call($("answers-filters").querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () { answersFilter = b.getAttribute("data-filter"); renderAnswers(); });
    });
    $("btn-back-to-report").addEventListener("click", function () { showView("report"); });
    $("btn-clear-data").addEventListener("click", clearData);

    document.addEventListener("keydown", onKeydown);
  }

  /* ------------------------------------------------------------------ */
  /* Start                                                               */
  /* ------------------------------------------------------------------ */

  function init() {
    settings = readSettings();
    applySettings();
    bind();
    loadBank().then(function () {
      buildPracticeForm();
      renderHome();
      showView("home", true);
    }).catch(function (e) {
      if (window.console && console.warn) { console.warn("Start-up problem: " + (e && e.message ? e.message : e)); }
      bank.notices.push("The simulator could not start correctly. Reload the page; if the problem stays, please open an issue.");
      renderHome();
      showView("home", true);
    });
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
