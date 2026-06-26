import type { LLMProvider } from "./types";
import { AnthropicProvider } from "./anthropic";

export type { FeedbackInput, LLMProvider } from "./types";

/**
 * Wählt den LLM-Provider (Default Anthropic). ChatGPT ließe sich hier als
 * weiterer Adapter ergänzen (Konzept §4.3, offene Frage „nur Anthropic?").
 * Liest den Key serverseitig aus der Umgebung — niemals aus dem Client.
 */
export function getProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY fehlt in der Server-Umgebung (.env / .env.local).");
    }
    return new AnthropicProvider(apiKey);
  }
  throw new Error(`Unbekannter LLM_PROVIDER: ${provider}`);
}
