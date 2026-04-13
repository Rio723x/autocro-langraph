/** Step 17 — Assemble all collected state into the final API response payload. */
import type { PipelineState, FinalResponse, Change } from "../types";
import { OUTPUT_IMAGE_ROUTES, VIEWPORT } from "../constants";

export async function buildFinalResponse(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const {
    validatedZones,
    adJson,
    pageUrl,
    overflowCheck,
    injectionSuccess,
    boundingRects,
    beforeTiles,
    afterTiles,
    banner,
  } = state;

  const changes: Change[] = validatedZones.map((zone) => ({
    zone: zone.zone,
    selector: zone.selector,
    original: zone.current_text,
    new: zone.new_text ?? null,
    changed: zone.new_text !== zone.current_text,
    overflow: overflowCheck?.find((item) => item.zone === zone.zone)?.overflow ?? false,
    rect: boundingRects?.find((item) => item.zone === zone.zone)?.rect ?? null,
  }));

  const finalResponse: FinalResponse = {
    success: injectionSuccess,
    images: {
      before: OUTPUT_IMAGE_ROUTES.before,
      after: injectionSuccess ? OUTPUT_IMAGE_ROUTES.after : OUTPUT_IMAGE_ROUTES.before,
    },
    ad_intent: {
      offer_type: adJson?.offer_type ?? "none",
      urgency_level: adJson?.urgency_level ?? "none",
      cta_style: adJson?.cta_style ?? "soft",
      key_messages: adJson?.key_messages ?? [],
    },
    changes,
    full_page: {
      before: beforeTiles ?? [],
      after: injectionSuccess ? (afterTiles ?? []) : (beforeTiles ?? []),
    },
    banner: banner ?? null,
    meta: {
      page_url: pageUrl,
      zones_found: validatedZones.length,
      zones_changed: changes.filter((c) => c.changed).length,
      viewport_width: VIEWPORT.width,
    },
  };

  return { finalResponse };
}
