/** Step 13 — Execute the injection script in the live Puppeteer page context.
 * Wrapped in try/catch — a CSP violation or syntax error sets success: false
 * without crashing the pipeline. */
import type { PipelineState } from "../types";
import { getPage } from "../browserContext";

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function injectAndStabilise(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const page = getPage();

  let injectionSuccess = false;

  try {
    // page.evaluate() runs the script string directly in the browser context.
    await page.evaluate(state.injectionScript);
    injectionSuccess = true;
  } catch (error) {
    console.warn(
      "[inject] page.evaluate failed:",
      (error as Error).message
    );
    injectionSuccess = false;
  }

  if (injectionSuccess) {
    // Allow layout reflows to settle before measurements.
    await delay(600);
  }

  return { injectionSuccess };
}
