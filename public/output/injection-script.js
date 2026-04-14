(function() {
  'use strict';

  var zones = [
  {
    "zone": "headline",
    "sel": "div.min-h-screen.font-sans > section.hero.relative > div.relative.max-w-4xl > h1.text-6xl.md\\:text-8xl",
    "text": "Stop Project Chaos Now: Save 50% Today!"
  },
  {
    "zone": "subheadline",
    "sel": "div.min-h-screen.font-sans > section.hero.relative > div.relative.max-w-4xl > p.text-lg.md\\:text-xl",
    "text": "Tired of wasting 8hrs/week? Get AI intelligence for remote teams to conquer project chaos instantly. Offer ends Friday!"
  },
  {
    "zone": "cta",
    "sel": "div.min-h-screen.font-sans > section.hero.relative > div.relative.max-w-4xl > div.flex.flex-col > a.w-full.sm\\:w-auto",
    "text": "Claim 50% Off Now"
  },
  {
    "zone": "cta_secondary",
    "sel": "div.min-h-screen.font-sans > section.py-24.md\\:py-32 > div.relative.z-10 > div.flex.flex-col > a.w-full.sm\\:w-auto",
    "text": "Start for free today"
  },
  {
    "zone": "cta_tertiary",
    "sel": "div.min-h-screen.font-sans > section.py-24.md\\:py-32 > div.relative.z-10 > div.flex.flex-col > a.w-full.sm\\:w-auto",
    "text": "Watch the demo"
  },
  {
    "zone": "badge",
    "sel": "div.min-h-screen.font-sans > section.hero.relative > div.hero-preview.mt-12 > div.preview-body.text-left > div.preview-main.bg-\\[\\#fafafa\\] > div.sparkline-row > div.sparkline-header > span.sparkline-badge",
    "text": "↑ +38% this week"
  }
];
  var styleProfile = {
  "fontFamily": "ui-sans-serif, system-ui, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\"",
  "textColor": "rgb(241, 245, 249)",
  "surfaceColor": "rgb(0, 0, 0)",
  "accentColor": "rgb(241, 245, 249)",
  "accentTextColor": "lab(8.11897 0.811279 -12.254)",
  "accentSoftColor": "rgba(17, 24, 39, 0.08)",
  "accentBorderColor": "lab(8.11897 0.811279 -12.254)",
  "borderRadius": "0px",
  "cardRadius": "0px",
  "shadow": "0 12px 28px rgba(15, 23, 42, 0.18)",
  "softShadow": "0 12px 24px rgba(15, 23, 42, 0.08)"
};
  var banner = {
  "text": "DISCOUNT — Stop wasting 8hrs/week on project chaos. — Ends Friday.",
  "backgroundColor": "#111827",
  "textColor": "#ffffff"
};

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