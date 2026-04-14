/** Steps 11–12 — Build banner data from the ad intent and assemble the
 * self-executing injection script from validated zones + style profile.
 * Scripts are then saved to the output directory. */
import type { PipelineState, BannerData, Zone, StyleProfile } from "../types";
import { log, elapsed } from "../logger";
import fs from "node:fs/promises";
import { getOutputDir } from "../fsPaths";

const NODE = "buildBannerAndScript";

// ─── Step 11: Banner ─────────────────────────────────────────────────────────

/**
 * Returns true if the colour string is too light / transparent to read white text on.
 * Catches: rgba(0,0,0,0), rgb(255,255,255), #fff, #ffffff, white, and any colour
 * whose R+G+B components all exceed 200 (perceptually very bright).
 */
function isNearWhiteOrTransparent(color: string): boolean {
  if (!color) return true;
  const c = color.trim().toLowerCase();
  if (c === "transparent" || c === "rgba(0, 0, 0, 0)" || c === "rgba(0,0,0,0)") return true;
  if (c === "white" || c === "#fff" || c === "#ffffff") return true;
  // Parse rgb/rgba values and check luminance.
  const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (m) {
    const r = parseFloat(m[1]);
    const g = parseFloat(m[2]);
    const b = parseFloat(m[3]);
    // Perceived luminance threshold — values above ~0.7 are considered near-white.
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luminance > 0.72) return true;
  }
  return false;
}

/** Pick a usable banner background — never white/transparent. */
function resolveBannerBg(styleProfile: StyleProfile | null): { bg: string; fg: string } {
  const accent = styleProfile?.accentColor ?? "";
  const textColor = styleProfile?.textColor ?? "";

  if (!isNearWhiteOrTransparent(accent)) {
    // Use the page accent colour — it's already dark/vivid.
    return { bg: accent, fg: styleProfile?.accentTextColor ?? "#ffffff" };
  }

  // Accent is white/transparent. Try the body text colour as a dark fallback.
  if (!isNearWhiteOrTransparent(textColor) && textColor) {
    return { bg: textColor, fg: "#ffffff" };
  }

  // Ultimate fallback: charcoal banner, white text.
  return { bg: "#111827", fg: "#ffffff" };
}

function buildBanner(
  state: PipelineState
): BannerData | null {
  const { adJson, styleProfile } = state;
  if (!adJson) {
    log.warn(NODE, "adJson missing — no banner will be generated");
    return null;
  }

  // Build banner text from key_messages, prepending the offer type if meaningful.
  const parts: string[] = [];
  if (adJson.offer_type !== "none") {
    parts.push(adJson.offer_type.replace(/_/g, " ").toUpperCase());
  }
  if (adJson.key_messages.length > 0) {
    parts.push(...adJson.key_messages.slice(0, 2));
  }

  const text = parts.join(" — ").trim();
  if (!text) {
    log.info(NODE, "Banner text is empty — skipping banner");
    return null;
  }

  const { bg, fg } = resolveBannerBg(styleProfile);

  const banner: BannerData = {
    text,
    backgroundColor: bg,
    textColor: fg,
  };

  log.info(NODE, "Banner built", {
    text: banner.text,
    backgroundColor: banner.backgroundColor,
    textColor: banner.textColor,
  });

  return banner;
}

// ─── Step 12: Injection script ────────────────────────────────────────────────

function buildScript(
  validatedZones: Zone[],
  styleProfile: StyleProfile | null,
  banner: BannerData | null
): string {
  const zonesJson = JSON.stringify(
    validatedZones.map((z) => ({ zone: z.zone, sel: z.selector, text: z.new_text })),
    null,
    2
  );
  const styleJson = JSON.stringify(styleProfile ?? {}, null, 2);
  const bannerJson = JSON.stringify(banner ?? null, null, 2);

  return `
(function() {
  'use strict';

  var zones = ${zonesJson};
  var styleProfile = ${styleJson};
  var banner = ${bannerJson};

  function setStyles(node, styles) {
    Object.keys(styles).forEach(function(key) {
      node.style[key] = styles[key];
    });
  }

  function createBanner() {
    if (!banner || !banner.text) return;

    var existing = document.getElementById('troopod-offer-banner');
    if (existing) existing.remove();

    var node = document.createElement('div');
    node.id = 'troopod-offer-banner';
    node.setAttribute('data-troopod-ui', 'banner');
    node.innerText = banner.text;
    setStyles(node, {
      position: 'fixed',
      // Pin to BOTTOM so the banner never overlaps the site's own navigation bar.
      bottom: '0',
      left: '0',
      right: '0',
      top: 'auto',
      zIndex: '2147483646',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '54px',
      padding: '14px 24px',
      background: banner.backgroundColor || '#111827',
      color: banner.textColor || '#ffffff',
      fontFamily: styleProfile.fontFamily || 'inherit',
      fontWeight: '700',
      letterSpacing: '0.01em',
      boxShadow: '0 -8px 24px rgba(0,0,0,0.18)'
    });

    document.body.appendChild(node);
    document.body.style.paddingBottom = node.offsetHeight + 'px';
  }

  zones.forEach(function(z) {
    try {
      var el = document.querySelector(z.sel);
      if (!el) return;
      el.innerText = z.text;
    } catch(e) {
      console.warn('[troopod] zone update failed:', z.sel, e.message);
    }
  });

  createBanner();
})();
  `.trim();
}

// ─── Node ────────────────────────────────────────────────────────────────────

export async function buildBannerAndScript(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const t = Date.now();
  log.step(NODE, `Building banner + injection script for ${state.validatedZones.length} zone(s)…`);

  const banner = buildBanner(state);
  const injectionScript = buildScript(
    state.validatedZones,
    state.styleProfile,
    banner
  );

  log.info(NODE, `Injection script built — ${injectionScript.length} chars`);

  const outputDir = getOutputDir();
  const scriptPath = `${outputDir}/injection-script.js`;
  try {
    await fs.writeFile(scriptPath, injectionScript, "utf-8");
    log.info(NODE, `Injection script saved to disk → ${scriptPath}`);
  } catch (error) {
    log.error(NODE, `Failed to save injection script: ${(error as Error).message}`);
  }

  log.step(NODE, `Done (${elapsed(t)})`);

  return { banner, injectionScript };
}
