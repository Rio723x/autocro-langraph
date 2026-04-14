/** Step 7 — Read the ad creative from disk and send it to Ollama (gemma4:latest)
 * as a multimodal vision prompt. The model classifies the ad into a fixed
 * intent schema — it never generates free-form text.
 *
 * Runs in parallel with Steps 4–6 (browser pipeline). */
import fs from "node:fs/promises";
import type { PipelineState, AdJson } from "../types";
import { EMPTY_AD_JSON } from "../constants";
import { llmCall } from "../llm";
import { log, elapsed } from "../logger";

const NODE = "extractAd";

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
  const t = Date.now();
  log.step(NODE, `Reading ad creative from disk → ${state.adFilePath}`);

  const imageBuffer = await fs.readFile(state.adFilePath);
  const base64Image = imageBuffer.toString("base64");
  log.info(NODE, `File read: ${(imageBuffer.byteLength / 1024).toFixed(1)} KB, sending to LLM…`);

  let responseText = "";

  try {
    log.info(NODE, `Requesting LLM completion…`);
    responseText = await llmCall({
      system: SYSTEM_PROMPT,
      prompt: USER_PROMPT,
      images: [base64Image],
    
    });

    log.info(NODE, `LLM response received in ${elapsed(t)}`, {
      preview: responseText.slice(0, 120) + (responseText.length > 120 ? "…" : ""),
    });
  } catch (error) {
    log.warn(NODE, `LLM request failed — using empty intent: ${(error as Error).message}`);
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

    log.step(NODE, `Ad intent parsed (${elapsed(t)})`, {
      primary_goal: adJson.primary_goal,
      offer_type: adJson.offer_type,
      urgency_level: adJson.urgency_level,
      cta_style: adJson.cta_style,
      tone: adJson.tone,
      key_messages: adJson.key_messages,
    });

    return { adJson };
  } catch {
    log.warn(NODE, "JSON parse failed — using empty intent");
    return { adJson: { ...EMPTY_AD_JSON } };
  }
}
