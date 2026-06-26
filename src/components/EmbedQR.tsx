import type { EmbedMedia } from "@/types/exercise";

/**
 * Embed-Medium mit optionalem QR-Code (z. B. 3D-Modell am Handy öffnen).
 *
 * Phase 1: Die Übungs-JSON enthält noch eine Platzhalter-URL. Sobald eine echte
 * URL hinterlegt ist, wird hier ein QR-Code erzeugt (eigene QR-Bibliothek,
 * keine externen Dienste — Datenschutz). Bis dahin steht ein Platzhalter.
 */
export function EmbedQR({ media }: { media: EmbedMedia }) {
  const hasRealUrl = /^https?:\/\//.test(media.url) && !/PLATZHALTER/i.test(media.url);
  return (
    <div className="card">
      <h3>{media.label}</h3>
      <div className="body">
        {media.description ? (
          <p style={{ margin: "0 0 12px", color: "var(--ink-dim)", fontSize: 15, lineHeight: 1.6 }}>{media.description}</p>
        ) : null}
        <div className="qr-embed">
          <div
            aria-label="QR-Code-Platzhalter"
            style={{
              width: 128,
              height: 128,
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "repeating-conic-gradient(#0e1118 0% 25%, #1a2230 0% 50%) 0 / 18px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9aa6b6",
              fontSize: 11,
              textAlign: "center",
              padding: 8,
            }}
          >
            {hasRealUrl ? "QR folgt" : "URL noch\nnicht gesetzt"}
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ margin: "0 0 6px", color: "var(--ink)", fontWeight: 600, fontSize: 14 }}>3D-Modell öffnen</p>
            <p style={{ margin: 0, color: "var(--ink-mute)", fontSize: 13, lineHeight: 1.5 }}>
              {media.qr
                ? "Code mit dem Handy scannen — keine App, kein Login."
                : "Über den Link am Rechner öffnen."}
              {hasRealUrl ? (
                <>
                  {" "}
                  <a href={media.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                    Link öffnen
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
