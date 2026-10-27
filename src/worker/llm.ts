import type { Env } from "./env";

/**
 * Único punto donde se elige el modelo de IA.
 *
 * Hoy usa Workers AI (incluido en Cloudflare, sin claves externas).
 * Para pasar a Claude: reemplazar el cuerpo de `callModel` por una llamada a
 * https://api.anthropic.com/v1/messages con una clave guardada como secreto
 * (npx wrangler secret put ANTHROPIC_API_KEY). Nada más en la app cambia.
 */
const MODEL = "@cf/openai/gpt-oss-120b";

export interface GenerateParams {
  system: string;
  prompt: string;
  temperature?: number;
}

async function callModel(env: Env, { system, prompt, temperature }: GenerateParams): Promise<string> {
  const result: any = await env.AI.run(MODEL as any, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature,
    max_tokens: 8000,
    reasoning_effort: "medium",
  } as any);

  // Workers AI responde en formato OpenAI (choices) o simple (response), según el modelo.
  const text =
    result?.choices?.[0]?.message?.content ??
    result?.response ??
    result?.output_text ??
    "";
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("El modelo no devolvió texto.");
  }
  return text;
}

function isRetryable(error: any): boolean {
  const s = typeof error === "object" ? JSON.stringify(error) + String(error?.message) : String(error);
  return /\b(429|502|503)\b|UNAVAILABLE|capacity|Capacity|high demand|rate limit|temporar/i.test(s);
}

/** Genera texto con reintentos ante errores temporales (saturación o límite de uso). */
export async function generateText(env: Env, params: GenerateParams, maxRetries = 3, delayMs = 1000): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await callModel(env, params);
    } catch (error: any) {
      if (attempt >= maxRetries || !isRetryable(error)) throw error;
      console.warn(`AI error temporal (intento ${attempt}/${maxRetries}). Reintentando en ${delayMs}ms...`, error?.message || error);
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 2;
    }
  }
}
