/**
 * POST /api/personalise
 *
 * Accepts multipart/form-data with:
 *   - pageUrl  (string)  — the landing page to personalise
 *   - adFile   (File)    — uploaded ad creative image
 *   OR
 *   - adUrl    (string)  — URL of an ad image to download
 *
 * Resolves and saves the ad file, then hands control to the LangGraph pipeline.
 */
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import { PipelineError } from "@/pipeline/errors";
import { ensureOutputDir, getOutputPath } from "@/pipeline/fsPaths";
import { runGraph } from "@/pipeline/graph";

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif"]);

function extensionFromMime(type: string): string | null {
  switch (type) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    default:
      return null;
  }
}

function extensionFromUrl(url: string): string {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext) ? ext : ".png";
  } catch {
    return ".png";
  }
}

async function resolveAdFile(formData: FormData): Promise<string> {
  await ensureOutputDir();

  const adFile = formData.get("adFile");
  const adUrl = String(formData.get("adUrl") ?? "").trim();
  console.log("[/api/personalise] Checking ad creative. Has adFile:", !!adFile, "| adUrl:", adUrl);

  // ── Uploaded file ──────────────────────────────────────────────────────────
  if (adFile && typeof adFile === "object" && "arrayBuffer" in adFile) {
    const file = adFile as File;
    if (file.size === 0) {
      throw new PipelineError("uploaded ad file is empty", 400);
    }

    const ext =
      extensionFromMime(file.type) ||
      path.extname(file.name || "").toLowerCase() ||
      ".png";

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new PipelineError("ad creative must be a JPG, PNG, or GIF", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const outputPath = getOutputPath(`ad_input${ext}`);
    await fs.writeFile(outputPath, buffer);
    console.log("[/api/personalise] Saved uploaded ad file to:", outputPath);
    return outputPath;
  }

  // ── Remote URL ─────────────────────────────────────────────────────────────
  if (adUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(adUrl);
    } catch {
      throw new PipelineError("adUrl must be a valid URL", 400);
    }

    const res = await fetch(parsedUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new PipelineError("ad creative could not be downloaded", 400);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("image/svg+xml")) {
      throw new PipelineError(
        "ad creative URL must point to a JPG, PNG, or GIF",
        400
      );
    }

    const ext =
      extensionFromMime(contentType) || extensionFromUrl(adUrl);

    const buffer = Buffer.from(await res.arrayBuffer());
    const outputPath = getOutputPath(`ad_input${ext}`);
    await fs.writeFile(outputPath, buffer);
    console.log("[/api/personalise] Downloaded ad URL to:", outputPath);
    return outputPath;
  }

  throw new PipelineError("either adFile or adUrl is required", 400);
}

export async function POST(req: Request): Promise<NextResponse> {
  console.log("[/api/personalise] Received new personalisation request");
  let formData: FormData;

  try {
    formData = await req.formData();
    console.log("[/api/personalise] Successfully parsed form data");
  } catch (err) {
    console.error("[/api/personalise] Form data parsing error:", err);
    return NextResponse.json(
      { error: "Could not parse multipart form data" },
      { status: 400 }
    );
  }

  const rawPageUrl = String(formData.get("pageUrl") ?? "").trim();
  if (!rawPageUrl) {
    return NextResponse.json(
      { error: "pageUrl is required" },
      { status: 400 }
    );
  }

  let pageUrl: string;
  try {
    const parsed = new URL(rawPageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("unsupported protocol");
    }
    pageUrl = parsed.toString();
    console.log("[/api/personalise] Validated target pageUrl:", pageUrl);
  } catch {
    console.warn("[/api/personalise] Invalid pageUrl received:", rawPageUrl);
    return NextResponse.json(
      { error: "pageUrl must be a valid http or https URL" },
      { status: 400 }
    );
  }

  let adFilePath: string;
  try {
    adFilePath = await resolveAdFile(formData);
    console.log("[/api/personalise] Final ad file path resolved:", adFilePath);
  } catch (err) {
    console.error("[/api/personalise] Failed to process ad creative error:", err);
    if (err instanceof PipelineError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Failed to process ad creative" }, { status: 500 });
  }

  try {
    console.log("[/api/personalise] Starting graph execution...");
    const result = await runGraph(pageUrl, adFilePath);
    console.log("[/api/personalise] Graph execution completed successfully");
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/personalise] Pipeline error:", err);

    if (err instanceof PipelineError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }

    return NextResponse.json(
      { error: (err as Error).message ?? "Internal pipeline error" },
      { status: 500 }
    );
  }
}
