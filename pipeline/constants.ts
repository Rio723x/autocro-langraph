import type { AdJson } from "./types";

export const VIEWPORT = {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
} as const;

export const OUTPUT_IMAGE_ROUTES = {
  before: "/output/before.png",
  after: "/output/after.png",
} as const;

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_MODEL = "google/gemma-4-26b-a4b-it:free";

export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
export const OLLAMA_MODEL = "gemma4:e4b";

export const EMPTY_AD_JSON: AdJson = Object.freeze({
  target_audience: "",
  primary_goal: "awareness",
  offer_type: "none",
  urgency_level: "none",
  tone: [],
  cta_style: "soft",
  key_messages: [],
  keywords: [],
});
