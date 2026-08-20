import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

const MODEL = "claude-sonnet-4-6";

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }
  return new Anthropic();
}

/**
 * Calls Claude with a system + user prompt, requiring a strict JSON response with no
 * markdown fences, then validates it against the given Zod schema. Throws on any failure —
 * an invalid or unparseable response should stop the script, not write a partial/garbage file.
 */
export async function generateStructuredJson<T extends z.ZodTypeAny>(params: {
  client: Anthropic;
  system: string;
  userPrompt: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const { client, system, userPrompt, schema, maxTokens = 16000 } = params;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: `${system}\n\nRespond with strict JSON only — no markdown code fences, no commentary before or after the JSON, no trailing commas.`,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    throw new Error(`Claude response had no text block. stop_reason: ${response.stop_reason}`);
  }

  // Defensive: strip markdown fences if the model added them despite instructions, but the
  // JSON structure itself must still be exactly right — no leniency beyond that.
  const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Claude response was not valid JSON: ${(err as Error).message}\n\nRaw response:\n${raw}`
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Claude response failed schema validation:\n${result.error.toString()}\n\nRaw response:\n${raw}`
    );
  }

  return result.data;
}
