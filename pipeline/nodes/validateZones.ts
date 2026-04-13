/** Step 9 — Three sequential checks per zone. Failures silently revert
 * new_text to current_text. Zones whose CSS selector no longer exists in the
 * live DOM are dropped entirely. */
import type { PipelineState, Zone, AdJson } from "../types";
import { getPage } from "../browserContext";

// ─── Check 1: length ─────────────────────────────────────────────────────────

function checkLength(zone: Zone): Zone {
  if (!zone.new_text) {
    return { ...zone, new_text: zone.current_text, fail: "null_output" };
  }
  if (zone.new_text.length > zone.max_chars) {
    console.warn(
      `[validate] ${zone.zone} too long (${zone.new_text.length} > ${zone.max_chars}), fallback`
    );
    return { ...zone, new_text: zone.current_text, fail: "length" };
  }
  return zone;
}

// ─── Check 2: fact anchor (no invented numbers) ───────────────────────────────

function extractNumbers(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  const matches = text.match(/\d+(\.\d+)?%?/g) ?? [];
  return new Set(matches.map((m) => m.replace("%", "")));
}

function checkFactAnchor(zone: Zone, adJson: AdJson): Zone {
  const adText = [
    ...adJson.key_messages,
    ...adJson.keywords,
    adJson.target_audience,
  ].join(" ");
  const adNums = extractNumbers(adText);
  const outNums = extractNumbers(zone.new_text);
  const invented = [...outNums].filter((n) => !adNums.has(n));

  if (invented.length > 0) {
    console.warn(
      `[validate] ${zone.zone} invented facts: ${invented.join(", ")}, fallback`
    );
    return { ...zone, new_text: zone.current_text, fail: "invented_fact" };
  }

  return zone;
}

// ─── Check 3: selector existence in live DOM ─────────────────────────────────

async function checkSelector(zone: Zone): Promise<Zone | null> {
  const page = getPage();
  const exists = await page.$(zone.selector);
  if (!exists) {
    console.warn(
      `[validate] ${zone.zone} selector not found (${zone.selector}), zone dropped`
    );
    return null;
  }
  return zone;
}

// ─── Node ────────────────────────────────────────────────────────────────────

export async function validateZones(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const { rewrittenZones, adJson } = state;

  if (!adJson) {
    return { validatedZones: [] };
  }

  const validated: Zone[] = [];

  for (let zone of rewrittenZones) {
    zone = checkLength(zone);
    if (!zone.fail) zone = checkFactAnchor(zone, adJson);

    const verified = await checkSelector(zone);
    if (verified === null) continue;

    validated.push(verified);
  }

  return { validatedZones: validated };
}
