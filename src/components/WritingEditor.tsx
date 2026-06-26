"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ExerciseDemo, FeedbackCategory, Marker } from "@/types/exercise";
import type { ExerciseLocator } from "@/lib/content";

/**
 * Schreib-Editor mit sokratischem Feedback.
 *
 * Phase 2: Der Studierenden-Text wird zunächst wie im Mockup „getippt"
 * (Typewriter, als Startpunkt) und ist danach frei editierbar. „KI Feedback"
 * schickt den aktuellen Text an die serverseitige Route /api/feedback, die das
 * LLM aufruft und strukturierte Marker zurückgibt. Gerendert werden sie wie im
 * Mockup: farbige Markierung + Chip + schwebender Hinweis-Tooltip.
 *
 * Fällt der LLM-Aufruf aus (kein Key, offline), bleibt das Demo-Feedback aus der
 * JSON als expliziter Rückfall erhalten.
 */

interface Segment {
  text: string;
  markerIdx: number | null;
}

type Phase = "writing" | "loading" | "feedback";

export function WritingEditor({
  task,
  demo,
  categories,
  locator,
}: {
  task: string;
  demo: ExerciseDemo;
  categories: FeedbackCategory[];
  locator: ExerciseLocator;
}) {
  const colorByCategory = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.key] = c.color;
    return m;
  }, [categories]);
  const labelByCategory = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.key] = c.label;
    return m;
  }, [categories]);

  // ---- Editor / Typewriter ----
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>("writing");
  const [typed, setTyped] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [editable, setEditable] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [markersHidden, setMarkersHidden] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Feedback-Ergebnis
  const [submittedText, setSubmittedText] = useState("");
  const [markers, setMarkers] = useState<Marker[]>([]);

  const demoText = demo.studentText;

  const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

  const escapeHTML = (s: string) =>
    s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!).replace(/\n/g, "<br>");

  // Typewriter schreibt direkt ins (unkontrollierte) contentEditable-Div.
  useEffect(() => {
    if (phase !== "writing") return;
    if (typingDone) return;
    const el = editorRef.current;
    if (!el) return;
    if (typed >= demoText.length) {
      el.innerHTML = escapeHTML(demoText);
      setWordCount(countWords(demoText));
      setTypingDone(true);
      setEditable(true);
      return;
    }
    const step = 2;
    const partial = demoText.slice(0, typed + step);
    el.innerHTML = escapeHTML(partial) + '<span class="caret"></span>';
    setWordCount(countWords(partial));
    const last = demoText[Math.min(typed + step - 1, demoText.length - 1)];
    let delay = 10 + Math.random() * 16;
    if (".,".includes(last)) delay = 90 + Math.random() * 70;
    if (last === "\n") delay = 140;
    if (demoText.slice(typed, typed + 5) === "aber ") delay = 260;
    timerRef.current = setTimeout(() => setTyped((n) => Math.min(n + step, demoText.length)), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [typed, typingDone, phase, demoText]);

  // Autostart kurz nach Mount
  useEffect(() => {
    const id = setTimeout(() => setTyped((n) => (n === 0 ? 2 : n)), 700);
    return () => clearTimeout(id);
  }, []);

  const resetWriting = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMarkers([]);
    setSubmittedText("");
    setError(null);
    setEditable(false);
    setTypingDone(false);
    setTyped(0);
    setPhase("writing");
    if (editorRef.current) editorRef.current.innerHTML = "";
  }, []);

  const skipTyping = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (editorRef.current) editorRef.current.innerHTML = escapeHTML(demoText);
    setWordCount(countWords(demoText));
    setTypingDone(true);
    setEditable(true);
    setTyped(demoText.length);
  }, [demoText]);

  function onEditorInput() {
    if (editorRef.current) setWordCount(countWords(editorRef.current.innerText));
  }

  // ---- echtes KI-Feedback ----
  async function requestFeedback() {
    const text = (editorRef.current?.innerText ?? "").trim();
    if (text.length < 10) {
      setError("Bitte schreibe zuerst ein paar Sätze.");
      return;
    }
    setError(null);
    setPhase("loading");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...locator, studentText: text }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Serverfehler (${res.status})`);
      }
      const data = (await res.json()) as { markers?: Marker[] };
      setSubmittedText(text);
      setMarkers(data.markers ?? []);
      setPhase("feedback");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feedback fehlgeschlagen.");
      setPhase("writing");
    }
  }

  function showDemoFeedback() {
    setError(null);
    setSubmittedText(demoText);
    setMarkers(demo.feedback.markers);
    setPhase("feedback");
  }

  // ---- Feedback-Segmente ----
  const segments = useMemo<Segment[]>(() => {
    if (phase !== "feedback") return [];
    const ranges: { start: number; end: number; idx: number }[] = [];
    markers.forEach((mk, idx) => {
      const start = submittedText.indexOf(mk.quote);
      if (start >= 0) ranges.push({ start, end: start + mk.quote.length, idx });
    });
    ranges.sort((a, b) => a.start - b.start);
    const segs: Segment[] = [];
    let cursor = 0;
    for (const r of ranges) {
      if (r.start > cursor) segs.push({ text: submittedText.slice(cursor, r.start), markerIdx: null });
      segs.push({ text: submittedText.slice(r.start, r.end), markerIdx: r.idx });
      cursor = r.end;
    }
    if (cursor < submittedText.length) segs.push({ text: submittedText.slice(cursor), markerIdx: null });
    return segs;
  }, [phase, submittedText, markers]);

  const chipOrder = useMemo(() => {
    const order: number[] = [];
    segments.forEach((s) => {
      if (s.markerIdx != null) order.push(s.markerIdx);
    });
    return order;
  }, [segments]);
  const chipNumOf = useCallback((markerIdx: number) => chipOrder.indexOf(markerIdx) + 1, [chipOrder]);
  const markerCount = chipOrder.length;

  // ---- Tooltip-Steuerung ----
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [tip, setTip] = useState<{ left: number; top: number; placement: "above" | "below"; arrowLeft: number } | null>(null);
  const chipRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const tipRef = useRef<HTMLDivElement | null>(null);

  const positionTip = useCallback((markerIdx: number) => {
    const chip = chipRefs.current.get(markerIdx);
    const el = tipRef.current;
    if (!chip || !el) return;
    const r = chip.getBoundingClientRect();
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    const m = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let placement: "above" | "below" = "below";
    let top = r.bottom + m;
    if (top + tipH > vh - 8 && r.top - tipH - m > 8) {
      placement = "above";
      top = r.top - tipH - m;
    }
    let left = r.left + r.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, vw - tipW - 8));
    const arrowLeft = Math.max(14, Math.min(r.left + r.width / 2 - left, tipW - 14));
    setTip({ left, top, placement, arrowLeft });
  }, []);

  const hideTip = useCallback(
    (force = false) => {
      if (pinned && !force) return;
      setActiveIdx(null);
    },
    [pinned],
  );

  useLayoutEffect(() => {
    if (activeIdx != null) positionTip(activeIdx);
  }, [activeIdx, positionTip]);

  useEffect(() => {
    if (activeIdx == null) return;
    const handler = () => positionTip(activeIdx);
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [activeIdx, positionTip]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (tipRef.current && tipRef.current.contains(target)) return;
      if (target.closest && target.closest(".note-chip")) return;
      setPinned(false);
      setActiveIdx(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
        setActiveIdx(null);
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const activeMarker = activeIdx != null ? markers[activeIdx] : null;
  const activeColor = activeMarker ? colorByCategory[activeMarker.category] ?? "var(--ink-mute)" : "var(--ink-mute)";

  const showFeedback = phase === "feedback";
  const loading = phase === "loading";

  return (
    <section className="write">
      <h2>03 · Deine Beschreibung</h2>
      <p className="lead">{task}</p>

      <div className={`editor-shell${markersHidden ? " markers-hidden" : ""}`}>
        <div className="editor-toolbar">
          <span className="live">{loading ? "KI denkt nach …" : editable && !showFeedback ? "live · du schreibst" : "live · Studierende:r tippt"}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="ctrl" style={{ padding: "5px 10px", fontSize: 12 }} onClick={skipTyping} disabled={loading}>
              ⏭ Sofort fertig
            </button>
            <button className="ctrl" style={{ padding: "5px 10px", fontSize: 12 }} onClick={resetWriting} disabled={loading}>
              ↻ Neu abspielen
            </button>
          </div>
        </div>

        {showFeedback ? (
          <div className="editor">
            {segments.map((s, i) =>
              s.markerIdx == null ? (
                <span key={i}>{s.text}</span>
              ) : (
                <FeedbackSpan
                  key={i}
                  text={s.text}
                  num={chipNumOf(s.markerIdx)}
                  color={colorByCategory[markers[s.markerIdx].category] ?? "var(--ink-mute)"}
                  opened={pinned && activeIdx === s.markerIdx}
                  hovered={activeIdx === s.markerIdx}
                  registerChip={(el) => {
                    if (el) chipRefs.current.set(s.markerIdx!, el);
                    else chipRefs.current.delete(s.markerIdx!);
                  }}
                  onEnter={() => {
                    if (!pinned) setActiveIdx(s.markerIdx);
                  }}
                  onLeave={() => {
                    if (!pinned) hideTip();
                  }}
                  onFocus={() => setActiveIdx(s.markerIdx)}
                  onBlur={() => {
                    if (!pinned) hideTip();
                  }}
                  onClick={() => {
                    if (pinned && activeIdx === s.markerIdx) {
                      setPinned(false);
                      setActiveIdx(null);
                    } else {
                      setPinned(true);
                      setActiveIdx(s.markerIdx);
                    }
                  }}
                />
              ),
            )}
          </div>
        ) : (
          <div
            className="editor"
            ref={editorRef}
            contentEditable={editable && !loading}
            suppressContentEditableWarning
            aria-label="Schreibfeld"
            onInput={onEditorInput}
          />
        )}

        {showFeedback ? (
          markerCount > 0 ? (
            <div className="hint-banner show">
              <div className="row">
                <span className="icon">💡</span>
                <span>
                  Die KI hat <b>{markerCount} Stellen</b> markiert, an denen du präziser werden könntest. Öffne einen
                  Marker nur, wenn du Feedback dazu möchtest — die Hinweise sind <b>Fragen, keine Lösungen</b>. Du schreibst.
                </span>
                <button className="toggle" type="button" onClick={() => setMarkersHidden((h) => !h)}>
                  {markersHidden ? "Marker einblenden" : "Marker ausblenden"}
                </button>
              </div>
            </div>
          ) : (
            <div className="hint-banner show">
              <div className="row">
                <span className="icon">✅</span>
                <span>
                  Die KI hat hier <b>keine Stellen</b> markiert — deine Beschreibung ist schon recht präzise. Du kannst sie
                  trotzdem weiter schärfen.
                </span>
              </div>
            </div>
          )
        ) : null}

        {error ? (
          <div className="hint-banner show" style={{ background: "color-mix(in srgb, var(--bad) 8%, transparent)", borderColor: "color-mix(in srgb, var(--bad) 30%, transparent)" }}>
            <div className="row">
              <span className="icon">⚠️</span>
              <span>
                <b>{error}</b> Du kannst es erneut versuchen oder ersatzweise das hinterlegte Demo-Feedback ansehen.
              </span>
              <button className="toggle" type="button" onClick={showDemoFeedback}>
                Demo-Feedback
              </button>
            </div>
          </div>
        ) : null}

        <div className="editor-actions">
          <button className="ctrl primary" disabled={!typingDone || loading || showFeedback} onClick={requestFeedback}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
            </svg>
            {loading ? "KI denkt nach …" : "KI Feedback"}
          </button>
          <button className="ctrl" onClick={resetWriting} disabled={loading}>
            ↺ Zurücksetzen
          </button>
          <span className="hint">{wordCount} Wörter</span>
        </div>
      </div>

      {/* Schwebender Hinweis-Tooltip */}
      <div
        ref={tipRef}
        className={`float-tip${activeMarker && !markersHidden ? " show" : ""}`}
        role="tooltip"
        data-placement={tip?.placement ?? "below"}
        style={{ left: tip?.left ?? 0, top: tip?.top ?? 0 }}
      >
        {activeMarker ? (
          <>
            <div className="label" style={{ color: activeColor }}>
              <span className="sw" style={{ background: activeColor }} />
              Hinweis {chipNumOf(activeIdx!)} · {labelByCategory[activeMarker.category] ?? activeMarker.category}
            </div>
            <div className="body">{activeMarker.question}</div>
            {activeMarker.nudge ? (
              <div className="nudge">
                <b>💡 </b>
                {activeMarker.nudge}
              </div>
            ) : null}
          </>
        ) : null}
        <div className="arrow" style={{ left: tip?.arrowLeft ?? 14 }} />
      </div>
    </section>
  );
}

function FeedbackSpan({
  text,
  num,
  color,
  opened,
  hovered,
  registerChip,
  onEnter,
  onLeave,
  onFocus,
  onBlur,
  onClick,
}: {
  text: string;
  num: number;
  color: string;
  opened: boolean;
  hovered: boolean;
  registerChip: (el: HTMLButtonElement | null) => void;
  onEnter: () => void;
  onLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onClick: () => void;
}) {
  return (
    <>
      <span className={`mark${hovered ? " hovered" : ""}${opened ? " opened" : ""}`} style={{ ["--mark-c" as string]: color }}>
        {text}
      </span>
      <button
        type="button"
        ref={registerChip}
        className={`note-chip${opened ? " opened" : ""}`}
        style={{ ["--mark-c" as string]: color }}
        aria-label={`Hinweis ${num} öffnen`}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <span className="num">{num}</span>
      </button>
    </>
  );
}
