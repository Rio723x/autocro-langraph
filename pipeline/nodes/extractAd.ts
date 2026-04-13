/** Step 7 — Read the ad creative from disk and send it to Ollama (gemma4:latest)
 * as a multimodal vision prompt. The model classifies the ad into a fixed
 * intent schema — it never generates free-form text.
 *
 * Runs in parallel with Steps 4–6 (browser pipeline). */
import fs from "node:fs/promises";
import type { PipelineState, AdJson } from "../types";
import { EMPTY_AD_JSON, OLLAMA_BASE_URL, OLLAMA_MODEL } from "../constants";

function sanitizeJson(rawText: string): string {
  return rawText.replace(/```json|```/g, "").trim();
}

const SYSTEM_PROMPT = `You are an ad classifier. Your job is to read an ad creative image and 
classify it into a structured intent schema using only predefined enum values.
Do not invent categories. If uncertain, pick the closest match.
Return only valid JSON. No markdown. No explanation.`;

const USER_PROMPT = `Classify this ad creative into the following JSON schema.
Use ONLY the listed enum values — do not make up new ones.

{
  "target_audience": "<free text description of who the ad targets>",
  "primary_goal": "<lead_generation | purchase | signup | app_install | awareness>",
  "offer_type": "<discount | free_trial | limited_spots | bonus | guarantee | none>",
  "urgency_level": "<none | low | medium | high>",
  "tone": ["<urgent | emotional | logical | fear | aspirational | trust>"],
  "cta_style": "<soft | action | aggressive | curiosity>",
  "key_messages": ["<short array of the ad's core copy ideas>"],
  "keywords": ["<short array of salient terms from the ad>"]
}

Choose only from the listed values for enum fields. For tone, pick all that apply.
Return ONLY valid JSON. No markdown fences.`;

export async function extractAd(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const imageBuffer = await fs.readFile(state.adFilePath);
  const base64Image = imageBuffer.toString("base64");

  let responseText = "";

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: SYSTEM_PROMPT,
        prompt: USER_PROMPT,
        images: [base64Image],
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama responded with ${res.status}`);
    }

    const data = (await res.json()) as { response?: string };
    responseText = String(data.response ?? "").trim();
  } catch (error) {
    console.warn("[extractAd] Ollama request failed:", (error as Error).message);
    return { adJson: { ...EMPTY_AD_JSON } };
  }

  try {
    const parsed = JSON.parse(sanitizeJson(responseText)) as Partial<AdJson>;
    const adJson: AdJson = {
      target_audience: parsed.target_audience ?? "",
      primary_goal: parsed.primary_goal ?? "awareness",
      offer_type: parsed.offer_type ?? "none",
      urgency_level: parsed.urgency_level ?? "none",
      tone: Array.isArray(parsed.tone) ? parsed.tone : [],
      cta_style: parsed.cta_style ?? "soft",
      key_messages: Array.isArray(parsed.key_messages) ? parsed.key_messages : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
    return { adJson };
  } catch {
    console.warn("[extractAd] JSON parse failed, using empty intent");
    return { adJson: { ...EMPTY_AD_JSON } };
  }
}
