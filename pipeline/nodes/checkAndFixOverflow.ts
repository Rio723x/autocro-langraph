/** Step 14 — Detect overflow on each injected zone. For any that overflow,
 * trim the text to a word boundary, re-inject, and re-check. */
import type { PipelineState, OverflowItem, Zone } from "../types";
import { getPage } from "../browserContext";

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function trimToWordBoundary(text: string | null | undefined, maxChars: number): string {
  if (!text || text.length <= maxChars) return text ?? "";
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace <= 0) return slice.trim();
  return slice.slice(0, lastSpace).trim();
}

async function checkOverflow(zones: Zone[]): Promise<OverflowItem[]> {
  const page = getPage();
  return page.evaluate(
    (zoneArgs: Array<{ zone: string; sel: string }>) =>
      zoneArgs.map((z) => {
        const el = document.querySelector(z.sel);
        if (!el) return { zone: z.zone, overflow: false };
        return {
          zone: z.zone,
          overflow: el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight,
        };
      }),
    zones.map((z) => ({ zone: z.zone, sel: z.selector }))
  );
}

export async function checkAndFixOverflow(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const { validatedZones, injectionSuccess } = state;

  if (!injectionSuccess) {
    const overflowCheck: OverflowItem[] = validatedZones.map((z) => ({
      zone: z.zone,
      overflow: false,
    }));
    return { overflowCheck, validatedZones };
  }

  // First pass — detect overflows.
  let overflowCheck = await checkOverflow(validatedZones);
  overflowCheck
    .filter((item) => item.overflow)
    .forEach((item) =>
      console.warn(`[overflow] ${item.zone} is overflowing its container`)
    );

  // Trim overflowing zones and re-inject them.
  const trimmedZones = validatedZones.map((zone) => {
    const overflow = overflowCheck.find((item) => item.zone === zone.zone)?.overflow;
    if (!overflow) return zone;
    return { ...zone, new_text: trimToWordBoundary(zone.new_text, zone.max_chars) };
  });

  const changedZones = trimmedZones.filter(
    (zone, idx) => zone.new_text !== validatedZones[idx].new_text
  );

  if (changedZones.length > 0) {
    const page = getPage();
    await page.evaluate(
      (zones: Array<{ sel: string; text: string }>) => {
        zones.forEach((z) => {
          try {
            const el = document.querySelector(z.sel);
            if (!el) return;
            (el as HTMLElement).innerText = z.text;
          } catch (e) {
            console.warn("[troopod] overflow reinjection failed:", z.sel, (e as Error).message);
          }
        });
      },
      changedZones.map((z) => ({ sel: z.selector, text: z.new_text ?? "" }))
    );

    await delay(600);

    // Second pass — verify fix.
    overflowCheck = await checkOverflow(trimmedZones);
  }

  return { overflowCheck, validatedZones: trimmedZones };
}
