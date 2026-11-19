/* =========================================================
   Biomechanik-Lab · Client (PHP-Variante)
   Unterstützt zwei Medien-Arten über eine Transport-Abstraktion:
   - "jumpforce": schematische Sprung-Animation + Kraftkurven (SVG)
   - "image": statisches Diagramm/Messschrieb, kein Transport
   - "video":     echtes Video mit Frame-Steuerung
   Gemeinsam: Editor + sokratisches KI-Feedback + (für Video) Zeitstempel.
   Datengetrieben über window.EXERCISE (ohne feedbackPrompt).
========================================================= */
(function () {
  "use strict";
  var EX = window.EXERCISE || {};
  var MEDIA = EX.media || { kind: "jumpforce" };
  var D = (MEDIA.durationSec || EX.durationSec || 3.0);
  var FPS = (MEDIA.fps || EX.fps || 30);
  var COL = { cmj: "#3a63d8", sj: "#d98018" };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ---------- Zeitformat ---------- */
  function fmt(x) {
    if (!isFinite(x)) x = 0;
    var m = String(Math.floor(x / 60)).padStart(2, "0"), s = String(Math.floor(x % 60)).padStart(2, "0"), ms = String(Math.floor((x % 1) * 1000)).padStart(3, "0");
    return m + ":" + s + "." + ms;
  }
  function fmtShort(x) {
    if (!isFinite(x)) x = 0;
    var s = Math.floor(x % 60), ms = Math.floor((x % 1) * 100);
    return Math.floor(x / 60) + ":" + String(s).padStart(2, "0") + "." + String(ms).padStart(2, "0");
  }

  /* =========================================================
     TRANSPORT (gemeinsame Steuer-Schnittstelle)
  ========================================================= */
  var scrub = document.getElementById("scrub");
  var timeEl = document.getElementById("time");
  var playLabel = document.getElementById("playLabel");
  var playIcon = document.getElementById("playIcon");

  function updateUI(transport) {
    var t = transport.getTime(), dur = transport.getDuration();
    if (timeEl) timeEl.textContent = fmt(t) + " / " + fmt(dur);
    if (scrub) scrub.style.setProperty("--pct", (dur ? (t / dur) * 100 : 0) + "%");
    if (playLabel) playLabel.textContent = transport.isPlaying() ? "Pause" : "Abspielen";
    if (playIcon) playIcon.setAttribute("d", transport.isPlaying() ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z");
  }

  /* ---------- Video-Transport ---------- */
  function makeVideoTransport() {
    var vid = document.getElementById("vid");
    var self = {
      getTime: function () { return vid.currentTime || 0; },
      getDuration: function () { return (vid.duration && isFinite(vid.duration)) ? vid.duration : D; },
      getFps: function () { return FPS; },
      isPlaying: function () { return !vid.paused; },
      play: function () { vid.play(); },
      pause: function () { vid.pause(); },
      toggle: function () { vid.paused ? vid.play() : vid.pause(); },
      setTime: function (t) { vid.currentTime = clamp(t, 0, self.getDuration()); },
      step: function (dir) { vid.pause(); self.setTime(self.getTime() + dir / FPS); },
      nudge: function (sec) { vid.pause(); self.setTime(self.getTime() + sec); },
      setRate: function (r) { vid.playbackRate = r; },
    };
    ["timeupdate", "play", "pause", "seeked", "loadedmetadata"].forEach(function (ev) {
      vid.addEventListener(ev, function () { updateUI(self); });
    });
    return self;
  }

  /* ---------- YouTube-Transport (nur ein festgelegter Ausschnitt) ----------
     Zeiten nach aussen sind relativ zum Ausschnitt: 0 = Start des Ausschnitts.
     Die YouTube-Bedienleiste ist aus; Zeitleiste, Sprungmarken und Zeitstempel
     laufen ueber die eigene Steuerung, die den Ausschnitt nicht verlassen kann.
     Datensparsam: geladen wird erst nach Klick auf "Video laden", und zwar nur
     das iframe von youtube-nocookie.com. Die Steuerung laeuft per postMessage
     direkt mit diesem iframe; die Lab-Seite selbst laedt nichts von youtube.com
     (die offizielle iframe_api kaeme von www.youtube.com, mitsamt Cookies). */
  function makeYoutubeTransport() {
    var Y = MEDIA.youtube || {}, S = +Y.start || 0, E = (Y.end == null) ? null : +Y.end;
    var ORIGIN = "https://www.youtube-nocookie.com";
    var frame = null, ready = false, rate = 1, pendingT = 0, wantPlay = false, loading = false;
    var cur = S, curAt = 0, pstate = -1, vdur = 0, hello = null;
    var wrap = document.getElementById("ytWrap"), consent = document.getElementById("ytConsent"), host = document.getElementById("ytPlayer");
    var btn = document.getElementById("ytLoad");

    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function send(func, args) {
      if (!frame || !frame.contentWindow) return;
      frame.contentWindow.postMessage(JSON.stringify({ event: "command", func: func, args: args || [], id: 1, channel: "widget" }), ORIGIN);
    }
    function absEnd() { if (E != null) return E; return vdur > S ? vdur : S; } // ohne Endzeit: Laenge erst nach dem Laden bekannt
    // Der Player meldet die Zeit nur einige Male pro Sekunde; dazwischen wird hochgerechnet.
    function abs() {
      if (!ready) return S + pendingT;
      var t = cur + (pstate === 1 ? (now() - curAt) / 1000 * rate : 0);
      return Math.min(t, absEnd());
    }
    function seekAbs(t) { cur = t; curAt = now(); send("seekTo", [t, true]); }
    var self = {
      getTime: function () { return clamp(abs() - S, 0, absEnd() - S); },
      getDuration: function () { return absEnd() - S; },
      getFps: function () { return FPS; },
      isPlaying: function () { return ready && pstate === 1; },
      play: function () {
        if (!ready) { wantPlay = true; load(); return; }
        if (abs() >= absEnd() - 0.1) seekAbs(S); // am Ende: von vorn
        send("playVideo");
      },
      pause: function () { wantPlay = false; if (ready) { cur = abs(); curAt = now(); send("pauseVideo"); pstate = 2; } updateUI(self); },
      toggle: function () { self.isPlaying() ? self.pause() : self.play(); },
      setTime: function (t) {
        t = clamp(t, 0, self.getDuration());
        if (!ready) { pendingT = t; updateUI(self); return; }
        seekAbs(S + t); updateUI(self);
      },
      step: function (dir) { self.pause(); self.setTime(self.getTime() + dir / FPS); },
      nudge: function (sec) { self.pause(); self.setTime(self.getTime() + sec); },
      setRate: function (r) { rate = r; if (ready) send("setPlaybackRate", [r]); },
    };

    // Waechter: haelt die Wiedergabe im Ausschnitt.
    function guard() {
      if (!ready) return;
      var t = abs();
      if (t < S - 0.25) seekAbs(S);
      else if (pstate === 1 && t >= absEnd() - 0.05) { send("pauseVideo"); pstate = 2; seekAbs(absEnd() - 0.05); }
      updateUI(self);
    }

    function onMessage(e) {
      if (!frame || e.source !== frame.contentWindow || e.origin !== ORIGIN) return;
      var d; try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (_) { return; }
      if (!d || !d.event) return;
      if (d.event === "onReady" && !ready) {
        ready = true; clearInterval(hello);
        if (consent) consent.hidden = true;
        send("setPlaybackRate", [rate]);
        seekAbs(S + pendingT);
        if (wantPlay) send("playVideo"); else send("pauseVideo");
        setInterval(guard, 100);
      } else if (d.event === "infoDelivery" && d.info) {
        if (typeof d.info.currentTime === "number") { cur = d.info.currentTime; curAt = now(); }
        if (typeof d.info.playerState === "number") pstate = d.info.playerState;
        if (typeof d.info.duration === "number" && d.info.duration > 0) vdur = d.info.duration;
        if (typeof d.info.playbackRate === "number") rate = d.info.playbackRate;
      } else if (d.event === "onStateChange") {
        pstate = +d.info;
        // Natuerliches Ende: zurueck an den Start statt Vorschlagsliste.
        if (pstate === 0) { seekAbs(S); send("pauseVideo"); pstate = 2; }
      } else if (d.event === "onError") {
        if (consent) { consent.hidden = false; if (btn) btn.textContent = "Video nicht verfügbar"; }
      }
      updateUI(self);
    }
    window.addEventListener("message", onMessage);

    function load() {
      if (loading || !host) return; loading = true;
      if (btn) btn.textContent = "Video wird geladen …";
      var q = { start: Math.floor(S), controls: 0, disablekb: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, enablejsapi: 1, origin: location.origin };
      if (E != null) q.end = Math.ceil(E);
      frame = document.createElement("iframe");
      frame.src = ORIGIN + "/embed/" + encodeURIComponent(Y.id) + "?" + Object.keys(q).map(function (k) { return k + "=" + encodeURIComponent(q[k]); }).join("&");
      frame.title = host.dataset.title || "Video zur Übung";
      frame.allow = "autoplay; encrypted-media; picture-in-picture";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.addEventListener("load", function () {
        // Anmelden, bis der Player "onReady" meldet (wie es die offizielle API auch tut).
        var n = 0;
        clearInterval(hello);
        hello = setInterval(function () {
          if (ready || ++n > 40) {
            clearInterval(hello);
            if (!ready) { // nach 10 s ohne Antwort: aufraeumen, erneuter Klick laedt neu
              if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
              frame = null; loading = false;
              if (consent) consent.hidden = false; if (btn) btn.textContent = "Video reagiert nicht, erneut versuchen";
            }
            return;
          }
          frame.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), ORIGIN);
        }, 250);
      });
      host.hidden = false;
      host.appendChild(frame);
    }
    if (btn) btn.addEventListener("click", function () { load(); });
    if (wrap && consent) wrap.addEventListener("click", function (e) { if (!ready && e.target === consent) load(); });
    return self;
  }

  /* ---------- JumpForce-Transport (SVG-Animation) ---------- */
  function makeJumpTransport() {
    var t = 0, playing = false, rate = 1, lastTs = null;
    var stage = document.getElementById("stage");
    var kneeSvg = document.getElementById("knee");

    /* --- Mathematik --- */
    function smooth(a, b, x) { var u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }
    function fCMJ(tt) { tt = clamp(tt, 0, D);
      if (tt < 0.55) return 1.0;
      if (tt < 1.15) { var u = (tt - 0.55) / 0.6; return 1 - 0.46 * Math.sin(Math.PI * u); }
      if (tt < 1.55) return 1 + 1.45 * smooth(1.15, 1.55, tt);
      if (tt < 1.95) return 2.45 * (1 - smooth(1.55, 1.95, tt));
      if (tt < 2.62) return 0;
      if (tt < 3.0) { var g = 3.2 * Math.exp(-Math.pow((tt - 2.7) / 0.1, 2)); return g + smooth(2.78, 3.0, tt) * (1 - Math.exp(-Math.pow((tt - 2.7) / 0.1, 2))); }
      return 1.0; }
    function fSJ(tt) { tt = clamp(tt, 0, D);
      if (tt < 1.15) return 1.0;
      if (tt < 1.55) return 1 + 1.0 * smooth(1.15, 1.55, tt);
      if (tt < 1.95) return 2.0 * (1 - smooth(1.55, 1.95, tt));
      if (tt < 2.5) return 0;
      if (tt < 3.0) { var g = 2.7 * Math.exp(-Math.pow((tt - 2.6) / 0.1, 2)); return g + smooth(2.68, 3.0, tt) * (1 - Math.exp(-Math.pow((tt - 2.6) / 0.1, 2))); }
      return 1.0; }
    function poseCMJ(tt) { tt = clamp(tt, 0, D); var drop = 0, air = 0;
      if (tt < 0.55) drop = 0; else if (tt < 1.15) drop = smooth(0.55, 1.15, tt); else if (tt < 1.55) drop = 1;
      else if (tt < 1.95) drop = 1 - smooth(1.55, 1.95, tt);
      else if (tt < 2.62) { drop = 0; air = Math.sin((Math.PI * (tt - 1.95)) / 0.67); }
      else { air = 0; drop = 0.6 * Math.sin(Math.PI * clamp((tt - 2.62) / 0.38, 0, 1)); } return { drop: drop, air: air }; }
    function poseSJ(tt) { tt = clamp(tt, 0, D); var drop = 1, air = 0;
      if (tt < 1.15) drop = 1; else if (tt < 1.95) drop = 1 - smooth(1.15, 1.95, tt);
      else if (tt < 2.5) { drop = 0; air = 0.78 * Math.sin((Math.PI * (tt - 1.95)) / 0.55); }
      else { air = 0; drop = 0.6 * Math.sin(Math.PI * clamp((tt - 2.5) / 0.5, 0, 1)); } return { drop: drop, air: air }; }

    var NS = "http://www.w3.org/2000/svg";
    function el(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
    var figArea = { x: 18, y: 30, w: 300, h: 400 }, chart = { x: 360, y: 40, w: 330, h: 330 }, Fmax = 3.4;
    function cx(tt) { return chart.x + (clamp(tt, 0, D) / D) * chart.w; }
    function cy(F) { return chart.y + chart.h - (clamp(F, 0, Fmax) / Fmax) * chart.h; }
    var cmjPts = [], sjPts = [];
    (function () { var N = 240; for (var i = 0; i <= N; i++) { var tt = (i / N) * D; cmjPts.push([cx(tt), cy(fCMJ(tt))]); sjPts.push([cx(tt), cy(fSJ(tt))]); } })();
    function pathFrom(pts, upto) { var d = ""; for (var i = 0; i < pts.length; i++) { if (upto != null && pts[i][0] > upto) break; d += (i === 0 ? "M" : "L") + pts[i][0].toFixed(1) + " " + pts[i][1].toFixed(1) + " "; } return d.trim(); }
    function setAttr(id, a, v) { var e = document.getElementById(id); if (e) e.setAttribute(a, v); }
    function dipPath(px) { var y1 = cy(1), d = "", open = false;
      for (var i = 0; i < cmjPts.length; i++) { var time = (i / (cmjPts.length - 1)) * D, F = fCMJ(time), x = cmjPts[i][0]; if (x > px) break;
        if (F < 1 && time < 1.2) { if (!open) { d += "M" + x.toFixed(1) + " " + y1.toFixed(1) + " "; open = true; } d += "L" + x.toFixed(1) + " " + cy(F).toFixed(1) + " "; }
        else if (open) { d += "L" + x.toFixed(1) + " " + y1.toFixed(1) + " Z "; open = false; } }
      if (open) d += "L" + Math.min(px, chart.x + chart.w).toFixed(1) + " " + y1.toFixed(1) + " Z"; return d; }

    function buildStatic() {
      if (!stage) return;
      stage.appendChild(el("rect", { x: chart.x - 26, y: chart.y - 26, width: chart.w + 52, height: chart.h + 64, rx: 10, fill: "#0b0e14", stroke: "#1d2531" }));
      for (var bw = 0; bw <= 3; bw++) { var y = cy(bw);
        stage.appendChild(el("line", { x1: chart.x, y1: y, x2: chart.x + chart.w, y2: y, stroke: bw === 1 ? "#5a6677" : "#222b39", "stroke-width": bw === 1 ? 1.4 : 1, "stroke-dasharray": bw === 1 ? "5 4" : "2 5" }));
        var lab = el("text", { x: chart.x - 8, y: y + 4, "text-anchor": "end", fill: "#7d8a9c", "font-size": 12, "font-family": "monospace" }); lab.textContent = bw + " BW"; stage.appendChild(lab); }
      var yt = el("text", { x: chart.x - 30, y: chart.y - 12, fill: "#9aa6b6", "font-size": 12, "font-weight": 600 }); yt.textContent = "Fz (vertikale Bodenreaktionskraft)"; stage.appendChild(yt);
      var xt = el("text", { x: chart.x + chart.w, y: chart.y + chart.h + 34, "text-anchor": "end", fill: "#7d8a9c", "font-size": 12 }); xt.textContent = "Zeit →"; stage.appendChild(xt);
      stage.appendChild(el("path", { id: "dipFill", fill: "rgba(58,99,216,0.22)", stroke: "none" }));
      stage.appendChild(el("path", { id: "sjFull", fill: "none", stroke: COL.sj, "stroke-width": 1.6, opacity: 0.28 }));
      stage.appendChild(el("path", { id: "cmjFull", fill: "none", stroke: COL.cmj, "stroke-width": 1.6, opacity: 0.28 }));
      stage.appendChild(el("path", { id: "sjLine", fill: "none", stroke: COL.sj, "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      stage.appendChild(el("path", { id: "cmjLine", fill: "none", stroke: COL.cmj, "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      stage.appendChild(el("line", { id: "playhead", y1: chart.y, y2: chart.y + chart.h, stroke: "#aeb8c6", "stroke-width": 1, "stroke-dasharray": "3 3" }));
      stage.appendChild(el("circle", { id: "dotSJ", r: 5, fill: COL.sj, stroke: "#0b0e14", "stroke-width": 1.5 }));
      stage.appendChild(el("circle", { id: "dotCMJ", r: 5, fill: COL.cmj, stroke: "#0b0e14", "stroke-width": 1.5 }));
      var lx = chart.x + chart.w - 150;
      stage.appendChild(el("rect", { x: lx, y: chart.y + 6, width: 144, height: 46, rx: 7, fill: "rgba(10,14,20,.7)", stroke: "#222b39" }));
      stage.appendChild(el("line", { x1: lx + 10, y1: chart.y + 20, x2: lx + 30, y2: chart.y + 20, stroke: COL.cmj, "stroke-width": 3 }));
      var l1 = el("text", { x: lx + 36, y: chart.y + 24, fill: "#cdd6e2", "font-size": 12 }); l1.textContent = "CMJ"; stage.appendChild(l1);
      stage.appendChild(el("line", { x1: lx + 10, y1: chart.y + 38, x2: lx + 30, y2: chart.y + 38, stroke: COL.sj, "stroke-width": 3 }));
      var l2 = el("text", { x: lx + 36, y: chart.y + 42, fill: "#cdd6e2", "font-size": 12 }); l2.textContent = "Squat Jump"; stage.appendChild(l2);
      stage.appendChild(el("g", { id: "figCMJ" })); stage.appendChild(el("g", { id: "figSJ" }));
      var gy = figArea.y + figArea.h - 20;
      stage.appendChild(el("line", { x1: figArea.x, y1: gy, x2: figArea.x + figArea.w, y2: gy, stroke: "#39455a", "stroke-width": 2 }));
      var c1 = el("text", { x: figArea.x + 78, y: gy + 30, "text-anchor": "middle", fill: COL.cmj, "font-size": 14, "font-weight": 700 }); c1.textContent = "CMJ"; stage.appendChild(c1);
      var c2 = el("text", { x: figArea.x + 220, y: gy + 30, "text-anchor": "middle", fill: COL.sj, "font-size": 14, "font-weight": 700 }); c2.textContent = "Squat Jump"; stage.appendChild(c2);
    }
    function drawFigure(gid, cxFoot, pose, color) {
      var g = document.getElementById(gid); if (!g) return; g.innerHTML = "";
      var gy = figArea.y + figArea.h - 20, airPx = pose.air * 150, footY = gy - airPx;
      var legLen = 120 - pose.drop * 58, hipY = footY - legLen, torso = 60 - pose.drop * 8, shoulderY = hipY - torso;
      var headR = 12, headY = shoulderY - headR - 6, kneeOut = pose.drop * 20, kneeY = (hipY + footY) / 2 - pose.drop * 6;
      var st = { stroke: color, "stroke-width": 4, "stroke-linecap": "round", fill: "none" };
      [-9, 9].forEach(function (dx) { var kneeX = cxFoot + dx + kneeOut * (dx < 0 ? -0.2 : 0.2);
        g.appendChild(el("line", Object.assign({ x1: cxFoot + dx * 0.6, y1: hipY, x2: kneeX + dx, y2: kneeY }, st)));
        g.appendChild(el("line", Object.assign({ x1: kneeX + dx, y1: kneeY, x2: cxFoot + dx, y2: footY }, st))); });
      g.appendChild(el("line", Object.assign({ x1: cxFoot, y1: hipY, x2: cxFoot, y2: shoulderY }, st)));
      var armUp = pose.air > 0.05 ? 1 : 0, handY = armUp ? shoulderY - 34 : shoulderY + 30 + pose.drop * 14, handX = armUp ? 16 : 22;
      [-1, 1].forEach(function (s) { g.appendChild(el("line", Object.assign({ x1: cxFoot, y1: shoulderY, x2: cxFoot + s * handX, y2: handY }, st))); });
      g.appendChild(el("circle", { cx: cxFoot, cy: headY, r: headR, stroke: color, "stroke-width": 4, fill: "#0e1118" }));
      g.appendChild(el("ellipse", { cx: cxFoot, cy: gy + 2, rx: 22 - airPx * 0.05, ry: 4, fill: "#000", opacity: clamp(0.35 - airPx * 0.0016, 0.05, 0.35) }));
    }
    function lerpCol(a, b, u) { function p(i) { return Math.round(a[i] + (b[i] - a[i]) * clamp(u, 0, 1)); } return "rgb(" + p(0) + "," + p(1) + "," + p(2) + ")"; }
    function drawKnee(tt) {
      if (!kneeSvg) return; kneeSvg.innerHTML = "";
      var pose = poseCMJ(tt), flex = pose.drop, landing = tt >= 2.55, load = landing ? clamp((fCMJ(tt) - 1) / 2.2, 0, 1) : 0;
      var hipX = 180, hipY = 48, ankleX = 180, ankleY = 272, footY = 290, kneeY = 170 + flex * 4, kneeX = hipX - load * 48;
      var col = lerpCol([26, 165, 106], [201, 53, 53], load);
      var G = function (tag, a) { kneeSvg.appendChild(el(tag, a)); };
      var lab = function (x, y, txt, c, anchor) { var e = el("text", { x: x, y: y, fill: c || "#9aa6b6", "font-size": 12 }); if (anchor) e.setAttribute("text-anchor", anchor); e.textContent = txt; kneeSvg.appendChild(e); };
      G("line", { x1: ankleX, y1: footY, x2: ankleX, y2: hipY + 6, stroke: "#2a3446", "stroke-width": 1.5, "stroke-dasharray": "4 5" });
      if (load > 0.02) { var len = 28 + load * 78, tipY = footY + 16 - len; G("line", { x1: ankleX, y1: footY + 16, x2: ankleX, y2: tipY, stroke: "#e6c34a", "stroke-width": 3, "stroke-linecap": "round" }); G("path", { d: "M" + (ankleX - 6) + " " + (tipY + 9) + " L" + ankleX + " " + tipY + " L" + (ankleX + 6) + " " + (tipY + 9) + " Z", fill: "#e6c34a" }); }
      var bone = { stroke: "#cdd6e2", "stroke-width": 11, "stroke-linecap": "round", fill: "none" };
      G("line", Object.assign({ x1: hipX, y1: hipY, x2: kneeX, y2: kneeY }, bone));
      G("line", Object.assign({ x1: kneeX, y1: kneeY, x2: ankleX, y2: ankleY }, bone));
      G("line", { x1: kneeX + 8, y1: kneeY + 12, x2: ankleX + 9, y2: ankleY - 4, stroke: "#9aa6b6", "stroke-width": 4, "stroke-linecap": "round" });
      G("line", { x1: ankleX - 20, y1: footY, x2: ankleX + 26, y2: footY, stroke: "#cdd6e2", "stroke-width": 9, "stroke-linecap": "round" });
      G("circle", { cx: kneeX - 6, cy: kneeY, r: 8, fill: "#e4e9f1" }); G("circle", { cx: kneeX + 6, cy: kneeY, r: 8, fill: "#e4e9f1" });
      var aw = 4 + load * 4;
      if (load > 0.25) G("line", { x1: kneeX - 7, y1: kneeY + 9, x2: kneeX + 7, y2: kneeY - 9, stroke: col, "stroke-width": aw + 8, "stroke-linecap": "round", opacity: 0.25 });
      G("line", { x1: kneeX - 7, y1: kneeY + 9, x2: kneeX + 7, y2: kneeY - 9, stroke: col, "stroke-width": aw, "stroke-linecap": "round" });
      G("circle", { cx: kneeX, cy: kneeY, r: 5, fill: "none", stroke: (landing && load > 0.3) ? col : "#7d8a9c", "stroke-width": 2 });
      lab(hipX + 12, hipY + 28, "Femur"); lab(ankleX + 16, ankleY - 2, "Tibia");
      G("line", { x1: kneeX - 30, y1: kneeY, x2: kneeX - 9, y2: kneeY, stroke: col, "stroke-width": 1 });
      lab(kneeX - 34, kneeY + 4, "VKB", col, "end");
      var gx = 330, gy0 = 72, gh = 150;
      G("rect", { x: gx, y: gy0, width: 14, height: gh, rx: 7, fill: "#1a2230", stroke: "#2a3446" });
      G("rect", { x: gx, y: gy0 + gh - gh * load, width: 14, height: gh * load, rx: 7, fill: col });
      lab(gx + 7, gy0 - 8, "VKB-Last", null, "middle");
      var cap = "Flug", cc = "#7d8a9c";
      if (tt < 0.55) cap = "Stand — Knie über dem Fuß"; else if (tt < 1.95) cap = "Absprung — Streckung (Triple Extension)";
      else if (tt < 2.55) cap = "Flug"; else if (load > 0.45) { cap = "Landung: dynamischer Valgus → VKB-Last hoch"; cc = "#d76b6b"; } else { cap = "Landung — abfangen"; cc = "#e6c34a"; }
      lab(180, 312, cap, cc, "middle");
    }
    function render() {
      var px = cx(t);
      setAttr("cmjFull", "d", pathFrom(cmjPts, null)); setAttr("sjFull", "d", pathFrom(sjPts, null));
      setAttr("cmjLine", "d", pathFrom(cmjPts, px)); setAttr("sjLine", "d", pathFrom(sjPts, px));
      setAttr("dipFill", "d", dipPath(px));
      setAttr("playhead", "x1", px); setAttr("playhead", "x2", px);
      setAttr("dotCMJ", "cx", px); setAttr("dotCMJ", "cy", cy(fCMJ(t)));
      setAttr("dotSJ", "cx", px); setAttr("dotSJ", "cy", cy(fSJ(t)));
      drawFigure("figCMJ", figArea.x + 78, poseCMJ(t), COL.cmj);
      drawFigure("figSJ", figArea.x + 220, poseSJ(t), COL.sj);
      drawKnee(t);
    }
    var self = {
      getTime: function () { return t; }, getDuration: function () { return D; }, getFps: function () { return FPS; },
      isPlaying: function () { return playing; },
      setTime: function (nt) { t = clamp(nt, 0, D); render(); updateUI(self); },
      step: function (dir) { self.pause(); self.setTime(t + dir / FPS); },
      nudge: function (sec) { self.pause(); self.setTime(t + sec); },
      setRate: function (r) { rate = r; },
      play: function () { if (playing) return; playing = true; lastTs = null; updateUI(self); requestAnimationFrame(loop); },
      pause: function () { playing = false; updateUI(self); },
      toggle: function () { playing ? self.pause() : self.play(); },
    };
    function loop(ts) { if (!playing) return; if (lastTs == null) lastTs = ts; var dt = (ts - lastTs) / 1000; lastTs = ts; t += dt * rate; if (t >= D) { t = D; render(); self.pause(); return; } render(); updateUI(self); requestAnimationFrame(loop); }
    buildStatic(); render();
    return self;
  }

  /* ---------- Null-Transport (3D-Modell: keine Zeitachse) ---------- */
  function makeNullTransport() {
    var self = {
      getTime: function () { return 0; }, getDuration: function () { return 0; }, getFps: function () { return FPS; },
      isPlaying: function () { return false; },
      play: function () {}, pause: function () {}, toggle: function () {},
      setTime: function () {}, step: function () {}, nudge: function () {}, setRate: function () {},
    };
    return self;
  }

  var transport = (MEDIA.kind === "video") ? makeVideoTransport()
    : (MEDIA.kind === "youtube") ? makeYoutubeTransport()
    : (MEDIA.kind === "model3d" || MEDIA.kind === "image" || MEDIA.kind === "frame") ? makeNullTransport()
    : makeJumpTransport();
  updateUI(transport);

  /* ---------- Steuerung verdrahten ---------- */
  function on(id, ev, fn) { var e = document.getElementById(id); if (e) e.addEventListener(ev, fn); }
  on("playBtn", "click", function () { transport.toggle(); });
  on("prevFrame", "click", function () { transport.step(-1); });
  on("nextFrame", "click", function () { transport.step(1); });
  Array.prototype.forEach.call(document.querySelectorAll(".speed button"), function (b) {
    b.addEventListener("click", function () { document.querySelectorAll(".speed button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); transport.setRate(parseFloat(b.dataset.rate)); });
  });
  Array.prototype.forEach.call(document.querySelectorAll("#phases button"), function (b) {
    b.addEventListener("click", function () { transport.pause(); transport.setTime(parseFloat(b.dataset.jump)); });
  });
  if (scrub) {
    var dragging = false, resume = false;
    function seekFromEvent(e) { var r = scrub.getBoundingClientRect(); var x = e.touches ? e.touches[0].clientX : e.clientX; transport.setTime(clamp((x - r.left) / r.width, 0, 1) * transport.getDuration()); }
    scrub.addEventListener("pointerdown", function (e) { dragging = true; scrub.classList.add("dragging"); scrub.setPointerCapture(e.pointerId); resume = transport.isPlaying(); transport.pause(); seekFromEvent(e); });
    scrub.addEventListener("pointermove", function (e) { if (dragging) seekFromEvent(e); });
    function endScrub(e) { if (!dragging) return; dragging = false; scrub.classList.remove("dragging"); try { scrub.releasePointerCapture(e.pointerId); } catch (_) {} if (resume) transport.play(); }
    scrub.addEventListener("pointerup", endScrub); scrub.addEventListener("pointercancel", endScrub);
  }
  document.addEventListener("keydown", function (e) {
    if (document.activeElement && document.activeElement.isContentEditable) return;
    if (e.code === "Space") { e.preventDefault(); transport.toggle(); }
    if (e.code === "ArrowLeft") transport.step(-1);
    if (e.code === "ArrowRight") transport.step(1);
    if (e.key === ",") transport.nudge(-0.25);
    if (e.key === ".") transport.nudge(0.25);
    var rates = { "1": 0.25, "2": 0.5, "3": 1, "4": 2 };
    if (rates[e.key]) { transport.setRate(rates[e.key]); document.querySelectorAll(".speed button").forEach(function (b) { b.classList.toggle("on", parseFloat(b.dataset.rate) === rates[e.key]); }); }
  });

  /* =========================================================
     FORTSCHRITT (localStorage)
  ========================================================= */
  function markProgress(field) {
    if (!EX.locator) return;
    var exId = EX.locator.course + "/" + EX.locator.lesson + "/" + EX.locator.exercise;
    var p = {};
    try { p = JSON.parse(localStorage.getItem("biomech_progress") || "{}"); } catch (e) {}
    p[exId] = p[exId] || {};
    p[exId][field] = Date.now();
    try { localStorage.setItem("biomech_progress", JSON.stringify(p)); } catch (e) {}
  }
  markProgress("opened");

  /* =========================================================
     EDITOR + KI-FEEDBACK (+ Zeitstempel für Video)
  ========================================================= */
  var demo = EX.demo || { studentText: "", feedback: { markers: [] } };
  var cats = EX.categories || [];
  var colorByCat = {}, labelByCat = {};
  cats.forEach(function (c) { colorByCat[c.key] = c.color; labelByCat[c.key] = c.label; });

  var editor = document.getElementById("editor");
  var aiBtn = document.getElementById("aiBtn"), aiBtnLabel = document.getElementById("aiBtnLabel");
  var wordCountEl = document.getElementById("wordCount"), hintBanner = document.getElementById("hintBanner");
  var editorShell = document.getElementById("editorShell"), liveLabel = document.getElementById("liveLabel");
  var tsNow = document.getElementById("tsNow");

  var phase = "writing", typeTimer = null, typed = 0, typingDone = false;
  var markers = [], submittedText = "", markersHidden = false, demoText = demo.studentText || "";
  var lastHints = []; // Marker der letzten Rueckmeldung in Chip-Reihenfolge (zum Nachlesen beim Ueberarbeiten)

  function escapeHTML(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }).replace(/\n/g, "<br>"); }
  function countWords(s) { return s.trim() ? s.trim().split(/\s+/).length : 0; }
  function setWordCount(n) { if (wordCountEl) wordCountEl.textContent = n + " Wörter"; }

  function typeOut() {
    if (phase !== "writing" || typingDone) return;
    if (typed >= demoText.length) { editor.innerHTML = escapeHTML(demoText); setWordCount(countWords(demoText)); typingDone = true; editor.setAttribute("contenteditable", "true"); if (liveLabel) liveLabel.textContent = "live · du schreibst"; syncAiBtn(); return; }
    var step = 2, partial = demoText.slice(0, typed + step);
    editor.innerHTML = escapeHTML(partial) + '<span class="caret"></span>'; setWordCount(countWords(partial));
    var last = demoText[Math.min(typed + step - 1, demoText.length - 1)], delay = 10 + Math.random() * 16;
    if (".,".indexOf(last) >= 0) delay = 90 + Math.random() * 70; if (last === "\n") delay = 140; if (demoText.slice(typed, typed + 5) === "aber ") delay = 260;
    typed += step; typeTimer = setTimeout(typeOut, delay);
  }
  /* Der Editor gehoert IMMER der/dem Studierenden: er ist von Anfang an beschreibbar,
     und jede Eingabe bricht die laufende Demo-Animation ab, statt sie zu ueberschreiben. */
  var MIN_CHARS = 10; // muss zum Serverlimit in feedback.php passen

  function currentText() { return (editor ? editor.innerText : "").trim(); }
  function syncAiBtn() {
    if (!aiBtn || cooldownTimer) return;
    aiBtn.disabled = (phase !== "writing") || currentText().length < MIN_CHARS;
  }

  /** Animation anhalten und das bisher Getippte als normal editierbaren Text uebernehmen. */
  function stopTyping(keepPartial) {
    clearTimeout(typeTimer); typeTimer = null;
    if (!typingDone) {
      var txt = keepPartial ? demoText.slice(0, Math.min(typed, demoText.length)) : demoText;
      editor.innerHTML = escapeHTML(txt);
      typed = txt.length; typingDone = true;
      setWordCount(countWords(txt));
    }
    editor.setAttribute("contenteditable", "true");
    if (liveLabel) liveLabel.textContent = "live · du schreibst";
    syncAiBtn();
  }
  function startTyping() {
    clearTimeout(typeTimer); phase = "writing"; typed = 0; typingDone = false; markers = []; submittedText = "";
    // Beschreibbar bleibt es trotzdem - wer hineinklickt, uebernimmt sofort.
    editor.setAttribute("contenteditable", "true"); editor.innerHTML = "";
    if (aiBtn) aiBtn.disabled = true; if (hintBanner) hintBanner.className = "hint-banner";
    if (liveLabel) liveLabel.textContent = "live · Beispieltext wird getippt"; hideTip(true); typeOut();
  }
  function skipTyping() { stopTyping(false); }
  /** Aus der Marker-Ansicht zurueck ins Schreiben - der abgegebene Text bleibt erhalten. */
  function resumeEditing() {
    if (phase === "writing") return;
    var keep = submittedText || (editor ? editor.innerText : "");
    var hadFeedback = phase === "feedback" && lastHints.length > 0;
    phase = "writing"; typingDone = true; markers = [];
    if (editorShell) editorShell.classList.remove("markers-hidden");
    hideTip(true);
    editor.setAttribute("contenteditable", "true");
    editor.innerHTML = escapeHTML(keep);
    setWordCount(countWords(keep));
    if (liveLabel) liveLabel.textContent = "live · du schreibst";
    if (hadFeedback) showRevisionHints(); else if (hintBanner) hintBanner.className = "hint-banner";
    syncAiBtn();
  }

  /** Waehrend des Ueberarbeitens bleiben die Fragen der KI nachlesbar,
      aber zugeklappt: Studierende entscheiden selbst, ob sie sie oeffnen. */
  function showRevisionHints() {
    if (!hintBanner) return;
    var items = lastHints.map(function (h) {
      var color = colorByCat[h.category] || "var(--ink-mute)";
      return '<li><span class="rev-cat" style="color:' + color + '">' + escapeHTML(labelByCat[h.category] || h.category) + "</span> " +
        '<span class="rev-quote">„' + escapeHTML(h.quote) + '“</span><br>' + escapeHTML(h.question) +
        (h.nudge ? '<div class="rev-nudge">' + escapeHTML(h.nudge) + "</div>" : "") + "</li>";
    }).join("");
    hintBanner.style.background = ""; hintBanner.style.borderColor = "";
    hintBanner.className = "hint-banner show";
    hintBanner.innerHTML = '<div class="row"><span class="icon">✎</span><span>Du überarbeitest deinen Text. Wenn du fertig bist, hol dir mit <b>KI Feedback</b> eine neue Rückmeldung.</span></div>' +
      '<details class="rev-hints"><summary>Hinweise der letzten Rückmeldung (' + lastHints.length + ")</summary><ol>" + items + "</ol></details>";
  }

  /** Textfeld leeren, damit man ohne Umweg eigene Saetze schreiben kann. */
  function clearEditor() {
    clearTimeout(typeTimer); typeTimer = null;
    phase = "writing"; typingDone = true; typed = 0; markers = []; submittedText = "";
    if (editorShell) editorShell.classList.remove("markers-hidden");
    editor.setAttribute("contenteditable", "true"); editor.innerHTML = "";
    setWordCount(0);
    if (hintBanner) hintBanner.className = "hint-banner";
    if (liveLabel) liveLabel.textContent = "live · du schreibst";
    hideTip(true); syncAiBtn(); editor.focus();
  }
  on("skipType", "click", skipTyping);
  on("replayType", "click", startTyping);
  on("resetBtn", "click", startTyping);
  on("clearBtn", "click", clearEditor);

  if (editor) {
    editor.setAttribute("contenteditable", "true");
    // Erste eigene Regung gewinnt gegen die Animation.
    ["pointerdown", "keydown", "paste", "drop"].forEach(function (evt) {
      editor.addEventListener(evt, function () { if (!typingDone) stopTyping(true); }, true);
    });
    editor.addEventListener("input", function () {
      if (phase === "writing") { setWordCount(countWords(editor.innerText)); syncAiBtn(); }
      // Nicht angemeldet und es wird getippt: den Hinweis oben einmal hervorheben,
      // solange der Text noch kurz genug ist, um ihn ohne Aerger neu zu schreiben.
      if (EX.loggedIn === false) nudgeLoginFirst();
    });
  }

  function placeCaretAtEnd() {
    if (!editor) return;
    editor.focus();
    var sel = window.getSelection(); if (!sel) return;
    var range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
    sel.removeAllRanges(); sel.addRange(range);
  }

  /* ---- Zeitstempel einfügen (nur Video) ---- */
  function insertAtCursor(text) {
    editor.focus();
    var sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      var range = sel.getRangeAt(0); range.deleteContents();
      var node = document.createTextNode(text); range.insertNode(node);
      range.setStartAfter(node); range.setEndAfter(node); sel.removeAllRanges(); sel.addRange(range);
    } else {
      editor.appendChild(document.createTextNode(text));
    }
    if (phase === "writing") setWordCount(countWords(editor.innerText));
  }
  on("tsInsert", "click", function () {
    if (!typingDone) skipTyping();
    insertAtCursor(" [" + fmtShort(transport.getTime()) + "] ");
  });
  // Laufende Zeit im Zeitstempel-Balken anzeigen
  if (tsNow) {
    var oldUpdate = updateUI;
    setInterval(function () { tsNow.textContent = fmtShort(transport.getTime()); }, 120);
  }

  /* ---- Feedback ---- */
  var cooldownTimer = null;
  function loginHref() { return "konto.php?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search); }

  /* Den serverseitig gerenderten Anmelde-Hinweis einmalig hervorheben. */
  var loginFirstNudged = false;
  function nudgeLoginFirst() {
    if (loginFirstNudged) return;
    var el = document.getElementById("loginFirst");
    if (!el) return;
    loginFirstNudged = true;
    el.classList.add("urgent");
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function startCooldown(secs) {
    secs = Math.max(1, parseInt(secs, 10) || 60);
    if (cooldownTimer) clearInterval(cooldownTimer);
    if (aiBtn) aiBtn.disabled = true;
    function tick() {
      if (secs <= 0) { clearInterval(cooldownTimer); cooldownTimer = null; if (aiBtnLabel) aiBtnLabel.textContent = "KI Feedback"; syncAiBtn(); return; }
      var m = Math.floor(secs / 60), s = secs % 60;
      if (aiBtnLabel) aiBtnLabel.textContent = "Abkühlen … " + (m > 0 ? m + ":" + String(s).padStart(2, "0") : s + " s");
      secs--;
    }
    tick(); cooldownTimer = setInterval(tick, 1000);
  }

  function requestFeedback() {
    if (EX.loggedIn === false) { showLoginNeeded(); return; }
    if (cooldownTimer) return; // läuft noch ein Abkühl-Timer
    var text = (editor.innerText || "").trim();
    if (text.length < 10) { showError("Bitte schreibe zuerst ein paar Sätze."); return; }
    if (text.length > 6000) { showError("Dein Text ist zu lang (max. 6000 Zeichen)."); return; }
    if (aiBtn) aiBtn.disabled = true; if (aiBtnLabel) aiBtnLabel.textContent = "KI denkt nach …"; if (liveLabel) liveLabel.textContent = "KI denkt nach …";
    fetch("feedback.php", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": EX.csrf || "" }, body: JSON.stringify(Object.assign({}, EX.locator, { studentText: text })) })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, status: res.status, j: j }; }); })
      .then(function (r) {
        if (r.status === 401) { showLoginNeeded(); return; }
        if (r.status === 429) { var ra = (r.j && r.j.retry_after) || 60; startCooldown(ra);
          showBanner('⏳ Bitte kurz abkühlen — du kannst in <b>' + ra + ' Sekunden</b> wieder Feedback abrufen. (Schutz vor Überlastung)'); return; }
        if (!r.ok) throw new Error((r.j && r.j.error) || "Serverfehler");
        submittedText = text; markers = (r.j && r.j.markers) || []; phase = "feedback"; renderFeedback(); markProgress("feedback"); showSaveState(!!(r.j && r.j.saved));
        startCooldown(60); // nach erfolgreichem Feedback gilt dasselbe 1-Minuten-Limit
        if (hintBanner) hintBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
      })
      .catch(function (e) { showError(e.message || "Feedback fehlgeschlagen."); })
      .finally(function () { if (!cooldownTimer && aiBtnLabel) aiBtnLabel.textContent = "KI Feedback"; if (liveLabel && phase !== "feedback") liveLabel.textContent = "live · du schreibst"; });
  }
  on("aiBtn", "click", requestFeedback);

  function showBanner(html) {
    if (!hintBanner) return;
    hintBanner.className = "hint-banner show";
    hintBanner.innerHTML = '<div class="row"><span class="icon">ℹ️</span><span>' + html + "</span></div>";
  }
  function showLoginNeeded() {
    showBanner('Um KI-Feedback zu bekommen, starte bitte kurz (nur dein Name): <a href="' + loginHref() + '">Loslegen</a>. Das schützt die Plattform vor Missbrauch und speichert deine Abgaben.');
  }

  /* Speicher-Status nach dem Feedback anzeigen (Phase 4). */
  function showSaveState(saved) {
    if (!hintBanner) return;
    var note = document.createElement("div");
    note.className = "save-state";
    if (saved) {
      note.innerHTML = '✓ Abgabe gespeichert. <a href="meine-abgaben.php">Meine Abgaben ansehen</a>';
    } else if (EX.loggedIn === false) {
      var here = location.pathname.split("/").pop() + location.search;
      note.innerHTML = 'ℹ️ Noch nicht gestartet — diese Abgabe wird <b>nicht gespeichert</b>. <a href="konto.php?next=' + encodeURIComponent(here) + '">Name eingeben &amp; speichern</a> (dauert 5 Sekunden).';
    } else { return; }
    hintBanner.appendChild(note);
  }

  /* ---- Tooltip + Marker-Rendering ---- */
  var floatTip = document.createElement("div");
  floatTip.className = "float-tip"; floatTip.setAttribute("role", "tooltip");
  floatTip.innerHTML = '<div class="inner"></div><div class="arrow"></div>';
  document.body.appendChild(floatTip);
  var tipInner = floatTip.querySelector(".inner"), tipArrow = floatTip.querySelector(".arrow");
  var activeChip = null, tipPinned = false;
  function showTipFor(chip) {
    activeChip = chip; var idx = +chip.dataset.idx, m = markers[idx], color = colorByCat[m.category] || "var(--ink-mute)";
    var num = chip.querySelector(".num") ? chip.querySelector(".num").textContent : "";
    tipInner.innerHTML = '<div class="label" style="color:' + color + '"><span class="sw" style="background:' + color + '"></span>Hinweis ' + num + " · " + escapeHTML(labelByCat[m.category] || m.category) + "</div><div class=\"body\">" + escapeHTML(m.question) + "</div>" + (m.nudge ? '<div class="nudge"><b>💡 </b>' + escapeHTML(m.nudge) + "</div>" : "");
    floatTip.classList.add("show"); positionTip(chip);
  }
  function positionTip(chip) {
    var r = chip.getBoundingClientRect(), tipW = floatTip.offsetWidth, tipH = floatTip.offsetHeight, m = 10, vw = innerWidth, vh = innerHeight;
    var placement = "below", top = r.bottom + m; if (top + tipH > vh - 8 && r.top - tipH - m > 8) { placement = "above"; top = r.top - tipH - m; }
    var left = Math.max(8, Math.min(r.left + r.width / 2 - tipW / 2, vw - tipW - 8));
    floatTip.style.left = left + "px"; floatTip.style.top = top + "px"; floatTip.dataset.placement = placement;
    tipArrow.style.left = Math.max(14, Math.min(r.left + r.width / 2 - left, tipW - 14)) + "px";
  }
  function hideTip(force) { if (tipPinned && !force) return; floatTip.classList.remove("show"); activeChip = null; }
  function clearOpened() { editor.querySelectorAll(".mark.opened").forEach(function (o) { o.classList.remove("opened"); }); editor.querySelectorAll(".note-chip.opened").forEach(function (o) { o.classList.remove("opened"); }); }

  function renderFeedback() {
    var ranges = [];
    markers.forEach(function (mk, idx) { var s = submittedText.indexOf(mk.quote); if (s >= 0) ranges.push({ start: s, end: s + mk.quote.length, idx: idx }); });
    ranges.sort(function (a, b) { return a.start - b.start; });
    lastHints = ranges.map(function (r) { return markers[r.idx]; });
    var html = "", cursor = 0, n = 0;
    ranges.forEach(function (r) {
      if (r.start > cursor) html += escapeHTML(submittedText.slice(cursor, r.start)); n++;
      var color = colorByCat[markers[r.idx].category] || "var(--ink-mute)";
      html += '<span class="mark" data-idx="' + r.idx + '" style="--mark-c:' + color + '">' + escapeHTML(submittedText.slice(r.start, r.end)) + "</span>";
      html += '<button type="button" class="note-chip" data-idx="' + r.idx + '" style="--mark-c:' + color + '" aria-label="Hinweis ' + n + ' öffnen"><span class="num">' + n + "</span></button>";
      cursor = r.end;
    });
    if (cursor < submittedText.length) html += escapeHTML(submittedText.slice(cursor));
    editor.removeAttribute("contenteditable"); editor.innerHTML = html;
    if (hintBanner) {
      if (n > 0) {
        hintBanner.className = "hint-banner show";
        hintBanner.innerHTML = '<div class="row"><span class="icon">💡</span><span>Die KI hat <b>' + n + ' Stellen</b> markiert, an denen du präziser werden könntest. Öffne einen Marker nur, wenn du Feedback dazu möchtest — die Hinweise sind <b>Fragen, keine Lösungen</b>. Du schreibst.</span><button class="toggle" type="button" id="toggleMarkers">Marker ausblenden</button><button class="toggle primary" type="button" id="reviseBtn">Text überarbeiten</button></div>';
        document.getElementById("toggleMarkers").addEventListener("click", function () { markersHidden = editorShell.classList.toggle("markers-hidden"); this.textContent = markersHidden ? "Marker einblenden" : "Marker ausblenden"; if (markersHidden) { tipPinned = false; clearOpened(); hideTip(true); } });
      } else {
        hintBanner.className = "hint-banner show";
        hintBanner.innerHTML = '<div class="row"><span class="icon">✅</span><span>Die KI hat hier <b>keine Stellen</b> markiert — deine Beschreibung ist schon recht präzise.</span><button class="toggle primary" type="button" id="reviseBtn">Text überarbeiten</button></div>';
      }
      var rev = document.getElementById("reviseBtn");
      if (rev) rev.addEventListener("click", function () { tipPinned = false; resumeEditing(); placeCaretAtEnd(); });
    }
    editor.querySelectorAll(".note-chip").forEach(function (chip) {
      var idx = chip.dataset.idx, mark = editor.querySelector('.mark[data-idx="' + idx + '"]');
      chip.addEventListener("mouseenter", function () { if (mark) mark.classList.add("hovered"); if (!tipPinned) showTipFor(chip); });
      chip.addEventListener("mouseleave", function () { if (mark) mark.classList.remove("hovered"); if (!tipPinned) hideTip(); });
      chip.addEventListener("focus", function () { if (mark) mark.classList.add("hovered"); showTipFor(chip); });
      chip.addEventListener("blur", function () { if (mark) mark.classList.remove("hovered"); if (!tipPinned) hideTip(); });
      chip.addEventListener("click", function (e) { e.stopPropagation(); if (tipPinned && activeChip === chip) { tipPinned = false; clearOpened(); hideTip(true); } else { clearOpened(); chip.classList.add("opened"); if (mark) mark.classList.add("opened"); tipPinned = true; showTipFor(chip); } });
    });
  }
  function showError(msg) {
    if (!hintBanner) return; hintBanner.className = "hint-banner show";
    hintBanner.style.background = "color-mix(in srgb, var(--bad) 8%, transparent)"; hintBanner.style.borderColor = "color-mix(in srgb, var(--bad) 30%, transparent)";
    hintBanner.innerHTML = '<div class="row"><span class="icon">⚠️</span><span><b>' + escapeHTML(msg) + '</b> Du kannst es erneut versuchen oder ersatzweise das Demo-Feedback ansehen.</span><button class="toggle" type="button" id="demoFb">Demo-Feedback</button></div>';
    document.getElementById("demoFb").addEventListener("click", function () { hintBanner.style.background = ""; hintBanner.style.borderColor = ""; submittedText = demoText; markers = (demo.feedback && demo.feedback.markers) || []; phase = "feedback"; renderFeedback(); });
  }
  document.addEventListener("click", function (e) { if (floatTip.contains(e.target)) return; if (e.target.closest && e.target.closest(".note-chip")) return; tipPinned = false; clearOpened(); hideTip(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { tipPinned = false; clearOpened(); hideTip(true); } });
  addEventListener("resize", function () { if (activeChip) positionTip(activeChip); });
  addEventListener("scroll", function () { if (activeChip) positionTip(activeChip); }, true);

  /* Experten-Beschreibung: liegt nicht im Quelltext, wird einmalig nachgeladen. */
  on("revealExpert", "click", function () {
    var card = document.getElementById("expertCard"), bodyEl = document.getElementById("expertBody"), btn = this;
    if (!card || !bodyEl) return;
    if (card.classList.contains("revealed")) return;
    if (bodyEl.textContent.trim()) { card.classList.add("revealed"); return; }

    btn.disabled = true; var old = btn.textContent; btn.textContent = "wird geladen …";
    fetch("loesung.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": EX.csrf || "" },
      body: JSON.stringify(EX.locator)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (r) {
        if (r.status === 401) throw new Error("Bitte zuerst oben auf „Loslegen\u201c klicken.");
        if (!r.ok) throw new Error((r.j && r.j.error) || "Konnte nicht geladen werden.");
        bodyEl.textContent = (r.j && r.j.solution) || "Für diese Übung ist keine Musterlösung hinterlegt.";
        card.classList.add("revealed");
      })
      .catch(function (e) { btn.disabled = false; btn.textContent = old; alert(e.message); });
  });

  /* ---------------------------------------------------------
     Methoden-Fundus starten (public/media-methods.js).
     Welche Methode ein Medium bekommt, steht allein in der Übungs-JSON
     unter media[].methods — hier wird nur die Brücke zum Editor gereicht.
  --------------------------------------------------------- */
  if (window.LabMethods && MEDIA.methods) {
    window.LabMethods.boot(document.getElementById("mediaHost"), MEDIA.methods, {
      insertAtCursor: function (text) {
        if (!typingDone) stopTyping(true);
        resumeEditing();
        insertAtCursor(text);
        syncAiBtn();
      }
    });
  }

  /* ---------------------------------------------------------
     Bild-Zoom: Vollbild-Ansicht fuer detailreiche Abbildungen.
     Unabhaengig vom Ablese-Werkzeug (readout), das auf dem Bild selbst liegt.
  --------------------------------------------------------- */
  (function imageZoom() {
    var btn = document.getElementById("imgZoomBtn");
    var host = document.getElementById("mediaHost");
    var srcImg = host && host.querySelector("img");
    if (!btn || !srcImg) return;

    var box = null, stage, img, pct, s = 1, tx = 0, ty = 0, fitS = 1, maxS = 4;
    var pts = {}, last = null, pinch = null, lastFocus = null;

    function apply() {
      img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
      pct.textContent = Math.round(s / fitS * 100) + " %";
    }
    function clampPan() {
      var vw = stage.clientWidth, vh = stage.clientHeight, w = img.naturalWidth * s, h = img.naturalHeight * s;
      // Kleiner als die Buehne: zentrieren; groesser: Raender nicht ins Leere ziehen lassen.
      tx = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, tx));
      ty = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, ty));
    }
    function zoomAt(ns, cx, cy) {
      ns = Math.max(fitS, Math.min(maxS, ns));
      tx = cx - (cx - tx) * (ns / s); ty = cy - (cy - ty) * (ns / s); s = ns;
      clampPan(); apply();
    }
    function fit() {
      var vw = stage.clientWidth, vh = stage.clientHeight;
      fitS = Math.min(vw / img.naturalWidth, vh / img.naturalHeight, 1);
      maxS = Math.max(fitS * 8, 3);
      s = fitS; clampPan(); apply();
    }
    function center() { return { x: stage.clientWidth / 2, y: stage.clientHeight / 2 }; }
    function local(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    function build() {
      box = document.createElement("div");
      box.className = "img-zoom"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-label", "Bild vergrößert");
      box.innerHTML =
        '<div class="img-zoom-bar">' +
          '<button type="button" class="ctrl" data-z="out" aria-label="Verkleinern">−</button>' +
          '<span class="img-zoom-pct">100 %</span>' +
          '<button type="button" class="ctrl" data-z="in" aria-label="Vergrößern">+</button>' +
          '<button type="button" class="ctrl" data-z="fit">Ganzes Bild</button>' +
          '<span class="img-zoom-hint">Mausrad / Pinch / Doppelklick zoomt · ziehen verschiebt · Esc schließt</span>' +
          '<button type="button" class="ctrl" data-z="close">Schließen</button>' +
        '</div><div class="img-zoom-stage"><img alt=""></div>';
      document.body.appendChild(box);
      stage = box.querySelector(".img-zoom-stage"); img = stage.querySelector("img"); pct = box.querySelector(".img-zoom-pct");
      img.alt = srcImg.alt || ""; img.draggable = false;

      box.querySelector(".img-zoom-bar").addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return; var c = center();
        if (b.dataset.z === "in") zoomAt(s * 1.5, c.x, c.y);
        if (b.dataset.z === "out") zoomAt(s / 1.5, c.x, c.y);
        if (b.dataset.z === "fit") fit();
        if (b.dataset.z === "close") close();
      });
      stage.addEventListener("wheel", function (e) {
        e.preventDefault(); var p = local(e);
        zoomAt(s * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), p.x, p.y);
      }, { passive: false });
      stage.addEventListener("dblclick", function (e) {
        var p = local(e); zoomAt(s > fitS * 1.5 ? fitS : fitS * 3, p.x, p.y);
      });
      stage.addEventListener("pointerdown", function (e) {
        stage.setPointerCapture(e.pointerId); pts[e.pointerId] = local(e);
        var ids = Object.keys(pts);
        if (ids.length === 1) { last = pts[ids[0]]; pinch = null; }
        if (ids.length === 2) {
          var a = pts[ids[0]], b = pts[ids[1]];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: s };
        }
      });
      stage.addEventListener("pointermove", function (e) {
        if (!pts[e.pointerId]) return;
        pts[e.pointerId] = local(e);
        var ids = Object.keys(pts);
        if (ids.length >= 2 && pinch) {
          var a = pts[ids[0]], b = pts[ids[1]];
          zoomAt(pinch.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d), (a.x + b.x) / 2, (a.y + b.y) / 2);
        } else if (ids.length === 1 && last) {
          var p = pts[ids[0]]; tx += p.x - last.x; ty += p.y - last.y; last = p; clampPan(); apply();
        }
      });
      function up(e) {
        delete pts[e.pointerId];
        var ids = Object.keys(pts); pinch = null; last = ids.length === 1 ? pts[ids[0]] : null;
      }
      stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
      // Auf document (Capture), weil der Fokus nach einem Klick ins Bild nicht mehr im Dialog liegt.
      document.addEventListener("keydown", function (e) {
        if (box.hidden) return;
        e.stopPropagation();
        var c = center(), step = 60;
        if (e.key === "Escape") close();
        else if (e.key === "+" || e.key === "=") zoomAt(s * 1.5, c.x, c.y);
        else if (e.key === "-") zoomAt(s / 1.5, c.x, c.y);
        else if (e.key === "0") fit();
        else if (e.key.indexOf("Arrow") === 0) {
          e.preventDefault();
          if (e.key === "ArrowLeft") tx += step; if (e.key === "ArrowRight") tx -= step;
          if (e.key === "ArrowUp") ty += step; if (e.key === "ArrowDown") ty -= step;
          clampPan(); apply();
        }
      }, true);
      addEventListener("resize", function () { if (box && !box.hidden) fit(); });
    }
    function open() {
      if (!box) build();
      lastFocus = document.activeElement;
      box.hidden = false; document.documentElement.classList.add("img-zoom-open");
      function ready() { fit(); box.querySelector('[data-z="close"]').focus(); }
      if (!img.getAttribute("src")) { img.onload = ready; img.src = srcImg.currentSrc || srcImg.src; }
      else ready();
    }
    function close() {
      if (!box) return;
      box.hidden = true; pts = {}; last = null; pinch = null;
      document.documentElement.classList.remove("img-zoom-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    btn.addEventListener("click", open);
    // Ohne Ablese-Werkzeug ist das Bild selbst frei: ein Klick darauf oeffnet die Vergroesserung.
    if (!MEDIA.methods) { srcImg.style.cursor = "zoom-in"; srcImg.addEventListener("click", open); }
  })();

  setTimeout(startTyping, 700);
})();
