/**
 * Bewegungs- & Kraftmodell für die Übung "CMJ vs. Squat Jump".
 *
 * 1:1 portiert aus dem Referenz-Mockup mockups/v2/cmj-squatjump-light.html
 * (Funktionen fCMJ / fSJ / poseCMJ / poseSJ / drawFigure / drawKnee). Die
 * Funktionen sind rein und liefern entweder Zahlen oder Listen von
 * SVG-Primitiven, damit die React-Komponenten deklarativ rendern können.
 *
 * WICHTIG (Konzept §12, Schritt: "als Komponenten-Code portieren, nicht als
 * Daten"): Diese Kurven/Posen sind Verhalten, kein Inhalt — sie gehören in den
 * Code, nicht in die JSON.
 */

export const DURATION = 3.0; // Sekunden
export const FPS = 30;

// Farben dieser Übung (im Mockup: --x CMJ, --y Squat Jump, --z Prinzip)
export const COL = {
  cmj: "#3a63d8",
  sj: "#d98018",
  principle: "#1098a5",
  bad: "#c93535",
  good: "#1aa56a",
} as const;

export function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}
export function smooth(a: number, b: number, x: number): number {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
}

/* ---- Kraftkurven F(t) in BW ---- */
export function fCMJ(time: number): number {
  const tt = clamp(time, 0, DURATION);
  if (tt < 0.55) return 1.0; // Stand
  if (tt < 1.15) {
    const u = (tt - 0.55) / 0.6;
    return 1 - 0.46 * Math.sin(Math.PI * u); // Ausholen: Dip unter 1 BW
  }
  if (tt < 1.55) return 1 + 1.45 * smooth(1.15, 1.55, tt); // Abbremsen: Anstieg auf Peak
  if (tt < 1.95) return 2.45 * (1 - smooth(1.55, 1.95, tt)); // Abstoß: Peak -> 0
  if (tt < 2.62) return 0; // Flug
  if (tt < 3.0) {
    const g = 3.2 * Math.exp(-Math.pow((tt - 2.7) / 0.1, 2));
    return g + smooth(2.78, 3.0, tt) * 1.0 * (1 - Math.exp(-Math.pow((tt - 2.7) / 0.1, 2)));
  }
  return 1.0;
}
export function fSJ(time: number): number {
  const tt = clamp(time, 0, DURATION);
  if (tt < 1.15) return 1.0; // gehaltene Hocke, kein Dip
  if (tt < 1.55) return 1 + 1.0 * smooth(1.15, 1.55, tt); // Abstoß-Anstieg, niedrigerer Peak
  if (tt < 1.95) return 2.0 * (1 - smooth(1.55, 1.95, tt)); // Peak 2.0 -> 0
  if (tt < 2.5) return 0; // Flug (kürzer)
  if (tt < 3.0) {
    const g = 2.7 * Math.exp(-Math.pow((tt - 2.6) / 0.1, 2));
    return g + smooth(2.68, 3.0, tt) * 1.0 * (1 - Math.exp(-Math.pow((tt - 2.6) / 0.1, 2)));
  }
  return 1.0;
}

/* ---- Posen: drop (0=steht, 1=tiefe Hocke), air (Aufwärts-Offset) ---- */
export interface Pose {
  drop: number;
  air: number;
}
export function poseCMJ(time: number): Pose {
  const tt = clamp(time, 0, DURATION);
  let drop = 0;
  let air = 0;
  if (tt < 0.55) drop = 0;
  else if (tt < 1.15) drop = smooth(0.55, 1.15, tt);
  else if (tt < 1.55) drop = 1;
  else if (tt < 1.95) drop = 1 - smooth(1.55, 1.95, tt);
  else if (tt < 2.62) {
    drop = 0;
    air = Math.sin((Math.PI * (tt - 1.95)) / 0.67);
  } else {
    air = 0;
    drop = 0.6 * Math.sin(Math.PI * clamp((tt - 2.62) / 0.38, 0, 1));
  }
  return { drop, air };
}
export function poseSJ(time: number): Pose {
  const tt = clamp(time, 0, DURATION);
  let drop = 1;
  let air = 0;
  if (tt < 1.15) drop = 1;
  else if (tt < 1.95) drop = 1 - smooth(1.15, 1.95, tt);
  else if (tt < 2.5) {
    drop = 0;
    air = 0.78 * Math.sin((Math.PI * (tt - 1.95)) / 0.55);
  } else {
    air = 0;
    drop = 0.6 * Math.sin(Math.PI * clamp((tt - 2.5) / 0.5, 0, 1));
  }
  return { drop, air };
}

