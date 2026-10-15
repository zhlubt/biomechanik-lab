#!/usr/bin/env python3
"""
Erzeugt die Abbildung zur Uebung 'Kraft vs. Leistung' (Zerspanung/Prozessdiagnostik)
als eigenes SVG - urheberrechtlich unbedenklicher Nachbau, synthetische Daten.

Oben:  Zerspankraft F(t), piezoelektrisch gemessen -> hohe Bandbreite, Zahneingriff sichtbar.
Unten: Wirkleistung P(t) der linearen Vorschubachsen -> Leerlauf-Sockel, traege/gefiltert,
       gegen Ende eine aufklingende maschinenbedingte Stoerung, die in F NICHT auftaucht.

Ausgabe: php/public/img/zerspanung-kraft-leistung.svg
"""
import math, pathlib, random

random.seed(20260114)

W, H = 980, 620
PAD_L, PAD_R, PAD_T = 86, 24, 34
PANEL_H, GAP = 236, 52
N = 1700                      # Abtastpunkte
T_END = 60.0                  # s

# --- Prozessverlauf: Luftschnitt - Schnitt 1 - Rueckzug - Schnitt 2 - Rueckzug - Schnitt 3 - Auslauf
CUTS = [(6.0, 20.5), (23.0, 36.0), (38.5, 55.0)]
RETRACT = [(20.5, 23.0), (36.0, 38.5)]

def in_cut(t):
    return any(a <= t <= b for a, b in CUTS)

def envelope(t):
    """Grundniveau der Schnittkraft: Anschnitt-Rampe, Plateau, leichter Verschleissanstieg."""
    for a, b in CUTS:
        if a <= t <= b:
            ramp = min(1.0, (t - a) / 0.8)          # Anschnitt
            out  = min(1.0, (b - t) / 0.5)          # Austritt
            wear = 1.0 + 0.05 * (t - CUTS[0][0]) / (CUTS[-1][1] - CUTS[0][0])
            return ramp * out * wear
    return 0.0

force, power = [], []
for i in range(N):
    t = T_END * i / (N - 1)
    e = envelope(t)

    # Zahneingriff: hochfrequente Kraftschwankung, nur waehrend des Schnitts
    tooth = math.sin(2 * math.pi * 47 * t) * 0.30 + math.sin(2 * math.pi * 94 * t + 1.1) * 0.12
    f = e * (1.0 + tooth) + random.gauss(0, 0.045) * (0.25 + e)
    force.append(max(0.0, f))

    # Leistung: Leerlauf-Sockel + proportionaler Schnittanteil, traeger (spaeter gefiltert)
    idle = 0.30
    p = idle + 0.62 * e + random.gauss(0, 0.012)
    power.append(p)

# Leistung tiefpassfiltern -> Antriebsstrang/Messkette sind deutlich traeger als der Piezosensor
sm = []
k = 9
for i in range(N):
    lo, hi = max(0, i - k), min(N, i + k + 1)
    sm.append(sum(power[lo:hi]) / (hi - lo))
power = sm

# maschinenbedingte Stoerung: aufklingende Schwingung im letzten Schnitt, NUR in der Leistung.
# Wird NACH dem Tiefpass aufgepraegt - sie ist eine reale Schwingung der Maschine, kein Messrauschen,
# und muss im Schrieb sichtbar bleiben.
for i in range(N):
    t = T_END * i / (N - 1)
    if 43.0 <= t <= 54.5:
        grow = (t - 43.0) / 11.5
        power[i] += 0.19 * grow * grow * math.sin(2 * math.pi * 2.9 * t)

def panel_path(vals, y0, vmax):
    """Polyline in Panel-Koordinaten."""
    pts = []
    for i, v in enumerate(vals):
        x = PAD_L + (W - PAD_L - PAD_R) * i / (len(vals) - 1)
        y = y0 + PANEL_H - (PANEL_H - 16) * min(v / vmax, 1.0)
        pts.append(f"{x:.1f},{y:.1f}")
    return " ".join(pts)

y_f = PAD_T + 22
y_p = y_f + PANEL_H + GAP

