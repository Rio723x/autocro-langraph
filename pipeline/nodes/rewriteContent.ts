/** Step 8 — Rewrite zone text using Ollama (gemma4:latest). The prompt is
 * enriched with deterministic rules derived from the intent schema so the LLM
 * receives explicit instructions rather than having to infer them. */
import type { PipelineState, Zone, AdJson } from "../types";
import { llmCall } from "../llm";
import { log, elapsed } from "../logger";

const NODE = "rewriteContent";

function sanitizeJson(rawText: string): string {
  // Sometimes models still return markdown blocks even with format specified.
  return rawText.replace(/```json|```/g, "").trim();
}

function buildRules(adJson: AdJson): string {
  const rules: string[] = [];

  if (adJson.urgency_level === "high") {
    rules.push("- Infuse high urgency: Use words like 'now', 'today', 'instantly', or 'limited time' to drive immediate action.");
  } else if (adJson.urgency_level === "medium") {
    rules.push("- Create a subtle sense of timeliness without being overly aggressive.");
  }

  if (adJson.offer_type === "limited_spots") {
    rules.push("- Emphasize scarcity: Make the user feel exclusive but rushed (e.g., 'limited spots', 'few remaining').");
  } else if (adJson.offer_type === "free_trial") {
    rules.push("- De-risk the decision: Highlight that the offer is risk-free, complimentary, or requires no commitment.");
  } else if (adJson.offer_type === "discount") {
    rules.push("- Focus on value: Make the financial savings or bonus feel like a steal.");
  }

  if (adJson.cta_style === "action") {
    rules.push("- Drive action: Use strong, imperative verbs for CTA areas (e.g., Get, Start, Book, Grab, Claim).");
  } else if (adJson.cta_style === "aggressive") {
    rules.push("- Be extremely direct: Tell the user exactly what to do next with absolute confidence. No hesitation.");
  } else if (adJson.cta_style === "curiosity") {
    rules.push("- Spark curiosity: Tease the value or outcome without giving everything away to entice the click.");
  }

  if (adJson.tone.includes("aspirational")) {
    rules.push("- Elevate the pitch: Frame the copy around desired outcomes, identity, and prestige rather than just features.");
  }
  if (adJson.tone.includes("emotional")) {
    rules.push("- Evoke feeling: Connect with the user's pain points, desires, and emotions over pure logic.");
  }
  if (adJson.tone.includes("trust")) {
    rules.push("- Build confidence: Rely on credibility, reliability, and safety. Avoid hype or over-promising.");
  }

  return rules.length > 0
    ? `STRATEGIC COPYWRITING RULES for this campaign:\n${rules.join("\n")}`
    : "";
}

function buildPrompt(adJson: AdJson, zones: Zone[]): string {
  const adFacts = [
    `Primary Goal: ${adJson.primary_goal}`,
    `Offer Type: ${adJson.offer_type}`,
    `Urgency Level: ${adJson.urgency_level}`,
    `CTA Style: ${adJson.cta_style}`,
    `Key Messages: ${adJson.key_messages.join(" | ")}`,
    `Keywords: ${adJson.keywords.join(", ")}`,
    `Target Audience: ${adJson.target_audience}`,
  ].join("\n");

  const zoneInstructions = zones
    .map(
      (z) =>
        `  - Zone: "${z.zone}"
    Max Characters: ${z.max_chars}
    Original Text: "${z.current_text}"`
    )
    .join("\n\n");

  const rules = buildRules(adJson);

  return `AD CAMPAIGN CONTEXT:
${adFacts}

${rules ? rules + "\n\n" : ""}ZONES TO REWRITE:
Please rewrite the following zones to match the ad campaign's intent, maintaining length constraints but dramatically improving the persuasive angle.

${zoneInstructions}

REWRITING INSTRUCTIONS:
1. Context is Key: Understand what a "headline" vs "subheadline" vs "cta" implies. A headline should be catchy and value-driven; a CTA should be action-oriented.
2. Be Persuasive, Not Robotic: Do not just blindly copy the ad facts. Weave the ad's main angle, tone, and offer into high-converting, natural-sounding, human-centric copy.
3. Message Match: The transition from the ad to the landing page must feel continuous and natural.
4. Constraints: Respect maximum character limits strictly. Do not use any numbers or statistics not present in the ad facts. Provide plain text strings only without markdown or HTML.
`.trim();
}

export async function rewriteContent(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const { zones, adJson } = state;
  const t = Date.now();

  log.step(NODE, `Rewriting ${zones.length} zone(s)`, {
    zones: zones.map((z) => z.zone),
  });

  if (!adJson) {
    log.warn(NODE, "adJson missing — returning zones unchanged");
    return { rewrittenZones: zones.map((z) => ({ ...z, new_text: null })) };
  }

  const prompt = buildPrompt(adJson, zones);
  log.info(NODE, `Built prompt (${prompt.length} chars) — sending to LLM…`);

  const zoneProperties: Record<string, { type: "string" }> = {};
  zones.forEach(z => {
    zoneProperties[z.zone] = { type: "string" };
  });

  const formatSchema = {
    type: "object",
    properties: {
      rationale: { type: "string" },
      zones: {
        type: "object",
        properties: zoneProperties,
        required: zones.map(z => z.zone)
      }
    },
    required: ["rationale", "zones"]
  };

  let responseText = "";

  try {
    log.info(NODE, `Requesting LLM completion…`);
    responseText = await llmCall({
      system: `You are a world-class Conversion Rate Optimization (CRO) copywriter. \nYour task is to rewrite specific text zones on a landing page so they seamlessly align with the user intent driven by an incoming ad campaign. \nReturn ONLY valid JSON according to the requested schema. Provide a rationale string explaining your strategy, then the rewritten text for each zone.`,
      prompt,
      format: formatSchema,
      options: { temperature: 0.6, top_p: 0.9 },
    });

    log.info(NODE, `LLM response received in ${elapsed(t)}`, {
      preview: responseText.slice(0, 200) + (responseText.length > 200 ? "…" : ""),
    });
  } catch (error) {
    log.warn(NODE, `LLM request failed — returning zones unchanged: ${(error as Error).message}`);
    return { rewrittenZones: zones.map((z) => ({ ...z, new_text: null })) };
  }

  let zoneMap: Record<string, string> = {};
  let rationale = "";

  try {
    const parsed = JSON.parse(sanitizeJson(responseText)) as {
      rationale?: string;
      zones?: Record<string, string>;
    };
    zoneMap =
      parsed.zones && typeof parsed.zones === "object" ? parsed.zones : {};
    rationale = parsed.rationale ?? "";

    if (rationale) {
      log.info(NODE, `Copywriter rationale: ${rationale}`);
    }
  } catch {
    log.warn(NODE, "JSON parse failed — returning zones unchanged");
  }

  const rewrittenZones = zones.map((z) => ({
    ...z,
    new_text: zoneMap[z.zone] ?? null,
  }));

  log.step(NODE, `Rewrites applied (${elapsed(t)})`, {
    results: rewrittenZones.map((z) => ({
      zone: z.zone,
      before: z.current_text.slice(0, 50),
      after: z.new_text ? z.new_text.slice(0, 50) : "(null — fallback)",
    })),
  });

  return { rewrittenZones };
}