/* =========================================================
   SVG-PRIMITIVE
========================================================= */
export type Prim =
  | { k: "rect"; x: number; y: number; width: number; height: number; rx?: number; fill?: string; stroke?: string; sw?: number }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw?: number; dash?: string; cap?: string; opacity?: number }
  | { k: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; opacity?: number }
  | { k: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: string; opacity?: number }
  | { k: "path"; d: string; fill?: string; stroke?: string; sw?: number; dash?: string; opacity?: number; join?: string; cap?: string }
  | { k: "text"; x: number; y: number; text: string; fill: string; size: number; anchor?: string; weight?: number; family?: string };

/* ---- Layout & Diagramm-Skalen (Stage 720x460) ---- */
export const STAGE = { W: 720, H: 460 };
const figArea = { x: 18, y: 30, w: 300, h: 400 };
const chart = { x: 360, y: 40, w: 330, h: 330 };
const Fmax = 3.4;

export function cx(time: number): number {
  return chart.x + (clamp(time, 0, DURATION) / DURATION) * chart.w;
}
export function cy(F: number): number {
  return chart.y + chart.h - (clamp(F, 0, Fmax) / Fmax) * chart.h;
}

/* ---- vorberechnete volle Kurvenpfade ---- */
const N = 240;
export const cmjPts: [number, number][] = [];
export const sjPts: [number, number][] = [];
for (let i = 0; i <= N; i++) {
  const time = (i / N) * DURATION;
  cmjPts.push([cx(time), cy(fCMJ(time))]);
  sjPts.push([cx(time), cy(fSJ(time))]);
}
export function pathFrom(pts: [number, number][], upto: number | null): string {
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    if (upto != null && pts[i][0] > upto) break;
    d += (i === 0 ? "M" : "L") + pts[i][0].toFixed(1) + " " + pts[i][1].toFixed(1) + " ";
  }
  return d.trim();
}

/** Statische Diagramm-Elemente (Hintergrund, Gitter, Achsen, Legende, Boden). */
export function buildChartStatic(): Prim[] {
  const out: Prim[] = [];
  out.push({ k: "rect", x: chart.x - 26, y: chart.y - 26, width: chart.w + 52, height: chart.h + 64, rx: 10, fill: "#0b0e14", stroke: "#1d2531" });
  for (let bw = 0; bw <= 3; bw++) {
    const y = cy(bw);
    out.push({ k: "line", x1: chart.x, y1: y, x2: chart.x + chart.w, y2: y, stroke: bw === 1 ? "#5a6677" : "#222b39", sw: bw === 1 ? 1.4 : 1, dash: bw === 1 ? "5 4" : "2 5" });
    out.push({ k: "text", x: chart.x - 8, y: y + 4, text: bw + " BW", fill: "#7d8a9c", size: 12, anchor: "end", family: "monospace" });
  }
  out.push({ k: "text", x: chart.x - 30, y: chart.y - 12, text: "Fz (vertikale Bodenreaktionskraft)", fill: "#9aa6b6", size: 12, weight: 600 });
  out.push({ k: "text", x: chart.x + chart.w, y: chart.y + chart.h + 34, text: "Zeit →", fill: "#7d8a9c", size: 12, anchor: "end" });
  // Boden
  const gy = figArea.y + figArea.h - 20;
  out.push({ k: "line", x1: figArea.x, y1: gy, x2: figArea.x + figArea.w, y2: gy, stroke: "#39455a", sw: 2 });
  out.push({ k: "text", x: figArea.x + 78, y: gy + 30, text: "CMJ", fill: COL.cmj, size: 14, anchor: "middle", weight: 700 });
  out.push({ k: "text", x: figArea.x + 220, y: gy + 30, text: "Squat Jump", fill: COL.sj, size: 14, anchor: "middle", weight: 700 });
  return out;
}