def axes(y0, label, unit):
    return f'''
  <rect x="{PAD_L}" y="{y0}" width="{W-PAD_L-PAD_R}" height="{PANEL_H}" fill="#0e1118" stroke="#2a3342"/>
  <line x1="{PAD_L}" y1="{y0+PANEL_H}" x2="{W-PAD_R}" y2="{y0+PANEL_H}" stroke="#55627a"/>
  <line x1="{PAD_L}" y1="{y0}" x2="{PAD_L}" y2="{y0+PANEL_H}" stroke="#55627a"/>
  <text x="{PAD_L-12}" y="{y0+PANEL_H/2}" fill="#c6cfdd" font-size="15" text-anchor="middle"
        transform="rotate(-90 {PAD_L-12} {y0+PANEL_H/2})" font-family="system-ui,sans-serif">{label} / {unit}</text>
  <text x="{(PAD_L+W-PAD_R)/2}" y="{y0+PANEL_H+36}" fill="#c6cfdd" font-size="14" text-anchor="middle"
        font-family="system-ui,sans-serif">Zeit / s</text>'''

def ticks(y0):
    out = []
    for s in range(0, 61, 10):
        x = PAD_L + (W - PAD_L - PAD_R) * s / T_END
        out.append(f'<line x1="{x:.1f}" y1="{y0+PANEL_H}" x2="{x:.1f}" y2="{y0+PANEL_H+5}" stroke="#55627a"/>')
        out.append(f'<text x="{x:.1f}" y="{y0+PANEL_H+18}" fill="#8d99ab" font-size="11" text-anchor="middle" font-family="system-ui,sans-serif">{s}</text>')
    return "\n  ".join(out)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"
     role="img" aria-label="Zwei untereinander liegende Messschriebe: oben die piezoelektrisch gemessene Zerspankraft, unten die Wirkleistung der Vorschubachsen, ueber derselben Zeitachse">
  <title>Zerspankraft und Achsleistung ueber der Zeit</title>
  <desc>Oberes Diagramm: Kraft in Newton, hochfrequent schwankend, drei Schnittabschnitte mit zwei Einbruechen dazwischen.
Unteres Diagramm: Leistung in Watt mit Leerlauf-Sockel, glatterem Verlauf und einer aufklingenden Schwingung im letzten Abschnitt.</desc>
  <rect width="{W}" height="{H}" fill="#11151d"/>

  <text x="{PAD_L}" y="20" fill="#e6ecf5" font-size="14" font-weight="600" font-family="system-ui,sans-serif">
    Schritt 1 · Kraft (Piezosensor) und Leistung (Vorschubachsen) im selben Zeitfenster
  </text>
{axes(y_f, "Kraft F", "N")}
  {ticks(y_f)}
  <polyline fill="none" stroke="#4d8df6" stroke-width="0.9" stroke-linejoin="round" points="{panel_path(force, y_f, 1.45)}"/>
  <text x="{W-PAD_R-8}" y="{y_f+18}" fill="#4d8df6" font-size="12" text-anchor="end" font-family="system-ui,sans-serif">piezoelektrischer Dehnungssensor</text>

{axes(y_p, "Leistung P", "W")}
  {ticks(y_p)}
  <polyline fill="none" stroke="#7fb1ff" stroke-width="1.3" stroke-linejoin="round" points="{panel_path(power, y_p, 1.15)}"/>
  <text x="{W-PAD_R-8}" y="{y_p+18}" fill="#7fb1ff" font-size="12" text-anchor="end" font-family="system-ui,sans-serif">Wirkleistung der linearen Vorschubachsen</text>

  <rect x="{PAD_L + (W-PAD_L-PAD_R)*44/T_END:.1f}" y="{y_p+20}"
        width="{(W-PAD_L-PAD_R)*11/T_END:.1f}" height="{PANEL_H-40}"
        fill="none" stroke="#2fa6c9" stroke-width="1.6" stroke-dasharray="5 4"/>
  <text x="{PAD_L + (W-PAD_L-PAD_R)*49.5/T_END:.1f}" y="{y_p+PANEL_H-6}"
        fill="#2fa6c9" font-size="12.5" font-weight="600" text-anchor="middle" font-family="system-ui,sans-serif">
    maschinenbedingte Störung
  </text>
</svg>
'''

out = pathlib.Path(__file__).resolve().parent.parent / "php/public/img/zerspanung-kraft-leistung.svg"
out.write_text(svg, encoding="utf-8")
print("geschrieben:", out, len(svg), "Bytes")

# Die Ableseschiene in der Uebungs-JSON braucht die Plotgeometrie als Bruchteile der
# Bildkanten. Hier ausgeben, damit JSON und Zeichnung nicht auseinanderlaufen.
print()
print('readout-Geometrie fuer die Uebungs-JSON:')
print('  "x": { "from": %.6f, "to": %.6f, "min": %g, "max": %g }'
      % (PAD_L / W, (W - PAD_R) / W, 0.0, T_END))
print('  "guide": { "top": %.6f, "bottom": %.6f }'
      % (y_f / H, (y_p + PANEL_H) / H))
