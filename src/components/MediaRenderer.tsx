"use client";

import type { Media } from "@/types/exercise";
import { JumpForceLab } from "./JumpForceLab";
import { KneeFrontal } from "./KneeFrontal";
import { EmbedQR } from "./EmbedQR";

/**
 * Wählt anhand des Medien-Typs (und bei `interactive` der `component`) die
 * passende Renderer-Komponente. Erweiterbar für image/video in späteren Phasen.
 */
export function MediaRenderer({ media }: { media: Media }) {
  switch (media.type) {
    case "interactive":
      if (media.component === "JumpForceLab") return <JumpForceLab label={media.label} />;
      if (media.component === "KneeFrontal") return <KneeFrontal label={media.label} caption={media.caption} />;
      return <UnknownMedia label={media.label} note={`Unbekannte Komponente: ${media.component}`} />;
    case "embed":
      return <EmbedQR media={media} />;
    case "image":
      return (
        <div className="card">
          <h3>{media.label}</h3>
          <div className="body">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.src} alt={media.alt ?? ""} style={{ width: "100%", borderRadius: 10 }} />
            {media.caption ? <p style={{ color: "var(--ink-mute)", fontSize: 13 }}>{media.caption}</p> : null}
          </div>
        </div>
      );
    case "video":
      return (
        <div className="card">
          <h3>{media.label}</h3>
          <div className="body">
            <video src={media.src} controls style={{ width: "100%", borderRadius: 10, background: "#000" }} />
            {media.caption ? <p style={{ color: "var(--ink-mute)", fontSize: 13 }}>{media.caption}</p> : null}
          </div>
        </div>
      );
    default:
      return null;
  }
}

function UnknownMedia({ label, note }: { label: string; note: string }) {
  return (
    <div className="card">
      <h3>{label}</h3>
      <div className="body">
        <p style={{ color: "var(--ink-mute)" }}>{note}</p>
      </div>
    </div>
  );
}