/** Diagramm-Legendenbox (statisch). */
export function buildChartLegend(): Prim[] {
  const out: Prim[] = [];
  const lx = chart.x + chart.w - 150;
  out.push({ k: "rect", x: lx, y: chart.y + 6, width: 144, height: 46, rx: 7, fill: "rgba(10,14,20,.7)", stroke: "#222b39" });
  out.push({ k: "line", x1: lx + 10, y1: chart.y + 20, x2: lx + 30, y2: chart.y + 20, stroke: COL.cmj, sw: 3 });
  out.push({ k: "text", x: lx + 36, y: chart.y + 24, text: "CMJ", fill: "#cdd6e2", size: 12 });
  out.push({ k: "line", x1: lx + 10, y1: chart.y + 38, x2: lx + 30, y2: chart.y + 38, stroke: COL.sj, sw: 3 });
  out.push({ k: "text", x: lx + 36, y: chart.y + 42, text: "Squat Jump", fill: "#cdd6e2", size: 12 });
  return out;
}

/** Fläche "negativer Kraftstoß" (Dip unter 1 BW beim CMJ) bis zum Playhead. */
export function dipPath(px: number): string {
  const y1 = cy(1);
  let d = "";
  let open = false;
  for (let i = 0; i < cmjPts.length; i++) {
    const time = (i / (cmjPts.length - 1)) * DURATION;
    const F = fCMJ(time);
    const x = cmjPts[i][0];
    if (x > px) break;
    if (F < 1 && time < 1.2) {
      if (!open) {
        d += "M" + x.toFixed(1) + " " + y1.toFixed(1) + " ";
        open = true;
      }
      d += "L" + x.toFixed(1) + " " + cy(F).toFixed(1) + " ";
    } else if (open) {
      d += "L" + x.toFixed(1) + " " + y1.toFixed(1) + " Z ";
      open = false;
    }
  }
  if (open) d += "L" + Math.min(px, chart.x + chart.w).toFixed(1) + " " + y1.toFixed(1) + " Z";
  return d;
}

/** Dynamische Diagramm-Elemente (Kurven bis Playhead, Playhead, Punkte). */
export function buildChartDynamic(t: number): Prim[] {
  const px = cx(t);
  const out: Prim[] = [];
  // volle (blasse) Kurven
  out.push({ k: "path", d: pathFrom(sjPts, null), fill: "none", stroke: COL.sj, sw: 1.6, opacity: 0.28 });
  out.push({ k: "path", d: pathFrom(cmjPts, null), fill: "none", stroke: COL.cmj, sw: 1.6, opacity: 0.28 });
  // Dip-Fläche
  out.push({ k: "path", d: dipPath(px), fill: "rgba(58,99,216,0.22)", stroke: "none" });
  // helle Kurven bis Playhead
  out.push({ k: "path", d: pathFrom(sjPts, px), fill: "none", stroke: COL.sj, sw: 3, join: "round", cap: "round" });
  out.push({ k: "path", d: pathFrom(cmjPts, px), fill: "none", stroke: COL.cmj, sw: 3, join: "round", cap: "round" });
  // Playhead
  out.push({ k: "line", x1: px, y1: chart.y, x2: px, y2: chart.y + chart.h, stroke: "#aeb8c6", sw: 1, dash: "3 3" });
  // aktuelle Punkte
  out.push({ k: "circle", cx: px, cy: cy(fSJ(t)), r: 5, fill: COL.sj, stroke: "#0b0e14", sw: 1.5 });
  out.push({ k: "circle", cx: px, cy: cy(fCMJ(t)), r: 5, fill: COL.cmj, stroke: "#0b0e14", sw: 1.5 });
  return out;
}

