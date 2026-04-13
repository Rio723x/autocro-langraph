/** Steps 2–3 — Launch headless browser, navigate to pageUrl, and prepare the
 * page by forcing lazy elements to load and disabling all animations. */
import type { PipelineState } from "../types";
import { openBrowserContext, getPage } from "../browserContext";

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function openBrowser(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  // Step 2 — Open browser and navigate.
  await openBrowserContext(state.pageUrl);
  const page = getPage();

  // Step 3 — Prepare page: scroll to trigger lazily-loaded elements, then
  // scroll back to top and inject a style tag that kills all animations.
  await page.evaluate(() => {
    window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.5));
  });
  await delay(400);

  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });

  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        animation-duration: 0s !important;
      }
    `,
  });

  await delay(600);

  return {};
}
