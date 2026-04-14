"use client";

import { useEffect, useState } from "react";

const RESULT_STORAGE_KEY = "troopod:last-result";
const VIEWPORT_WIDTH = 1440;

interface Tile {
  src: string;
  top: number;
  width: number;
  height: number;
}

interface AdIntent {
  offer_type: string;
  urgency_level: string;
  cta_style: string;
  key_messages: string[];
}

interface CompareResult {
  success: boolean;
  changes: unknown[];
  images: { before: string; after: string };
  full_page: { before: Tile[]; after: Tile[] };
  ad_intent: AdIntent;
  banner: { text: string; backgroundColor: string; textColor: string } | null;
}

type Variant = "before" | "after";

interface WebsiteColumnProps {
  title: string;
  subtitle: string;
  tiles: Tile[];
  variant: Variant;
  label: string;
}

function WebsiteColumn({ title, subtitle, tiles, variant, label }: WebsiteColumnProps) {
  const accentStyle: React.CSSProperties =
    variant === "after"
      ? { color: "var(--teal)", borderColor: "rgba(0,229,195,0.30)", background: "var(--teal-soft)" }
      : { color: "var(--ink-muted)", borderColor: "var(--glass-border)", background: "var(--glass-1)" };

  return (
    <section className="compare-column">
      <div className="compare-column-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              border: "1px solid",
              ...accentStyle,
            }}
          >
            {label}
          </span>
        </div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <div className="website-frame">
        <div className="website-scroll">
          <div className="website-stack">
            {tiles.map((tile, index) => (
              <div className="website-tile" key={`${variant}-${index}`}>
                <img
                  alt={`${title} — page section ${index + 1}`}
                  src={tile.src}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ComparePage() {
  const [result, setResult] = useState<CompareResult | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return;
    try { setResult(JSON.parse(raw) as CompareResult); } catch { setResult(null); }
  }, []);

  if (!result) {
    return (
      <main className="compare-shell">
        <div
          className="glow-orb"
          style={{ width: 600, height: 600, top: -200, left: -200, background: "rgba(162,89,255,0.09)", position: "fixed", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none", zIndex: 0 }}
        />
        <section className="compare-empty glass-strong" style={{ position: "relative", zIndex: 1 }}>
          <span className="eyebrow" style={{ marginBottom: 20 }}>No data</span>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 12 }}>
            No comparison payload found
          </h1>
          <p className="compare-empty" style={{ margin: 0, padding: 0 }}>
            Run an AutoCRO personalisation from the main page first, then come back here.
          </p>
          <a
            href="/"
            className="primary-button"
            style={{ display: "inline-flex", marginTop: 24, textDecoration: "none" }}
          >
            ← Back to AutoCRO
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="compare-shell">
      {/* Glow orbs */}
      <div className="glow-orb" style={{ width: 500, height: 500, top: -100, left: -150, background: "rgba(162,89,255,0.10)", position: "fixed", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none", zIndex: 0 }} />
      <div className="glow-orb" style={{ width: 360, height: 360, top: 200, right: -80, background: "rgba(232,61,77,0.09)", position: "fixed", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none", zIndex: 0 }} />

      {/* Hero */}
      <section className="compare-hero" style={{ position: "relative", zIndex: 1 }}>
        <div>
          <span className="eyebrow" style={{ marginBottom: 16, display: "inline-flex" }}>Full-Page Compare</span>
          <h1 className="compare-hero">
            See exactly what<br />
            <span style={{
              background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>changed — and why.</span>
          </h1>
          <p style={{ marginTop: 8 }}>
            Scroll each column like a real website. The left shows the original landing page,
            the right shows AutoCRO's personalised version — aligned to your ad's message.
          </p>
        </div>

        {/* Summary panel */}
        <div className="glass-strong compare-summary" style={{ position: "relative", zIndex: 1 }}>
          <div className="compare-summary-item">
            <strong>Offer Type</strong>
            <span>{result.ad_intent.offer_type || "none"}</span>
          </div>
          <div className="compare-summary-item">
            <strong>Urgency</strong>
            <span>{result.ad_intent.urgency_level || "none"}</span>
          </div>
          <div className="compare-summary-item">
            <strong>CTA Style</strong>
            <span>{result.ad_intent.cta_style || "soft"}</span>
          </div>
          <div className="compare-summary-item">
            <strong>Key Messages</strong>
            <span>{result.ad_intent.key_messages.join(" · ") || "—"}</span>
          </div>
          {result.banner && (
            <div className="compare-summary-item">
              <strong>Banner Injected</strong>
              <span style={{ color: "var(--teal)" }}>{result.banner.text.slice(0, 60)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Main compare grid */}
      <section className="compare-grid" style={{ position: "relative", zIndex: 1 }}>
        <WebsiteColumn
          label="Original"
          subtitle="Captured before any changes"
          tiles={result.full_page.before}
          title="Original Website"
          variant="before"
        />
        <WebsiteColumn
          label="Personalised"
          subtitle="Captured after deterministic text and UI updates"
          tiles={result.full_page.after}
          title="Personalised Website"
          variant="after"
        />
      </section>
    </main>
  );
}
