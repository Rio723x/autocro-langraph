/** Step 6 — Capture a viewport "hero" screenshot and a set of full-page tiles
 * (scrolling captures) of the page in its pre-injection state. */
import type { PipelineState, Tile } from "../types";
import { getPage } from "../browserContext";
import { getOutputDir } from "../fsPaths";
import { VIEWPORT } from "../constants";

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function captureFullPageTiles(
  prefix: "before" | "after"
): Promise<{ tiles: Tile[]; totalHeight: number }> {
  const page = getPage();
  const outputDir = getOutputDir();

  const { height: totalHeight } = await page.evaluate(() => ({
    height: Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    ),
  }));

  const tiles: Tile[] = [];
  const tileCount = Math.max(1, Math.ceil(totalHeight / VIEWPORT.height));

  for (let index = 0; index < tileCount; index++) {
    const top = index * VIEWPORT.height;
    const clipHeight = Math.min(VIEWPORT.height, totalHeight - top);

    await page.evaluate((y: number) => window.scrollTo(0, y), top);
    await delay(180);

    const filename = `${prefix}-tile-${index}.png`;

    await page.screenshot({
      path: `${outputDir}/${filename}`,
      fullPage: false,
      type: "png",
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: clipHeight },
    });

    tiles.push({
      src: `/output/${filename}`,
      top,
      width: VIEWPORT.width,
      height: clipHeight,
    });
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(120);

  return { tiles, totalHeight };
}

export async function takeBeforeScreenshots(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  void state;
  const page = getPage();
  const outputDir = getOutputDir();
  const beforePath = `${outputDir}/before.png`;

  await page.screenshot({
    path: beforePath,
    fullPage: false,
    type: "png",
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  });

  const { tiles } = await captureFullPageTiles("before");

  return { beforePath, beforeTiles: tiles };
}

// Export the tile helper so the after-screenshots node can reuse it.
export { captureFullPageTiles };
