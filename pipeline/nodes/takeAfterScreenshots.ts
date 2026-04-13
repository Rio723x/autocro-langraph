/** Step 16 — Capture hero viewport screenshot and full-page tiles of the page
 * after injection. Then close the Puppeteer page. */
import type { PipelineState } from "../types";
import { getPage } from "../browserContext";
import { getOutputDir } from "../fsPaths";
import { VIEWPORT } from "../constants";
import { captureFullPageTiles } from "./takeBeforeScreenshots";

export async function takeAfterScreenshots(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const { injectionSuccess, beforeTiles } = state;

  // If injection failed there is nothing meaningful to capture. Reuse the
  // before tiles so the UI still has something to render.
  if (!injectionSuccess) {
    return {
      afterPath: "",
      afterTiles: beforeTiles,
    };
  }

  const page = getPage();
  const outputDir = getOutputDir();
  const afterPath = `${outputDir}/after.png`;

  const { tiles: afterTiles } = await captureFullPageTiles("after");

  await page.screenshot({
    path: afterPath,
    fullPage: false,
    type: "png",
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  });

  // Page is done — explicit close keeps memory tidy. The browser is closed
  // by graph.ts in its finally block.
  try {
    await page.close();
  } catch {
    // Ignore close errors.
  }

  return { afterPath, afterTiles };
}
