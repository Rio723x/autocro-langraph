/** Step 4 — Extract personalisation zones from the live DOM using heuristic
 * CSS queries. The LLM-based zone selection described in the walkthrough is
 * intentionally deferred to the rewrite step — the extracted candidates are
 * passed directly as structured JSON (no HTML). */
import type { PipelineState, Zone } from "../types";
import { getPage } from "../browserContext";

export async function extractZones(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  void state;
  const page = getPage();

  const zones: Zone[] = await page.evaluate(() => {
    const ZONE_QUERIES: Record<string, string[]> = {
      headline: [
        "h1",
        '[class*="hero"] h1',
        '[class*="header"] h1',
        "header h1",
        '[class*="title"]:not(title)',
      ],
      subheadline: [
        '[class*="hero"] p',
        '[class*="hero"] h2',
        '[class*="subtitle"]',
        '[class*="sub-headline"]',
        ".hero-sub",
        "h2",
      ],
      cta: ["a", "button", '[class*="cta-button"]'],
      badge: [
        '[class*="trust"]',
        '[class*="badge"]',
        '[class*="social-proof"]',
        '[class*="guarantee"]',
        '[class*="secure"]',
      ],
    };

    function escapeCssIdentifier(value: string): string {
      if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
      }
      return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
    }

    function getSelector(el: Element): string {
      if (el.id) return `#${escapeCssIdentifier(el.id)}`;

      const parts: string[] = [];
      let node: Element | null = el;

      while (node && node !== document.body) {
        let selector = node.tagName.toLowerCase();

        if (node.classList.length > 0) {
          const stableClasses = Array.from(node.classList)
            .filter(
              (cls) =>
                !["active", "open", "hover", "focus", "visible", "hidden", "show"].includes(cls)
            )
            .slice(0, 2);

          if (stableClasses.length > 0) {
            selector += `.${stableClasses
              .map((cls) => escapeCssIdentifier(cls))
              .join(".")}`;
          }
        }

        parts.unshift(selector);
        node = node.parentElement;
      }

      return parts.join(" > ");
    }

    const result: Array<{
      zone: string;
      selector: string;
      current_text: string;
      max_chars: number;
    }> = [];

    for (const [zoneName, queries] of Object.entries(ZONE_QUERIES)) {
      for (const query of queries) {
        try {
          const el = document.querySelector(query);
          if (!el || (el as HTMLElement).innerText.trim().length < 3) continue;

          const currentText = (el as HTMLElement).innerText.trim();
          result.push({
            zone: zoneName,
            selector: getSelector(el),
            current_text: currentText,
            max_chars: Math.ceil(currentText.length * 1.4),
          });
          break;
        } catch {
          continue;
        }
      }
    }

    return result;
  });

  return { zones };
}
