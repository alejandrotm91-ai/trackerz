import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./env";

/**
 * Único punto donde se elige el modelo de IA: Claude, vía la API de Anthropic.
 * La clave se guarda como secreto del Worker:
 *   npx wrangler secret put ANTHROPIC_API_KEY
 */
const MODEL = "claude-opus-5-5";
/** Modelo del reporte estándar de Inteligencia (botón "Inteligencia" del Cronograma). */
export const MODEL_REPORTE = "claude-sonnet-5-5";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface GenerateParams {
  system: string;
  prompt: string;
  /** Por defecto Claude Opus 5.5. */
  model?: string;
  /** Profundidad del análisis. Por defecto "medium". */
  effort?: Effort;
}

export async function generateText(env: Env, { system, prompt, model = MODEL, effort = "medium" }: GenerateParams): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("Falta el secreto ANTHROPIC_API_KEY en Cloudflare.");
  }
  // El SDK ya reintenta errores temporales (429, 5xx, red).
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 3 });

  // Streaming para evitar cortes en respuestas largas; finalMessage() junta todo.
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 32000,
    output_config: { effort },
    // Si los filtros de seguridad rechazan la solicitud, Anthropic la reintenta con otro modelo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("El modelo rechazó la solicitud.");
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (text.trim() === "") {
    throw new Error("El modelo no devolvió texto.");
  }
  return text;
}
