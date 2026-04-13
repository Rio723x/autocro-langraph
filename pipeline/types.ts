// ─── Domain types ────────────────────────────────────────────────────────────

export interface Zone {
  zone: string;
  selector: string;
  current_text: string;
  max_chars: number;
  new_text?: string | null;
  fail?: string;
}

/** Intent schema extracted from the ad creative (Step 7). */
export interface AdJson {
  target_audience: string;
  primary_goal: string;
  offer_type: string;
  urgency_level: string;
  tone: string[];
  cta_style: string;
  key_messages: string[];
  keywords: string[];
}

export interface StyleProfile {
  fontFamily: string;
  textColor: string;
  surfaceColor: string;
  accentColor: string;
  accentTextColor: string;
  accentSoftColor: string;
  accentBorderColor: string;
  borderRadius: string;
  cardRadius: string;
  shadow: string;
  softShadow: string;
}

export interface BannerData {
  text: string;
  backgroundColor: string;
  textColor: string;
}

export interface Tile {
  src: string;
  top: number;
  width: number;
  height: number;
}

export interface OverflowItem {
  zone: string;
  overflow: boolean;
}

export interface BoundingRect {
  zone: string;
  rect: { x: number; y: number; width: number; height: number } | null;
}

// ─── API response types (consumed by the frontend) ───────────────────────────

export interface AdIntent {
  offer_type: string;
  urgency_level: string;
  cta_style: string;
  key_messages: string[];
}

export interface Change {
  zone: string;
  selector: string;
  original: string;
  new: string | null;
  changed: boolean;
  overflow: boolean;
  rect: { x: number; y: number; width: number; height: number } | null;
}

export interface FinalResponse {
  success: boolean;
  images: { before: string; after: string };
  ad_intent: AdIntent;
  changes: Change[];
  full_page: { before: Tile[]; after: Tile[] };
  banner: BannerData | null;
  meta: {
    page_url: string;
    zones_found: number;
    zones_changed: number;
    viewport_width: number;
  };
}

// ─── LangGraph state ──────────────────────────────────────────────────────────

export interface PipelineState {
  // ── Inputs (set by API route before graph invocation) ──
  pageUrl: string;
  adFilePath: string;

  // ── Browser pipeline (Steps 4–6) ──
  zones: Zone[];
  styleProfile: StyleProfile | null;
  beforePath: string;
  beforeTiles: Tile[];

  // ── Ad extraction (Step 7, runs in parallel with above) ──
  adJson: AdJson | null;

  // ── Rewrite (Step 8) ──
  rewrittenZones: Zone[];

  // ── Validate (Step 9) ──
  validatedZones: Zone[];

  // ── Build + inject (Steps 11–13) ──
  banner: BannerData | null;
  injectionScript: string;
  injectionSuccess: boolean;

  // ── Post-injection (Steps 14–16) ──
  overflowCheck: OverflowItem[];
  boundingRects: BoundingRect[];
  afterPath: string;
  afterTiles: Tile[];

  // ── Final (Step 17) ──
  finalResponse: FinalResponse | null;
}
