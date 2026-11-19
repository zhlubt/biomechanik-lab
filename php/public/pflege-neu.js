/* =========================================================
   Pflege: Neue Übung anlegen.

   Das Formular sammelt die komplette Übung im Dateiformat von
   private/content (dieselbe Form, die eine KI nach der Anleitung
   liefert). Gespeichert wird über create.php, das alles noch einmal
   serverseitig prüft (private/lib/exercise.php).
========================================================= */
(function () {
  "use strict";

  var NU = window.NU || {};
  var $ = function (id) { return document.getElementById(id); };
  var form = $("nuForm");
  if (!form) return;
  var PALETTE = ["#3a63d8", "#d98018", "#1aa56a", "#9a5bd4", "#d6256e", "#1098a5"];
  var dirty = false;

  function num(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim().replace(",", ".");
    if (s === "") return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }
  function val(id) { var el = $(id); return el ? el.value.trim() : ""; }
  function setVal(id, v) { var el = $(id); if (el && v !== undefined && v !== null) el.value = String(v); }

  /* ---------- Zeilen-Editor (Legende, Glossar, Gerüst, …) ---------- */
  var ROWS = {
    phases:     { add: "Sprungmarke", fields: [{ k: "label", ph: "z. B. Absprung", w: "2fr" }, { k: "t", ph: "Sekunde, z. B. 1,25", w: "1fr" }] },
    legend:     { add: "Legendeneintrag", fields: [{ k: "color", type: "color", w: "52px" }, { k: "label", ph: "Bezeichnung, z. B. Fz · vertikal", w: "1.4fr" }, { k: "hint", ph: "Erklärung in einem Satz", w: "2.6fr", type: "textarea" }, { k: "colorName", ph: "Farbwort", w: "0.8fr" }] },
    glossary:   { add: "Begriff", fields: [{ k: "term", ph: "Begriff", w: "1fr" }, { k: "definition", ph: "Definition in ein bis zwei Sätzen", w: "3fr", type: "textarea" }] },
    scaffold:   { add: "Schritt", fields: [{ k: "step", ph: "z. B. Sehen", w: "1fr" }, { k: "text", ph: "Leitfrage für diesen Schritt", w: "3fr", type: "textarea" }] },
    categories: { add: "Kategorie", fields: [{ k: "color", type: "color", w: "52px" }, { k: "key", ph: "schluessel", w: "1fr" }, { k: "label", ph: "Anzeige, z. B. Fachsprache", w: "2fr" }] },
    markers:    { add: "Demo-Marker", fields: [{ k: "category", ph: "Kategorie-Schlüssel", w: "1fr", list: "nu_catkeys" }, { k: "quote", ph: "wörtliches Zitat", w: "2fr" }, { k: "question", ph: "Rückfrage", w: "2fr" }, { k: "nudge", ph: "Tipp: wohin schauen", w: "1.6fr" }] }
  };

  function rowsHost(name) { return form.querySelector('[data-rows="' + name + '"]'); }

  function addRow(name, values) {
    var def = ROWS[name], host = rowsHost(name);
    if (!def || !host) return;
    var list = host.querySelector(".rows-list");
    var row = document.createElement("div");
    row.className = "row-item";
    row.style.gridTemplateColumns = def.fields.map(function (f) { return f.w; }).join(" ") + " auto";
    def.fields.forEach(function (f) {
      var el;
      if (f.type === "textarea") { el = document.createElement("textarea"); el.rows = 2; }
      else { el = document.createElement("input"); el.type = f.type === "color" ? "color" : "text"; }
      el.dataset.k = f.k;
      if (f.ph) { el.placeholder = f.ph; el.setAttribute("aria-label", f.ph); }
      if (f.list) el.setAttribute("list", f.list);
      var v = values && values[f.k];
      if (f.type === "color") el.value = /^#[0-9a-f]{6}$/i.test(v || "") ? v : PALETTE[list.children.length % PALETTE.length];
      else if (v !== undefined && v !== null) el.value = String(v);
      row.appendChild(el);
    });
    var tools = document.createElement("div");
    tools.className = "row-tools";
    [["↑", "Nach oben", -1], ["↓", "Nach unten", 1]].forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "ctrl row-btn"; btn.textContent = b[0]; btn.title = b[1]; btn.setAttribute("aria-label", b[1]);
      btn.addEventListener("click", function () {
        if (b[2] < 0 && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
        if (b[2] > 0 && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
        changed();
      });
      tools.appendChild(btn);
    });
    var del = document.createElement("button");
    del.type = "button"; del.className = "ctrl row-btn"; del.textContent = "×"; del.title = "Entfernen"; del.setAttribute("aria-label", "Zeile entfernen");
    del.addEventListener("click", function () { row.remove(); changed(); });
    tools.appendChild(del);
    row.appendChild(tools);
    list.appendChild(row);
    return row;
  }

  function getRows(name) {
    var host = rowsHost(name);
    if (!host) return [];
    var out = [];
    host.querySelectorAll(".row-item").forEach(function (row) {
      var o = {}, any = false;
      row.querySelectorAll("[data-k]").forEach(function (el) {
        o[el.dataset.k] = el.value.trim();
        if (el.type !== "color" && el.value.trim() !== "") any = true;
      });
      if (any) out.push(o);
    });
    return out;
  }

  function setRows(name, arr) {
    var host = rowsHost(name);
    if (!host) return;
    host.querySelector(".rows-list").innerHTML = "";
    (arr || []).forEach(function (v) { addRow(name, v); });
  }

  Object.keys(ROWS).forEach(function (name) {
    var host = rowsHost(name);
    if (!host) return;
    var list = document.createElement("div"); list.className = "rows-list";
    var add = document.createElement("button");
    add.type = "button"; add.className = "ctrl rows-add"; add.textContent = "+ " + ROWS[name].add;
    add.addEventListener("click", function () { var r = addRow(name, {}); if (r) r.querySelector("input:not([type=color]),textarea").focus(); changed(); });
    host.appendChild(list); host.appendChild(add);
  });
  var catList = document.createElement("datalist"); catList.id = "nu_catkeys"; form.appendChild(catList);
  function refreshCatKeys() {
    catList.innerHTML = getRows("categories").map(function (c) { return '<option value="' + (c.key || "").replace(/"/g, "") + '">'; }).join("");
  }

  /* ---------- Medientyp ---------- */
  var kindsHost = $("nu_kinds");
  Object.keys(NU.kinds || {}).forEach(function (k, i) {
    var lab = document.createElement("label");
    lab.className = "nu-kind";
    lab.innerHTML = '<input type="radio" name="kind" value="' + k + '"' + (i === 0 ? " checked" : "") + "> <span></span>";
    lab.querySelector("span").textContent = NU.kinds[k];
    kindsHost.appendChild(lab);
  });
  function kind() { var r = form.querySelector('input[name="kind"]:checked'); return r ? r.value : "video"; }
  function setKind(k) { var r = form.querySelector('input[name="kind"][value="' + k + '"]'); if (r) { r.checked = true; showPanels(); } }
  function showPanels() {
    var k = kind();
    form.querySelectorAll(".nu-panel").forEach(function (p) { p.hidden = p.dataset.kind.split(" ").indexOf(k) < 0; });
  }
  kindsHost.addEventListener("change", showPanels);

  /* ---------- YouTube: Link und Ausschnitt live pruefen (massgeblich prueft der Server) ---------- */
  function ytId(u) {
    u = (u || "").trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(u)) return u;
    var m = u.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  }
  function parseTime(v) {
    v = String(v == null ? "" : v).trim().replace(",", ".");
    if (!v) return null;
    if (/^\d+(\.\d+)?$/.test(v)) return parseFloat(v);
    var p = v.match(/^(?:(\d+):)?(\d+):([0-5]?\d(?:\.\d+)?)$/) ;
    if (p) return (+(p[1] || 0)) * 3600 + (+p[2]) * 60 + parseFloat(p[3]);
    var hms = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/i);
    if (hms && (hms[1] || hms[2] || hms[3])) return (+(hms[1] || 0)) * 3600 + (+(hms[2] || 0)) * 60 + parseFloat(hms[3] || 0);
    return NaN;
  }
  function fmtTime(x) { x = +x || 0; var s = x % 60; return Math.floor(x / 60) + ":" + (s < 10 ? "0" : "") + (Math.round(s * 100) / 100); }
  var yInfo = $("nu_yinfo"), yInfoBase = yInfo ? yInfo.innerHTML : "";
  function ytInfo() {
    if (!yInfo) return;
    var url = val("n_yurl"), id = ytId(url), a = parseTime(val("n_ystart")), b = parseTime(val("n_yend")), msg = "";
    if (a === null) { var t = url.match(/[?&](?:t|start)=([0-9hms.]+)/); if (t) { a = parseTime(t[1]); if (!val("n_ystart") && a != null && !isNaN(a)) setVal("n_ystart", fmtTime(a)); } }
    if (url && !id) msg = "Das sieht nicht nach einem YouTube-Link aus.";
    else if (isNaN(a)) msg = "„Ausschnitt ab“ ist keine Zeitangabe (z. B. 20 oder 0:20).";
    else if (isNaN(b)) msg = "„Ausschnitt bis“ ist keine Zeitangabe (z. B. 30 oder 0:30).";
    else if (b != null && b <= (a || 0) + 0.5) msg = "„Ausschnitt bis“ muss nach dem Start liegen.";
    else if (id) {
      var len = b != null ? (b - (a || 0)) : null;
      msg = '<b>Ausschnitt ' + fmtTime(a || 0) + (b != null ? " bis " + fmtTime(b) + " (" + (Math.round(len * 10) / 10) + " s)" : " bis Videoende") + '</b> · ' +
        '<a href="https://www.youtube.com/watch?v=' + id + '&t=' + Math.floor(a || 0) + 's" target="_blank" rel="noopener">auf YouTube prüfen</a>';
    }
    yInfo.innerHTML = (msg ? msg + "<br>" : "") + yInfoBase;
  }
  ["n_yurl", "n_ystart", "n_yend"].forEach(function (id) { var e = $(id); if (e) e.addEventListener("input", ytInfo); });

  var frameSel = $("n_frame");
  (NU.frames || []).forEach(function (f) { var o = document.createElement("option"); o.value = f; o.textContent = f; frameSel.appendChild(o); });
  if (!(NU.frames || []).length) { var o = document.createElement("option"); o.value = ""; o.textContent = "keine Animation vorhanden"; frameSel.appendChild(o); }

  var layersHost = $("nu_layers");
  Object.keys(NU.layers || {}).forEach(function (k) {
    var lab = document.createElement("label"); lab.className = "nu-check";
    lab.innerHTML = '<input type="checkbox" name="hide" value="' + k + '"> <span></span>';
    lab.querySelector("span").textContent = NU.layers[k];
    layersHost.appendChild(lab);
  });

  /* ---------- Bereich / Lektion: Vorschläge aus vorhandenen Übungen ---------- */
  var courses = NU.courses || {};
  $("nu_courses").innerHTML = Object.keys(courses).map(function (c) { return '<option value="' + c + '">' + courses[c].title + "</option>"; }).join("");
  function onCourse() {
    var c = courses[val("n_course")];
    var lessons = c ? c.lessons : {};
    $("nu_lessons").innerHTML = Object.keys(lessons).map(function (l) { return '<option value="' + l + '">' + lessons[l] + "</option>"; }).join("");
    if (!c) return;
    // Bereichs-Einstellungen übernehmen, damit die Kachelgruppe einheitlich bleibt.
    if (!val("n_courseTitle")) setVal("n_courseTitle", c.title);
    if (!val("n_module")) setVal("n_module", c.module);
    if (!val("n_appTitle")) setVal("n_appTitle", c.appTitle);
    if (!val("n_order") && c.order) setVal("n_order", c.order);
  }
  function onLesson() {
    var c = courses[val("n_course")];
    if (c && c.lessons[val("n_lesson")] && !val("n_lessonTitle")) setVal("n_lessonTitle", c.lessons[val("n_lesson")]);
  }
  $("n_course").addEventListener("change", onCourse);
  $("n_lesson").addEventListener("change", onLesson);

  /* ---------- Ablese-Werkzeug: Kalibrieren per Klick ---------- */
  var roBox = $("nu_ro"), calImg = $("nu_calImg"), calStage = $("nu_calStage"), calLines = $("nu_calLines"), calStatus = $("nu_calStatus");
  var calMode = null, objUrl = null;
  function syncRo() { roBox.hidden = !$("n_ro").checked; }
  $("n_ro").addEventListener("change", syncRo);
  function setPreview() {
    var f = $("n_ifile").files && $("n_ifile").files[0];
    if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
    if (f) { objUrl = URL.createObjectURL(f); calImg.src = objUrl; }
    else if (val("n_isrc")) calImg.src = val("n_isrc");
    else calImg.removeAttribute("src");
    calStage.hidden = !calImg.getAttribute("src");
    calStatus.textContent = calStage.hidden ? "Erst ein Bild wählen." : "Knopf wählen, dann ins Bild klicken.";
    drawLines();
  }
  $("n_ifile").addEventListener("change", setPreview);
  $("n_isrc").addEventListener("change", setPreview);
  $("nu_calBtns").addEventListener("click", function (e) {
    var b = e.target.closest("[data-cal]");
    if (!b) return;
    calMode = b.dataset.cal;
    $("nu_calBtns").querySelectorAll("[data-cal]").forEach(function (x) { x.classList.toggle("primary", x === b); });
    calStatus.textContent = calStage.hidden ? "Erst ein Bild wählen." : "Jetzt ins Bild klicken.";
  });
  calStage.addEventListener("click", function (e) {
    if (!calMode) return;
    var r = calImg.getBoundingClientRect();
    var fx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    var fy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    var map = { from: ["n_ro_from", fx], to: ["n_ro_to", fx], top: ["n_ro_top", fy], bottom: ["n_ro_bottom", fy] };
    setVal(map[calMode][0], map[calMode][1].toFixed(4));
    calMode = null;
    $("nu_calBtns").querySelectorAll("[data-cal]").forEach(function (x) { x.classList.remove("primary"); });
    calStatus.textContent = "Gesetzt. Fahre mit der Maus über das Bild, um die Ablesung zu prüfen.";
    drawLines(); changed();
  });
  calStage.addEventListener("mousemove", function (e) {
    if (calMode) return;
    var from = num(val("n_ro_from")), to = num(val("n_ro_to")), mn = num(val("n_ro_min")), mx = num(val("n_ro_max"));
    if (from === null || to === null || mn === null || mx === null || to <= from) return;
    var r = calImg.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
    var v = mn + (fx - from) / (to - from) * (mx - mn);
    var dec = Math.max(0, Math.min(4, num(val("n_ro_dec")) || 0));
    calStatus.textContent = (val("n_ro_label") || "Wert") + ": " + v.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " " + val("n_ro_unit");
  });
  function drawLines() {
    var spec = [["n_ro_from", "v"], ["n_ro_to", "v"], ["n_ro_top", "h"], ["n_ro_bottom", "h"]];
    calLines.innerHTML = spec.map(function (s) {
      var f = num(val(s[0]));
      if (f === null) return "";
      return '<span class="cal-' + s[1] + '" style="' + (s[1] === "v" ? "left" : "top") + ":" + (f * 100) + '%"></span>';
    }).join("");
  }
  ["n_ro_from", "n_ro_to", "n_ro_top", "n_ro_bottom"].forEach(function (id) { $(id).addEventListener("input", drawLines); });

  /* ---------- Sammeln: Formular → Übung (Dateiformat) ---------- */
  function collect(forCheck) {
    var k = kind();
    var m = { label: val("n_mlabel"), alt: val("n_malt"), caption: val("n_mcaption") };
    var phases = getRows("phases").map(function (p) { return { label: p.label, t: num(p.t) }; });
    var pending = function (fileId, placeholder, path) {
      // Beim Prüfen ist die Datei noch nicht hochgeladen: Platzhalter, damit der Server den Rest prüfen kann.
      var f = $(fileId).files && $(fileId).files[0];
      return f ? (forCheck ? placeholder : "") : path;
    };
    if (k === "video") {
      m.type = "video"; m.src = pending("n_vfile", "vid/upload.mp4", val("n_vsrc"));
      m.config = { durationSec: num(val("n_dur")), fps: num(val("n_fps")), phases: phases };
    } else if (k === "youtube") {
      m.type = "youtube"; m.url = val("n_yurl");
      m.config = { start: val("n_ystart"), end: val("n_yend"), fps: num(val("n_yfps")), phases: phases };
    } else if (k === "image") {
      m.type = "image"; m.src = pending("n_ifile", "img/upload.png", val("n_isrc"));
      if ($("n_ro").checked) {
        m.methods = { readout: {
          x: { label: val("n_ro_label"), unit: val("n_ro_unit"), from: num(val("n_ro_from")), to: num(val("n_ro_to")),
               min: num(val("n_ro_min")), max: num(val("n_ro_max")), decimals: num(val("n_ro_dec")), step: num(val("n_ro_step")) },
          guide: { top: num(val("n_ro_top")), bottom: num(val("n_ro_bottom")) }
        } };
      }
    } else if (k === "model3d") {
      m.type = "model3d"; m.src = pending("n_gfile", "model/upload.glb", val("n_gsrc"));
      m.config = { initialHidden: Array.prototype.map.call(form.querySelectorAll('input[name="hide"]:checked'), function (c) { return c.value; }) };
    } else if (k === "frame") {
      m.type = "frame"; m.src = frameSel.value;
    } else {
      m.type = "interactive"; m.component = "JumpForceLab"; m.config = { phases: phases };
    }
    var thumbFile = $("n_tfile").files && $("n_tfile").files[0];
    return {
      id: val("n_exercise"),
      course: { id: val("n_course"), title: val("n_courseTitle"), module: val("n_module"), appTitle: val("n_appTitle"), order: num(val("n_order")) },
      lesson: { id: val("n_lesson"), title: val("n_lessonTitle") },
      number: val("n_number"), title: val("n_title"), intro: val("n_intro"), status: val("n_status"),
      thumbnail: thumbFile ? (forCheck ? "img/upload.png" : "") : val("n_tsrc"),
      media: [m],
      timestampMode: k === "jumpforce" && $("n_ts").checked,
      legend: getRows("legend"),
      glossary: getRows("glossary"),
      guidance: { title: val("n_gtitle"), steps: $("n_gsteps").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean) },
      task: val("n_task"),
      scaffold: getRows("scaffold"),
      feedbackCategories: getRows("categories"),
      targetConcepts: val("n_concepts").split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(Boolean),
      mediaDescription: $("n_mdesc").value.trim(),
      feedbackPrompt: $("n_prompt").value.trim(),
      modelSolution: $("n_solution").value.trim(),
      demo: { studentText: $("n_demo").value.trim(), feedback: { markers: getRows("markers") } }
    };
  }

  /* ---------- Befüllen: Übung (Dateiformat) → Formular ---------- */
  function hydrate(ex, partial) {
    var has = function (k) { return ex[k] !== undefined && ex[k] !== null; };
    if (ex.course) {
      setVal("n_course", ex.course.id); setVal("n_courseTitle", ex.course.title); setVal("n_module", ex.course.module);
      setVal("n_appTitle", ex.course.appTitle); if (ex.course.order) setVal("n_order", ex.course.order);
      onCourse();
    }
    if (ex.lesson) { setVal("n_lesson", ex.lesson.id); setVal("n_lessonTitle", ex.lesson.title); }
    setVal("n_exercise", ex.id); setVal("n_number", ex.number); setVal("n_title", ex.title);
    setVal("n_intro", ex.intro); setVal("n_status", ex.status); setVal("n_task", ex.task);
    if (ex.thumbnail && /^img\//.test(ex.thumbnail)) setVal("n_tsrc", ex.thumbnail);

    var m = Array.isArray(ex.media) ? ex.media[0] : null;
    if (m) {
      var k = m.type === "interactive" ? "jumpforce" : m.type;
      setKind(k);
      setVal("n_mlabel", m.label); setVal("n_malt", m.alt); setVal("n_mcaption", m.caption);
      var cfg = m.config || {};
      if (k === "video") { setVal("n_vsrc", m.src); setVal("n_fps", cfg.fps); setVal("n_dur", cfg.durationSec); }
      if (k === "youtube") {
        setVal("n_yurl", m.videoId ? "https://www.youtube.com/watch?v=" + m.videoId : (m.url || ""));
        setVal("n_ystart", cfg.start != null ? fmtTime(cfg.start) : ""); setVal("n_yend", cfg.end != null ? fmtTime(cfg.end) : "");
        if (cfg.fps) setVal("n_yfps", cfg.fps);
        ytInfo();
      }
      if (k === "image") {
        setVal("n_isrc", m.src);
        var ro = m.methods && m.methods.readout;
        $("n_ro").checked = !!ro;
        if (ro) {
          var x = ro.x || {}, g = ro.guide || {};
          setVal("n_ro_label", x.label); setVal("n_ro_unit", x.unit); setVal("n_ro_dec", x.decimals);
          setVal("n_ro_min", x.min); setVal("n_ro_max", x.max); setVal("n_ro_step", x.step);
          setVal("n_ro_from", x.from); setVal("n_ro_to", x.to); setVal("n_ro_top", g.top); setVal("n_ro_bottom", g.bottom);
        }
        syncRo(); setPreview();
      }
      if (k === "model3d") {
        setVal("n_gsrc", m.src);
        var hid = cfg.initialHidden || [];
        form.querySelectorAll('input[name="hide"]').forEach(function (c) { c.checked = hid.indexOf(c.value) >= 0; });
      }
      if (k === "frame" && m.src) frameSel.value = m.src;
      if (k === "video" || k === "youtube" || k === "jumpforce") setRows("phases", cfg.phases || []);
    }
    if (has("timestampMode")) $("n_ts").checked = !!ex.timestampMode;
    if (has("legend") || !partial) setRows("legend", ex.legend);
    if (has("glossary") || !partial) setRows("glossary", ex.glossary);
    if (ex.guidance) { setVal("n_gtitle", ex.guidance.title); $("n_gsteps").value = (ex.guidance.steps || []).join("\n"); }
    if (has("scaffold") || !partial) setRows("scaffold", ex.scaffold);
    var cats = ex.feedbackCategories || ex.categories;
    if (cats || !partial) setRows("categories", cats);
    if (has("targetConcepts")) setVal("n_concepts", (ex.targetConcepts || []).join(", "));
    setVal("n_mdesc", ex.mediaDescription); setVal("n_prompt", ex.feedbackPrompt); setVal("n_solution", ex.modelSolution);
    if (ex.demo) {
      setVal("n_demo", ex.demo.studentText);
      setRows("markers", (ex.demo.feedback && ex.demo.feedback.markers) || []);
    }
    refreshCatKeys(); changed();
  }

  /* ---------- Hinweise zur Qualität (blockieren nicht) ---------- */
  function hints(ex) {
    var h = [];
    var cats = ex.feedbackCategories;
    if (cats.length && (cats.length < 2 || cats.length > 5)) h.push("Feedback-Kategorien: 3 bis 4 sind üblich, hier sind es " + cats.length + ".");
    if (!ex.modelSolution) h.push("Ohne Musterlösung bleibt Schritt 5 leer und das Modell hat keine Referenz.");
    if (!ex.mediaDescription && ex.media[0].type !== "interactive") h.push("Ohne Medienbeschreibung weiß das Modell nicht, was im Medium zu sehen ist.");
    if (!ex.scaffold.length) h.push("Kein Schreibgerüst: Schritt 4 der Übungsseite bleibt leer.");
    if (!ex.glossary.length) h.push("Kein Glossar: das Fachvokabular fehlt auf der Seite.");
    if (!ex.targetConcepts.length) h.push("Keine Zielkonzepte angegeben.");
    var text = ex.demo.studentText;
    ex.demo.feedback.markers.forEach(function (mk, i) {
      if (mk.quote && text.indexOf(mk.quote) < 0) h.push("Demo-Marker " + (i + 1) + ": das Zitat steht nicht wörtlich im Demo-Text und wird verworfen.");
    });
    return h;
  }

  /* ---------- Server: prüfen, anlegen ---------- */
  var resultBox = $("nu_result"), jsonBox = $("nu_json");
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function showResult(kindCls, title, errors, warnings, extra) {
    resultBox.hidden = false;
    resultBox.className = "nu-result " + kindCls;
    var html = "<b>" + esc(title) + "</b>";
    if (errors && errors.length) html += '<ul class="nu-err">' + errors.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul>";
    if (warnings && warnings.length) html += '<p class="nu-sub-h">Hinweise</p><ul class="nu-warn">' + warnings.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul>";
    if (extra) html += extra;
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function post(fd) {
    fd.append("csrf", NU.csrf);
    return fetch("create.php", { method: "POST", body: fd, credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return { errors: ["Unerwartete Antwort des Servers (HTTP " + r.status + ")."] }; }).then(function (j) {
        if (j && j.error && !j.errors) j.errors = [j.error];  // csrf_require() antwortet mit "error"
        return { ok: r.ok, j: j };
      }); });
  }
  function dryRun() {
    var fd = new FormData();
    fd.append("exercise_json", JSON.stringify(collect(true)));
    fd.append("dry_run", "1");
    return post(fd);
  }

  $("nu_check").addEventListener("click", function () {
    var btn = this; btn.disabled = true;
    dryRun().then(function (r) {
      var w = hints(collect(true));
      if (r.ok) showResult("ok", "Alle Pflichtangaben sind da." + (w.length ? "" : " Keine Hinweise."), [], w);
      else showResult("bad", "Noch nicht vollständig", r.j.errors || [], w);
    }).catch(function (e) { showResult("bad", "Prüfung fehlgeschlagen", [e.message]); })
      .finally(function () { btn.disabled = false; });
  });

  $("nu_showJson").addEventListener("click", function () {
    var btn = this; btn.disabled = true;
    dryRun().then(function (r) {
      jsonBox.hidden = false;
      jsonBox.textContent = JSON.stringify(r.j.exercise || collect(true), null, 2);
      if (!r.ok) showResult("bad", "So würde die Übung gespeichert, es fehlt aber noch etwas", r.j.errors || []);
    }).finally(function () { btn.disabled = false; });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = $("nu_submit"); btn.disabled = true; btn.textContent = "Wird angelegt …";
    var fd = new FormData();
    fd.append("exercise_json", JSON.stringify(collect(false)));
    var k = kind(), fileId = { video: "n_vfile", image: "n_ifile", model3d: "n_gfile" }[k];
    if (fileId && $(fileId).files[0]) fd.append("media_file", $(fileId).files[0]);
    if ($("n_tfile").files[0]) fd.append("thumb_file", $("n_tfile").files[0]);
    post(fd).then(function (r) {
      if (r.ok && r.j.ok) {
        dirty = false;
        showResult("ok", "Übung angelegt: " + r.j.id, [], hints(collect(false)),
          '<div class="nu-row" style="margin-top:10px"><a class="ctrl primary" href="' + esc(r.j.view) + '">Übung ansehen</a><a class="ctrl" href="' + esc(r.j.edit) + '">Texte weiter bearbeiten</a><a class="ctrl" href="pflege.php">Zur Übersicht</a></div>');
        btn.textContent = "Angelegt";
      } else {
        showResult("bad", "Nicht angelegt", r.j.errors || ["Unbekannter Fehler."], hints(collect(true)));
        btn.disabled = false; btn.textContent = "Übung anlegen";
      }
    }).catch(function (err) {
      showResult("bad", "Nicht angelegt", [err.message]);
      btn.disabled = false; btn.textContent = "Übung anlegen";
    });
  });

  /* ---------- KI: Anleitung kopieren, Ergebnis übernehmen ---------- */
  $("nu_guideCopy").addEventListener("click", function () {
    var t = $("nu_guide"), st = $("nu_guideStatus");
    var ok = function () { st.textContent = "Kopiert. Jetzt in den KI-Chat einfügen."; st.className = "field-hint save-ok"; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(ok, function () { t.closest("details").open = true; t.select(); st.textContent = "Bitte mit Strg/⌘+C kopieren."; });
    else { t.closest("details").open = true; t.select(); try { document.execCommand("copy"); ok(); } catch (e) { st.textContent = "Bitte mit Strg/⌘+C kopieren."; } }
  });

  function extractJson(raw) {
    var s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    var a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a < 0 || b <= a) throw new Error("Kein JSON-Objekt gefunden.");
    return JSON.parse(s.slice(a, b + 1));
  }
  $("nu_importGo").addEventListener("click", function () {
    var st = $("nu_importStatus");
    try {
      var ex = extractJson($("nu_import").value);
      if (ex.exercise && typeof ex.exercise === "object") ex = ex.exercise;
      hydrate(ex, false);
      st.textContent = "Übernommen. Bitte durchsehen, Dateien wählen und „Prüfen“ klicken."; st.className = "field-hint save-ok";
      $("n_course").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      st.textContent = "Konnte nicht gelesen werden: " + e.message + " Am besten die KI bitten, nur das JSON in einem Codeblock auszugeben.";
      st.className = "field-hint save-err";
    }
  });

  /* ---------- Gerüst für den Feedback-Prompt ---------- */
  $("nu_promptTpl").addEventListener("click", function () {
    var t = $("n_prompt");
    if (t.value.trim() && !window.confirm("Den vorhandenen Prompt durch das Gerüst ersetzen?")) return;
    var cats = getRows("categories");
    var catLines = cats.length ? cats.map(function (c) { return "- " + c.key + ": " + c.label + " (wann diese Kategorie passt: …)"; }).join("\n") : "- schluessel: Bezeichnung (wann diese Kategorie passt: …)";
    t.value = [
      "ROLLE",
      "Du bist Tutor:in in [Fach/Lehrveranstaltung]. Du begleitest [Zielgruppe], die lernen, [Lernziel in einem Satz]. Du unterrichtest SOKRATISCH: Du stellst Fragen, die zum nächsten Denkschritt führen. Die Antwort lieferst du nie selbst.",
      "",
      "AUFGABE",
      "Du bekommst eine Beschreibung des Mediums, eine interne Musterlösung und den Text einer/eines Studierenden. Du kommentierst AUSSCHLIESSLICH den Studierenden-Text und gibst 2 bis 4 Marker zurück.",
      "",
      "WAS EIN GUTER MARKER IST",
      "- Eine Beobachtung ohne Zahl, Einheit oder Zeitangabe.",
      "- Ein Alltagswort an einer Stelle, an der es einen Fachbegriff gibt.",
      "- Eine Behauptung ohne Begründung.",
      "- [typischer fachlicher Fehler 1 dieser Übung]",
      "- [typischer fachlicher Fehler 2 dieser Übung]",
      "",
      "KATEGORIEN",
      catLines,
      "",
      "HARTE REGELN",
      "1. quote MUSS ein wörtliches, zusammenhängendes Stück aus dem Studierenden-Text sein, Zeichen für Zeichen. Ist nichts wörtlich zitierbar, gib weniger Marker zurück.",
      "2. Nenne niemals die Lösung. Verboten sind insbesondere: [Fachbegriffe, Formeln oder Ursachen, die Studierende selbst finden sollen].",
      "3. question ist EINE Frage, höchstens zwei Sätze, per Du.",
      "4. nudge sagt, wohin zu schauen ist (Stelle im Medium, Zeitfenster, Vergleich), ohne das Ergebnis vorwegzunehmen.",
      "5. Ordne jeden Marker genau einer Kategorie zu.",
      "6. Lieber zwei scharfe Marker als vier beliebige. Ist der Text präzise, gib einen oder keinen Marker zurück.",
      "7. Antworte auf Deutsch, sachlich und freundlich, ohne Lob-Floskeln.",
      "",
      "BEISPIEL (nur als Muster für Ton und Zuschnitt)",
      "Studierenden-Satz: \"[schwacher Satz]\"",
      "Guter Marker: question \"[Rückfrage]\", nudge \"[wohin schauen]\""
    ].join("\n");
    changed();
  });

  /* ---------- Schnellentwurf aus Bild (vorhandener Endpunkt) ---------- */
  var dzGo = $("dz_go");
  if (dzGo) dzGo.addEventListener("click", function () {
    var st = $("dz_status"), img = $("dz_image");
    if (!img.files || !img.files[0]) { st.textContent = "Bitte erst ein Bild wählen."; st.className = "field-hint save-err"; return; }
    var fd = new FormData(); fd.append("image", img.files[0]); fd.append("hint", $("dz_hint").value || ""); fd.append("csrf", NU.csrf);
    dzGo.disabled = true; st.textContent = "KI entwirft … (bis zu einer Minute)"; st.className = "field-hint";
    fetch("generate-draft.php", { method: "POST", body: fd })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error((r.j && r.j.error) || "Fehler");
        hydrate(r.j.draft || {}, true);
        st.textContent = "Entwurf eingefügt. Bitte prüfen."; st.className = "field-hint save-ok";
      })
      .catch(function (e) { st.textContent = e.message; st.className = "field-hint save-err"; })
      .finally(function () { dzGo.disabled = false; });
  });

  /* ---------- Start ---------- */
  function changed() { dirty = true; refreshCatKeys(); }
  form.addEventListener("input", function (e) { dirty = true; if (e.target.closest('[data-rows="categories"]')) refreshCatKeys(); });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  // Sinnvolle Startwerte: drei Gerüst-Schritte und drei Kategorien zum Überschreiben.
  setRows("scaffold", [{ step: "Sehen", text: "" }, { step: "Benennen", text: "" }, { step: "Deuten", text: "" }]);
  setRows("categories", [{ key: "beobachtung", label: "Beobachtung (Zahl, Einheit, Zeit)" }, { key: "fachsprache", label: "Fachsprache" }, { key: "zusammenhang", label: "Zusammenhang / Deutung" }]);
  showPanels(); syncRo(); setPreview(); refreshCatKeys();
  dirty = false;
})();
