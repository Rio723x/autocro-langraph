/** Steps 11–12 — Build banner data from the ad intent and assemble the
 * self-executing injection script from validated zones + style profile.
 * Pure data transforms, no I/O. */
import type { PipelineState, BannerData, Zone, StyleProfile } from "../types";

// ─── Step 11: Banner ─────────────────────────────────────────────────────────

function buildBanner(
  state: PipelineState
): BannerData | null {
  const { adJson, styleProfile } = state;
  if (!adJson) return null;

  // Build banner text from key_messages, prepending the offer type if meaningful.
  const parts: string[] = [];
  if (adJson.offer_type !== "none") {
    parts.push(adJson.offer_type.replace(/_/g, " ").toUpperCase());
  }
  if (adJson.key_messages.length > 0) {
    parts.push(...adJson.key_messages.slice(0, 2));
  }

  const text = parts.join(" — ").trim();
  if (!text) return null;

  return {
    text,
    backgroundColor: styleProfile?.accentColor ?? "#111827",
    textColor: styleProfile?.accentTextColor ?? "#ffffff",
  };
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
      top: '0',
      left: '0',
      right: '0',
      zIndex: '2147483646',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '54px',
      padding: '14px 24px',
      background: banner.backgroundColor || styleProfile.accentColor || '#111827',
      color: banner.textColor || styleProfile.accentTextColor || '#ffffff',
      fontFamily: styleProfile.fontFamily || 'inherit',
      fontWeight: '700',
      letterSpacing: '0.01em',
      boxShadow: styleProfile.shadow || '0 12px 28px rgba(15, 23, 42, 0.18)'
    });

    document.body.prepend(node);
    document.body.style.paddingTop = node.offsetHeight + 'px';
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
  const banner = buildBanner(state);
  const injectionScript = buildScript(
    state.validatedZones,
    state.styleProfile,
    banner
  );
  return { banner, injectionScript };
}
