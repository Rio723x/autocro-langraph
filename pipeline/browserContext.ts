/**
 * Puppeteer browser/page singleton for server-side use.
 *
 * Why a singleton? LangGraph state must be plain, serialisable data, but
 * Puppeteer Browser and Page are live objects. We store them here at the
 * module level (using globalThis to survive Next.js HMR in dev) and expose
 * open/getPage/close helpers that each node calls directly.
 *
 * Only one pipeline run at a time is supported. Concurrent requests would
 * need a pool — out of scope for now.
 */
import puppeteer, { type Browser, type Page } from "puppeteer-core";

import { VIEWPORT } from "./constants";
import { PipelineError } from "./errors";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Use globalThis so the singleton survives Next.js hot-module-reloading in dev.
const g = globalThis as typeof globalThis & {
  __autocro_browser?: Browser | null;
  __autocro_page?: Page | null;
};

export async function openBrowserContext(pageUrl: string): Promise<void> {
  // Close any stale session left over from a previous run / HMR cycle.
  await closeBrowserContext();

  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    throw new PipelineError("BROWSERBASE_API_KEY is not configured", 500);
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${apiKey}`,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.setUserAgent(USER_AGENT);
    await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    g.__autocro_browser = browser;
    g.__autocro_page = page;
  } catch {
    await browser.close();
    throw new PipelineError("page could not be loaded", 400);
  }
}

export function getBrowser(): Browser {
  if (!g.__autocro_browser) {
    throw new PipelineError("browser not open", 500);
  }
  return g.__autocro_browser;
}

export function getPage(): Page {
  if (!g.__autocro_page) {
    throw new PipelineError("browser page not open", 500);
  }
  return g.__autocro_page;
}

export async function closeBrowserContext(): Promise<void> {
  const browser = g.__autocro_browser;
  g.__autocro_browser = null;
  g.__autocro_page = null;

  if (browser) {
    try {
      await browser.close();
    } catch {
      // Ignore cleanup errors.
    }
  }
}
