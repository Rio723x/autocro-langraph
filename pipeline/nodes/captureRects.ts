/** Step 15 — Capture bounding rect for each validated zone's selector.
 * Used by the UI to draw change-floater overlays on the after screenshot. */
import type { PipelineState, BoundingRect } from "../types";
import { getPage } from "../browserContext";

export async function captureRects(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const page = getPage();

  const boundingRects: BoundingRect[] = await page.evaluate(
    (zones: Array<{ zone: string; sel: string }>) =>
      zones.map((z) => {
        const el = document.querySelector(z.sel);
        if (!el) return { zone: z.zone, rect: null };
        const r = el.getBoundingClientRect();
        return {
          zone: z.zone,
          rect: { x: r.left, y: r.top, width: r.width, height: r.height },
        };
      }),
    state.validatedZones.map((z) => ({ zone: z.zone, sel: z.selector }))
  );

  return { boundingRects };
}