/* ---- Strichfigur ---- */
export function drawFigure(which: "cmj" | "sj", cxFoot: number, pose: Pose): Prim[] {
  const out: Prim[] = [];
  const gy = figArea.y + figArea.h - 20;
  const airPx = pose.air * 150;
  const footY = gy - airPx;
  const standLeg = 120;
  const crouchDrop = 58;
  const legLen = standLeg - pose.drop * crouchDrop;
  const hipY = footY - legLen;
  const torso = 60 - pose.drop * 8;
  const shoulderY = hipY - torso;
  const headR = 12;
  const headY = shoulderY - headR - 6;
  const kneeOut = pose.drop * 20;
  const kneeY = (hipY + footY) / 2 - pose.drop * 6;
  const color = which === "cmj" ? COL.cmj : COL.sj;
  const sw = 4;

  // Beine
  [-9, 9].forEach((dx) => {
    const kneeX = cxFoot + dx + kneeOut * (dx < 0 ? -0.2 : 0.2);
    out.push({ k: "line", x1: cxFoot + dx * 0.6, y1: hipY, x2: kneeX + dx, y2: kneeY, stroke: color, sw, cap: "round" });
    out.push({ k: "line", x1: kneeX + dx, y1: kneeY, x2: cxFoot + dx, y2: footY, stroke: color, sw, cap: "round" });
  });
  // Rumpf
  out.push({ k: "line", x1: cxFoot, y1: hipY, x2: cxFoot, y2: shoulderY, stroke: color, sw, cap: "round" });
  // Arme
  const armUp = pose.air > 0.05 ? 1 : 0;
  const handY = armUp ? shoulderY - 34 : shoulderY + 30 + pose.drop * 14;
  const handX = armUp ? 16 : 22;
  [-1, 1].forEach((s) => {
    out.push({ k: "line", x1: cxFoot, y1: shoulderY, x2: cxFoot + s * handX, y2: handY, stroke: color, sw, cap: "round" });
  });
  // Kopf
  out.push({ k: "circle", cx: cxFoot, cy: headY, r: headR, stroke: color, sw: 4, fill: "#0e1118" });
  // Schatten
  out.push({ k: "ellipse", cx: cxFoot, cy: gy + 2, rx: 22 - airPx * 0.05, ry: 4, fill: "#000", opacity: clamp(0.35 - airPx * 0.0016, 0.05, 0.35) });
  return out;
}

