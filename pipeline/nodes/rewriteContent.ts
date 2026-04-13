/** Step 8 — Rewrite zone text using Ollama (gemma4:latest). The prompt is
 * enriched with deterministic rules derived from the intent schema so the LLM
 * receives explicit instructions rather than having to infer them. */
import type { PipelineState, Zone, AdJson } from "../types";
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "../constants";

function sanitizeJson(rawText: string): string {
  return rawText.replace(/```json|```/g, "").trim();
}

function buildRules(adJson: AdJson): string {
  const rules: string[] = [];

  if (adJson.urgency_level === "high") {
    rules.push("- Use urgency-signalling language (e.g. 'now', 'today', 'limited time').");
  } else if (adJson.urgency_level === "medium") {
    rules.push("- Convey a mild sense of timeliness without being pushy.");
  }

  if (adJson.offer_type === "limited_spots") {
    rules.push("- Include scarcity language (e.g. 'limited spots', 'few remaining').");
  } else if (adJson.offer_type === "free_trial") {
    rules.push("- Highlight the risk-free / no-commitment angle.");
  } else if (adJson.offer_type === "discount") {
    rules.push("- Emphasise the saving or value angle.");
  }

  if (adJson.cta_style === "action") {
    rules.push("- Use imperative verbs for CTA copy: Get, Start, Book, Grab, Claim, etc.");
  } else if (adJson.cta_style === "aggressive") {
    rules.push("- Use bold, direct commands. No hedging.");
  } else if (adJson.cta_style === "curiosity") {
    rules.push("- Tease the outcome without fully revealing it.");
  }

  if (adJson.tone.includes("aspirational")) {
    rules.push("- Frame copy around outcomes and achievements, not features.");
  }
  if (adJson.tone.includes("emotional")) {
    rules.push("- Tap into feelings and desired identity, not just logic.");
  }
  if (adJson.tone.includes("trust")) {
    rules.push("- Reinforce reliability and safety; avoid hype.");
  }

  return rules.length > 0
    ? `INTENT RULES (apply these directly):\n${rules.join("\n")}`
    : "";
}

function buildPrompt(adJson: AdJson, zones: Zone[]): string {
  const adFacts = [
    `primary_goal: ${adJson.primary_goal}`,
    `offer_type: ${adJson.offer_type}`,
    `urgency_level: ${adJson.urgency_level}`,
    `cta_style: ${adJson.cta_style}`,
    `key_messages: ${JSON.stringify(adJson.key_messages)}`,
    `keywords: ${JSON.stringify(adJson.keywords)}`,
    `target_audience: ${adJson.target_audience}`,
  ].join("\n");

  const zoneInstructions = zones
    .map(
      (z) =>
        `  ${z.zone} (max ${z.max_chars} characters):\n    current: "${z.current_text}"`
    )
    .join("\n\n");

  const rules = buildRules(adJson);

  return `AD INTENT — use only these facts:
${adFacts}

${rules ? rules + "\n\n" : ""}ZONES TO REWRITE — create message-match copy for each:
${zoneInstructions}

RULES:
- Respect maximum character limits strictly
- Do not use any numbers or statistics not present in the ad facts
- No HTML, no CSS selectors, no JavaScript, no code
- No markdown, no explanation, no extra fields
- Return ONLY valid JSON in this exact shape:
{
  "zones": {
    "headline": "...",
    "subheadline": "...",
    "cta": "...",
    "badge": "..."
  }
}
Omit zone keys that are not present in the ZONES list above.`.trim();
}

export async function rewriteContent(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const { zones, adJson } = state;

  if (!adJson) {
    console.warn("[rewriteContent] adJson missing, returning zones unchanged");
    return { rewrittenZones: zones.map((z) => ({ ...z, new_text: null })) };
  }

  let responseText = "";

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: `You are a CRO copywriter. You rewrite landing page text to match ad creatives.
Return only valid JSON. Never invent facts. Never produce HTML, selectors, or code. Only text strings.`,
        prompt: buildPrompt(adJson, zones),
        stream: false,
        options: { temperature: 0.2, top_p: 0.9 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama responded with ${res.status}`);
    }

    const data = (await res.json()) as { response?: string };
    responseText = String(data.response ?? "").trim();
  } catch (error) {
    console.warn("[rewriteContent] Ollama request failed:", (error as Error).message);
    return { rewrittenZones: zones.map((z) => ({ ...z, new_text: null })) };
  }

  let zoneMap: Record<string, string> = {};

  try {
    const parsed = JSON.parse(sanitizeJson(responseText)) as {
      zones?: Record<string, string>;
    };
    zoneMap =
      parsed.zones && typeof parsed.zones === "object" ? parsed.zones : {};
  } catch {
    console.warn("[rewriteContent] JSON parse failed, returning zones unchanged");
  }

  const rewrittenZones = zones.map((z) => ({
    ...z,
    new_text: zoneMap[z.zone] ?? null,
  }));

  return { rewrittenZones };
}
