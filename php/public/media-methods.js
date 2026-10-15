/* =========================================================
   Methoden-Fundus: wiederverwendbare Arten, mit einem Medium zu
   arbeiten und Werte daraus abzulesen.

   Eine Methode wird einmal registriert und danach rein über die
   Übungs-JSON aktiviert — kein Code je Übung. Aktiv:

     "readout"  Achsenwert unter dem Zeiger ablesen (Punkt oder Spanne)
                und als Beleg in den eigenen Text übernehmen.

   Registrieren:  LabMethods.register("name", { init: function (el, cfg, api) {…} })
   el  = Container des Mediums (position:relative)
   cfg = media[].methods.<name> aus der Übungs-JSON
   api = { insertAtCursor(text), onTeardown(fn) }   — von app.js bereitgestellt
========================================================= */
(function () {
  "use strict";

  var registry = {};
  window.LabMethods = {
    register: function (name, impl) { registry[name] = impl; },
    /** Alle in der JSON gewünschten Methoden auf einem Medien-Container starten. */
    boot: function (el, methods, api) {
      if (!el || !methods) return;
      Object.keys(methods).forEach(function (name) {
        var impl = registry[name];
        if (!impl || !impl.init) { return; }
        try { impl.init(el, methods[name], api || {}); }
        catch (e) { if (window.console) console.warn("Methode '" + name + "' nicht gestartet:", e); }
      });
    }
  };

  /* ---------------------------------------------------------
     METHODE "readout" — Achsenwert ablesen
     --------------------------------------------------------- */
  function fmtNumber(v, decimals) {
    return v.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  LabMethods.register("readout", {
    init: function (host, cfg, api) {
      var ax = cfg.x || {};
      var from = typeof ax.from === "number" ? ax.from : 0;
      var to = typeof ax.to === "number" ? ax.to : 1;
      var vMin = typeof ax.min === "number" ? ax.min : 0;
      var vMax = typeof ax.max === "number" ? ax.max : 1;
      var unit = ax.unit || "";
      var decimals = typeof ax.decimals === "number" ? ax.decimals : 1;
      var axisLabel = ax.label || "Wert";
      var guide = cfg.guide || { top: 0, bottom: 1 };
      var step = typeof ax.step === "number" ? ax.step : (vMax - vMin) / 100;
      if (to <= from) return;

      /* --- Aufbau: Overlay über dem Bild + Ablesezeile darunter --- */
      host.classList.add("ro-host");

      var layer = document.createElement("div");
      layer.className = "ro-layer";
      layer.setAttribute("tabindex", "0");
      layer.setAttribute("role", "slider");
      layer.setAttribute("aria-label", axisLabel + " im Diagramm ablesen");
      layer.setAttribute("aria-valuemin", String(vMin));
      layer.setAttribute("aria-valuemax", String(vMax));

      var band = document.createElement("div"); band.className = "ro-band"; band.hidden = true;
      var lineA = document.createElement("div"); lineA.className = "ro-line";
      var lineB = document.createElement("div"); lineB.className = "ro-line ro-line-b"; lineB.hidden = true;
      var badge = document.createElement("div"); badge.className = "ro-badge"; badge.hidden = true;
      [band, lineA, lineB, badge].forEach(function (n) {
        n.style.top = (guide.top * 100) + "%";
        if (n !== badge) n.style.height = ((guide.bottom - guide.top) * 100) + "%";
        layer.appendChild(n);
      });

      var bar = document.createElement("div");
      bar.className = "ro-bar";
      bar.innerHTML =
        '<span class="ro-read">' + axisLabel + ': <b class="ro-val">—</b></span>' +
        '<button type="button" class="ctrl ro-insert" disabled>In den Text übernehmen</button>' +
        '<span class="ro-hint">Zeiger über das Diagramm bewegen · ziehen für eine Spanne · Klick fixiert</span>';
      host.parentNode.insertBefore(bar, host.nextSibling);

      var valEl = bar.querySelector(".ro-val");
      var insertBtn = bar.querySelector(".ro-insert");

      /* --- Zustand --- */
      var a = null, b = null;      // Achsenwerte: a = Punkt/Spannenanfang, b = Spannenende
      var pinned = false, dragging = false, dragStart = null;

      function fracToValue(f) {
        var t = (f - from) / (to - from);
        return vMin + Math.max(0, Math.min(1, t)) * (vMax - vMin);
      }
      function valueToFrac(v) {
        var t = (v - vMin) / (vMax - vMin);
        return from + Math.max(0, Math.min(1, t)) * (to - from);
      }
      function fracFromEvent(e) {
        var r = layer.getBoundingClientRect();
        var x = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) - r.left;
        return r.width ? x / r.width : 0;
      }
      /** Liegt der Zeiger überhaupt im bemaßten Plotbereich? */
      function inPlot(f) { return f >= from - 0.01 && f <= to + 0.01; }

      function label() {
        if (a === null) return "—";
        if (b === null) return fmtNumber(a, decimals) + " " + unit;
        var lo = Math.min(a, b), hi = Math.max(a, b);
        return fmtNumber(lo, decimals) + "–" + fmtNumber(hi, decimals) + " " + unit;
      }
      function insertText() {
        if (a === null) return "";
        if (b === null) return "[" + fmtNumber(a, decimals) + " " + unit + "] ";
        var lo = Math.min(a, b), hi = Math.max(a, b);
        return "[" + fmtNumber(lo, decimals) + "–" + fmtNumber(hi, decimals) + " " + unit + "] ";
      }

      function render() {
        var has = a !== null;
        lineA.hidden = !has;
        badge.hidden = !has;
        if (has) {
          lineA.style.left = (valueToFrac(a) * 100) + "%";
          badge.style.left = (valueToFrac(b === null ? a : (a + b) / 2) * 100) + "%";
          badge.textContent = label();
          layer.setAttribute("aria-valuenow", String(Math.round(a * 100) / 100));
          layer.setAttribute("aria-valuetext", label());
        }
        var span = has && b !== null;
        lineB.hidden = !span;
        band.hidden = !span;
        if (span) {
          var fa = valueToFrac(a), fb = valueToFrac(b);
          lineB.style.left = (fb * 100) + "%";
          band.style.left = (Math.min(fa, fb) * 100) + "%";
          band.style.width = (Math.abs(fb - fa) * 100) + "%";
        }
        valEl.textContent = label();
        insertBtn.disabled = !has;
        layer.classList.toggle("ro-pinned", pinned);
      }

      /* --- Zeiger --- */
      layer.addEventListener("pointermove", function (e) {
        if (pinned && !dragging) return;
        var f = fracFromEvent(e);
        if (!dragging && !inPlot(f)) { return; }
        if (dragging) { b = fracToValue(f); if (Math.abs(b - dragStart) < step) b = null; }
        else { a = fracToValue(f); b = null; }
        render();
      });
      layer.addEventListener("pointerleave", function () {
        if (pinned || dragging) return;
        a = null; b = null; render();
      });
      layer.addEventListener("pointerdown", function (e) {
        var f = fracFromEvent(e);
        if (!inPlot(f)) return;
        e.preventDefault();
        dragging = true; pinned = false;
        a = fracToValue(f); b = null; dragStart = a;
        try { layer.setPointerCapture(e.pointerId); } catch (_) {}
        render();
      });
      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        try { layer.releasePointerCapture(e.pointerId); } catch (_) {}
        pinned = true;            // nach dem Loslassen stehen bleiben, damit man übernehmen kann
        layer.focus({ preventScroll: true });
        render();
      }
      layer.addEventListener("pointerup", endDrag);
      layer.addEventListener("pointercancel", endDrag);

      /* --- Tastatur: ohne Maus bedienbar --- */
      layer.addEventListener("keydown", function (e) {
        var big = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          if (a === null) a = vMin;
          var d = (e.key === "ArrowRight" ? 1 : -1) * step * big;
          if (e.altKey) { b = Math.max(vMin, Math.min(vMax, (b === null ? a : b) + d)); }
          else { a = Math.max(vMin, Math.min(vMax, a + d)); }
          pinned = true; render();
        } else if (e.key === "Enter") {
          e.preventDefault(); doInsert();
        } else if (e.key === "Escape") {
          pinned = false; a = null; b = null; render();
        }
      });

      function doInsert() {
        var t = insertText();
        if (!t) return;
        if (api && typeof api.insertAtCursor === "function") api.insertAtCursor(t);
        pinned = false;
      }
      insertBtn.addEventListener("click", doInsert);

      host.appendChild(layer);
      render();
    }
  });
})();
