import Anthropic from "@anthropic-ai/sdk";
import type { Feedback, Marker } from "@/types/exercise";
import type { FeedbackInput, LLMProvider } from "./types";

/**
 * Anthropic-Adapter für das sokratische KI-Feedback.
 *
 * - Läuft NUR serverseitig (API-Key nie im Client-Bundle).
 * - Erzwingt strukturiertes JSON über output_config.format (Structured Outputs),
 *   damit das Frontend die Marker zuverlässig rendern kann.
 * - Didaktische Leitplanke: Das Modell liefert FRAGEN/Hinweise, keine fertigen
 *   Formulierungen; `quote` muss ein wörtliches Teilstück des Studierenden-Texts
 *   sein, damit der Marker im Text verortet werden kann.
 */

// Default-Modell laut claude-api-Skill; via ANTHROPIC_MODEL überschreibbar.
const DEFAULT_MODEL = "claude-opus-4-8";

function buildSchema(categoryKeys: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      markers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            category: { type: "string", enum: categoryKeys },
            quote: { type: "string" },
            question: { type: "string" },
            nudge: { type: "string" },
          },
          required: ["category", "quote", "question", "nudge"],
        },
      },
    },
    required: ["markers"],
  } as const;
}

function buildSystem(input: FeedbackInput): string {
  return [
    input.feedbackPrompt.trim(),
    "",
    "Verbindliche Regeln:",
    "- Gib ausschließlich FRAGEN oder kurze Hinweise, niemals fertige Formulierungen, Lösungen oder Textbausteine zum Kopieren.",
    "- Markiere 2–4 Stellen. Lieber wenige, gute Marker als viele.",
    "- `quote` muss ein WÖRTLICHES, zusammenhängendes Teilstück aus dem Studierenden-Text sein (exakt so im Text vorhanden, inkl. Zeichensetzung) — sonst kann die Stelle nicht markiert werden.",
    "- Ordne jeden Marker einer der vorgegebenen Kategorien zu.",
    "- Antworte auf Deutsch, in der Sie-/Du-Form passend zum Prompt.",
    "- Wenn der Text bereits fachlich präzise ist, gib weniger oder gar keine Marker zurück, statt künstlich welche zu erfinden.",
  ].join("\n");
}

function buildUser(input: FeedbackInput): string {
  const cats = input.categories.map((c) => `- ${c.key}: ${c.label}`).join("\n");
  const parts: string[] = [
    `AUFGABE:\n${input.task}`,
    `\nZIELKONZEPTE: ${input.targetConcepts.join(", ")}`,
  ];
  if (input.mediaDescription) parts.push(`\nMEDIEN-KONTEXT:\n${input.mediaDescription}`);
  parts.push(`\nKATEGORIEN (Schlüssel: Bedeutung):\n${cats}`);
  if (input.modelSolution) {
    parts.push(
      `\nINTERNE REFERENZ — Musterlösung (NUR für deine Einordnung, NICHT zitieren oder ausgeben):\n${input.modelSolution}`,
    );
  }
  parts.push(`\nSTUDIERENDEN-TEXT (kommentiere genau diesen Text):\n"""\n${input.studentText}\n"""`);
  return parts.join("\n");
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  }

  async getFeedback(input: FeedbackInput): Promise<Feedback> {
    const categoryKeys = input.categories.map((c) => c.key);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      system: buildSystem(input),
      output_config: { format: { type: "json_schema", schema: buildSchema(categoryKeys) } },
      messages: [{ role: "user", content: buildUser(input) }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: { markers?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("LLM-Antwort war kein gültiges JSON.");
    }

    const markers = sanitizeMarkers(parsed.markers, categoryKeys, input.studentText);
    return { markers };
  }
}

/** Validiert/säubert die Marker und verwirft Zitate, die nicht im Text stehen. */
function sanitizeMarkers(raw: unknown, categoryKeys: string[], studentText: string): Marker[] {
  if (!Array.isArray(raw)) return [];
  const out: Marker[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const cat = (m as Record<string, unknown>).category;
    const quote = (m as Record<string, unknown>).quote;
    const question = (m as Record<string, unknown>).question;
    const nudge = (m as Record<string, unknown>).nudge;
    if (typeof cat !== "string" || typeof quote !== "string" || typeof question !== "string") continue;
    if (!categoryKeys.includes(cat)) continue;
    // Zitat muss wörtlich im Text vorkommen, sonst lässt es sich nicht markieren.
    if (!studentText.includes(quote)) continue;
    out.push({
      category: cat,
      quote,
      question,
      nudge: typeof nudge === "string" ? nudge : undefined,
    });
  }
  return out;
}