/* ---- Knie-Detail (Frontalebene), synchron zur CMJ-Figur ---- */
export const KNEE = { W: 360, H: 320 };
function lerpCol(a: number[], b: number[], u: number): string {
  const p = (i: number) => Math.round(a[i] + (b[i] - a[i]) * clamp(u, 0, 1));
  return `rgb(${p(0)},${p(1)},${p(2)})`;
}
export interface KneeFrame {
  prims: Prim[];
  caption: string;
  captionColor: string;
}
export function drawKnee(time: number): KneeFrame {
  const out: Prim[] = [];
  const pose = poseCMJ(time);
  const flex = pose.drop;
  const landing = time >= 2.55;
  const load = landing ? clamp((fCMJ(time) - 1) / 2.2, 0, 1) : 0;
  const hipX = 180;
  const hipY = 48;
  const ankleX = 180;
  const ankleY = 272;
  const footY = 290;
  const kneeY = 170 + flex * 4;
  const kneeX = hipX - load * 48;
  const col = lerpCol([26, 165, 106], [201, 53, 53], load);

  // neutrale Achse
  out.push({ k: "line", x1: ankleX, y1: footY, x2: ankleX, y2: hipY + 6, stroke: "#2a3446", sw: 1.5, dash: "4 5" });
  // Bodenreaktionskraft-Pfeil
  if (load > 0.02) {
    const len = 28 + load * 78;
    const tipY = footY + 16 - len;
    out.push({ k: "line", x1: ankleX, y1: footY + 16, x2: ankleX, y2: tipY, stroke: "#e6c34a", sw: 3, cap: "round" });
    out.push({ k: "path", d: `M${ankleX - 6} ${tipY + 9} L${ankleX} ${tipY} L${ankleX + 6} ${tipY + 9} Z`, fill: "#e6c34a" });
  }
  // Knochen
  out.push({ k: "line", x1: hipX, y1: hipY, x2: kneeX, y2: kneeY, stroke: "#cdd6e2", sw: 11, cap: "round" }); // Femur
  out.push({ k: "line", x1: kneeX, y1: kneeY, x2: ankleX, y2: ankleY, stroke: "#cdd6e2", sw: 11, cap: "round" }); // Tibia
  out.push({ k: "line", x1: kneeX + 8, y1: kneeY + 12, x2: ankleX + 9, y2: ankleY - 4, stroke: "#9aa6b6", sw: 4, cap: "round" }); // Fibula
  out.push({ k: "line", x1: ankleX - 20, y1: footY, x2: ankleX + 26, y2: footY, stroke: "#cdd6e2", sw: 9, cap: "round" }); // Fuß
  out.push({ k: "circle", cx: kneeX - 6, cy: kneeY, r: 8, fill: "#e4e9f1" });
  out.push({ k: "circle", cx: kneeX + 6, cy: kneeY, r: 8, fill: "#e4e9f1" });
  // VKB
  const aw = 4 + load * 4;
  if (load > 0.25) out.push({ k: "line", x1: kneeX - 7, y1: kneeY + 9, x2: kneeX + 7, y2: kneeY - 9, stroke: col, sw: aw + 8, cap: "round", opacity: 0.25 });
  out.push({ k: "line", x1: kneeX - 7, y1: kneeY + 9, x2: kneeX + 7, y2: kneeY - 9, stroke: col, sw: aw, cap: "round" });
  out.push({ k: "circle", cx: kneeX, cy: kneeY, r: 5, fill: "none", stroke: landing && load > 0.3 ? col : "#7d8a9c", sw: 2 });
  // Labels
  out.push({ k: "text", x: hipX + 12, y: hipY + 28, text: "Femur", fill: "#9aa6b6", size: 12 });
  out.push({ k: "text", x: ankleX + 16, y: ankleY - 2, text: "Tibia", fill: "#9aa6b6", size: 12 });
  out.push({ k: "line", x1: kneeX - 30, y1: kneeY, x2: kneeX - 9, y2: kneeY, stroke: col, sw: 1 });
  out.push({ k: "text", x: kneeX - 34, y: kneeY + 4, text: "VKB", fill: col, size: 12, anchor: "end" });
  // Last-Anzeige
  const gx = 330;
  const gy0 = 72;
  const gh = 150;
  out.push({ k: "rect", x: gx, y: gy0, width: 14, height: gh, rx: 7, fill: "#1a2230", stroke: "#2a3446" });
  out.push({ k: "rect", x: gx, y: gy0 + gh - gh * load, width: 14, height: gh * load, rx: 7, fill: col });
  out.push({ k: "text", x: gx + 7, y: gy0 - 8, text: "VKB-Last", fill: "#9aa6b6", size: 12, anchor: "middle" });

  // Statuszeile
  let caption = "Flug";
  let captionColor = "#7d8a9c";
  if (time < 0.55) caption = "Stand — Knie über dem Fuß";
  else if (time < 1.95) caption = "Absprung — Streckung (Triple Extension)";
  else if (time < 2.55) caption = "Flug";
  else if (load > 0.45) {
    caption = "Landung: dynamischer Valgus → VKB-Last hoch";
    captionColor = "#d76b6b";
  } else {
    caption = "Landung — abfangen";
    captionColor = "#e6c34a";
  }
  out.push({ k: "text", x: 180, y: 312, text: caption, fill: captionColor, size: 12, anchor: "middle" });
  return { prims: out, caption, captionColor };
}

/** Zeit als mm:ss.mmm formatieren. */
export function fmtTime(x: number): string {
  if (!isFinite(x)) x = 0;
  const m = Math.floor(x / 60).toString().padStart(2, "0");
  const s = Math.floor(x % 60).toString().padStart(2, "0");
  const ms = Math.floor((x % 1) * 1000).toString().padStart(3, "0");
  return `${m}:${s}.${ms}`;
}
