"use client";

import { useState } from "react";

/**
 * Musterlösung / Experten-Beschreibung — zunächst verschwommen, auf Klick
 * sichtbar. Referenz, kein Ersatz für die eigene Formulierung (didaktische
 * Leitplanke).
 */
export function ModelSolution({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className={`card expert${revealed ? " revealed" : ""}`}>
      <h3>05 · Vergleich mit Experten-Beschreibung</h3>
      <div className="body">
        <div className="expert-body">{text}</div>
        <div className="reveal">
          <button className="ctrl" onClick={() => setRevealed(true)}>
            👁 Experten-Beschreibung einblenden
          </button>
        </div>
      </div>
    </div>
  );
}
