import fs from "node:fs/promises";
import path from "node:path";

/**
 * Screenshots and ad images are written to `public/output/` so Next.js serves
 * them statically at `/output/<filename>` without any custom server setup.
 */
const OUTPUT_DIR = path.join(process.cwd(), "public", "output");

export function getOutputDir(): string {
  return OUTPUT_DIR;
}

export function getOutputPath(filename: string): string {
  return path.join(OUTPUT_DIR, filename);
}

export async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}
