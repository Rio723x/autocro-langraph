/**
 * LangGraph StateGraph — AutoCRO personalisation pipeline.
 *
 * Execution topology (parallel fan-out after openBrowser):
 *
 *   START
 *     └─ resolveInputs
 *          ├─ openBrowser ─► extractZones ─► extractStyleProfile ─► takeBeforeScreenshots ─┐
 *          └─ extractAd ────────────────────────────────────────────────────────────────────┘
 *                                                                                    rewriteContent
 *                                                                                         │
 *                                                                                    validateZones
 *                                                                                         │
 *                                                                                 buildBannerAndScript
 *                                                                                         │
 *                                                                                  injectAndStabilise
 *                                                                                         │
 *                                                                                 checkAndFixOverflow
 *                                                                                         │
 *                                                                                    captureRects
 *                                                                                         │
 *                                                                                takeAfterScreenshots
 *                                                                                         │
 *                                                                                 buildFinalResponse
 *                                                                                         │
 *                                                                                        END
 *
 * The `rewriteContent` node has two incoming edges (from takeBeforeScreenshots
 * and from extractAd). LangGraph only executes it once BOTH predecessors have
 * written their state — this is the fan-in join point.
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type {
  PipelineState,
  Zone,
  StyleProfile,
  Tile,
  AdJson,
  BannerData,
  OverflowItem,
  BoundingRect,
  FinalResponse,
} from "./types";
import { closeBrowserContext } from "./browserContext";

// ─── Node imports ─────────────────────────────────────────────────────────────
import { resolveInputs } from "./nodes/resolveInputs";
import { openBrowser } from "./nodes/openBrowser";
import { extractZones } from "./nodes/extractZones";
import { extractStyleProfile } from "./nodes/extractStyleProfile";
import { takeBeforeScreenshots } from "./nodes/takeBeforeScreenshots";
import { extractAd } from "./nodes/extractAd";
import { rewriteContent } from "./nodes/rewriteContent";
import { validateZones } from "./nodes/validateZones";
import { buildBannerAndScript } from "./nodes/buildBannerAndScript";
import { injectAndStabilise } from "./nodes/injectAndStabilise";
import { checkAndFixOverflow } from "./nodes/checkAndFixOverflow";
import { captureRects } from "./nodes/captureRects";
import { takeAfterScreenshots } from "./nodes/takeAfterScreenshots";
import { buildFinalResponse } from "./nodes/buildFinalResponse";

// ─── State annotation ─────────────────────────────────────────────────────────
// "Last write wins" reducer for all fields — each node writes to distinct keys,
// so there are no conflicts even during parallel execution.

const PipelineStateAnnotation = Annotation.Root({
  pageUrl: Annotation<string>({ reducer: (_, b: string) => b, default: () => "" }),
  adFilePath: Annotation<string>({ reducer: (_, b: string) => b, default: () => "" }),
  zones: Annotation<Zone[]>({ reducer: (_, b: Zone[]) => b, default: () => [] }),
  styleProfile: Annotation<StyleProfile | null>({
    reducer: (_, b: StyleProfile | null) => b,
    default: () => null,
  }),
  beforePath: Annotation<string>({ reducer: (_, b: string) => b, default: () => "" }),
  beforeTiles: Annotation<Tile[]>({ reducer: (_, b: Tile[]) => b, default: () => [] }),
  adJson: Annotation<AdJson | null>({
    reducer: (_, b: AdJson | null) => b,
    default: () => null,
  }),
  rewrittenZones: Annotation<Zone[]>({ reducer: (_, b: Zone[]) => b, default: () => [] }),
  validatedZones: Annotation<Zone[]>({ reducer: (_, b: Zone[]) => b, default: () => [] }),
  banner: Annotation<BannerData | null>({
    reducer: (_, b: BannerData | null) => b,
    default: () => null,
  }),
  injectionScript: Annotation<string>({ reducer: (_, b: string) => b, default: () => "" }),
  injectionSuccess: Annotation<boolean>({
    reducer: (_, b: boolean) => b,
    default: () => false,
  }),
  overflowCheck: Annotation<OverflowItem[]>({
    reducer: (_, b: OverflowItem[]) => b,
    default: () => [],
  }),
  boundingRects: Annotation<BoundingRect[]>({
    reducer: (_, b: BoundingRect[]) => b,
    default: () => [],
  }),
  afterPath: Annotation<string>({ reducer: (_, b: string) => b, default: () => "" }),
  afterTiles: Annotation<Tile[]>({ reducer: (_, b: Tile[]) => b, default: () => [] }),
  finalResponse: Annotation<FinalResponse | null>({
    reducer: (_, b: FinalResponse | null) => b,
    default: () => null,
  }),
});

// ─── Graph definition ─────────────────────────────────────────────────────────

const workflow = new StateGraph(PipelineStateAnnotation)
  // Nodes
  .addNode("resolveInputs", resolveInputs)
  .addNode("openBrowser", openBrowser)
  .addNode("extractZones", extractZones)
  .addNode("extractStyleProfile", extractStyleProfile)
  .addNode("takeBeforeScreenshots", takeBeforeScreenshots)
  .addNode("extractAd", extractAd)
  .addNode("rewriteContent", rewriteContent)
  .addNode("validateZones", validateZones)
  .addNode("buildBannerAndScript", buildBannerAndScript)
  .addNode("injectAndStabilise", injectAndStabilise)
  .addNode("checkAndFixOverflow", checkAndFixOverflow)
  .addNode("captureRects", captureRects)
  .addNode("takeAfterScreenshots", takeAfterScreenshots)
  .addNode("buildFinalResponse", buildFinalResponse)

  // ── Entry ──────────────────────────────────────────────────────────────────
  .addEdge(START, "resolveInputs")

  // ── Fan-out after resolveInputs: browser pipeline AND ad extraction ────────
  .addEdge("resolveInputs", "openBrowser")
  .addEdge("resolveInputs", "extractAd")   // parallel branch

  // ── Browser sequential chain ───────────────────────────────────────────────
  .addEdge("openBrowser", "extractZones")
  .addEdge("extractZones", "extractStyleProfile")
  .addEdge("extractStyleProfile", "takeBeforeScreenshots")

  // ── Fan-in: both branches must complete before rewriteContent runs ─────────
  .addEdge("takeBeforeScreenshots", "rewriteContent")
  .addEdge("extractAd", "rewriteContent")  // join edge

  // ── Sequential tail ────────────────────────────────────────────────────────
  .addEdge("rewriteContent", "validateZones")
  .addEdge("validateZones", "buildBannerAndScript")
  .addEdge("buildBannerAndScript", "injectAndStabilise")
  .addEdge("injectAndStabilise", "checkAndFixOverflow")
  .addEdge("checkAndFixOverflow", "captureRects")
  .addEdge("captureRects", "takeAfterScreenshots")
  .addEdge("takeAfterScreenshots", "buildFinalResponse")
  .addEdge("buildFinalResponse", END);

const app = workflow.compile();

// ─── Public entry point ───────────────────────────────────────────────────────

export async function runGraph(
  pageUrl: string,
  adFilePath: string
): Promise<FinalResponse> {
  const initialState: Partial<PipelineState> = { pageUrl, adFilePath };

  try {
    const result = await app.invoke(initialState as PipelineState);
    const response = result.finalResponse as FinalResponse | null;

    if (!response) {
      throw new Error("Pipeline completed without producing a final response");
    }

    return response;
  } finally {
    // Always close the browser, even if a node threw.
    await closeBrowserContext();
  }
}
