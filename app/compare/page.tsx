"use client";

import { useEffect, useMemo, useState } from "react";

const RESULT_STORAGE_KEY = "troopod:last-result";
const VIEWPORT_WIDTH = 1440;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Change {
  zone: string;
  original: string;
  new: string;
  selector: string;
  overflow: boolean;
  changed: boolean;
  rect?: Rect;
}

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
  changes: Change[];
  images: {
    before: string;
    after: string;
  };
  full_page: {
    before: Tile[];
    after: Tile[];
  };
  ad_intent: AdIntent;
  banner: { text: string; backgroundColor: string; textColor: string } | null;
}

type Variant = "before" | "after";

function tileOverlays(tile: Tile, changes: Change[]): Change[] {
  return changes.filter((change) => {
    const rect = change.rect;
    if (!rect) {
      return false;
    }

    return rect.y < tile.top + tile.height && rect.y + rect.height > tile.top;
  });
}

interface WebsiteColumnProps {
  title: string;
  subtitle: string;
  tiles: Tile[];
  changes: Change[];
  variant: Variant;
}

function WebsiteColumn({ title, subtitle, tiles, changes, variant }: WebsiteColumnProps) {
  return (
    <section className="compare-column">
      <div className="compare-column-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="website-frame">
        <div className="website-scroll">
          <div className="website-stack">
            {tiles.map((tile, index) => (
              <div className="website-tile" key={`${variant}-${index}`} style={{ aspectRatio: `${tile.width} / ${tile.height}` }}>
                <img alt={`${title} section ${index + 1}`} src={tile.src} />
                {tileOverlays(tile, changes).map((change) => {
                  const rect = change.rect as Rect;
                  const left = `${(rect.x / VIEWPORT_WIDTH) * 100}%`;
                  const top = `${((rect.y - tile.top) / tile.height) * 100}%`;

                  return (
                    <div
                      className={`change-floater ${variant === "after" ? "is-after" : "is-before"}`}
                      key={`${variant}-${tile.top}-${change.zone}`}
                      style={{ left, top }}
                    >
                      <strong>{change.zone}</strong>
                      <span>{variant === "after" ? change.new : change.original}</span>
                    </div>
                  );
                })}
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
    if (!raw) {
      return;
    }

    try {
      setResult(JSON.parse(raw) as CompareResult);
    } catch {
      setResult(null);
    }
  }, []);

  const changedZones = useMemo<Change[]>(
    () => result?.changes?.filter((change) => change.changed && change.rect) ?? [],
    [result]
  );

  if (!result) {
    return (
      <main className="compare-shell">
        <section className="compare-empty panel">
          <h1>No comparison payload found</h1>
          <p>
            Run a Troopod personalisation first from the main page, then open this compare view
            again.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="compare-shell">
      <section className="compare-hero">
        <div>
          <span className="eyebrow">Full-Page Compare</span>
          <h1>Original and personalised website views, stacked and scrollable.</h1>
          <p>
            Each column behaves like a website window. Floaters mark the grounded text changes
            captured from the live DOM.
          </p>
        </div>
        <div className="compare-summary panel">
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
            <span>{result.ad_intent.key_messages.join(" · ") || "None detected"}</span>
          </div>
        </div>
      </section>

      <section className="compare-grid">
        <WebsiteColumn
          changes={changedZones}
          subtitle="Captured before injection"
          tiles={result.full_page.before}
          title="Original Website"
          variant="before"
        />
        <WebsiteColumn
          changes={changedZones}
          subtitle="Captured after deterministic text and UI updates"
          tiles={result.full_page.after}
          title="Personalised Website"
          variant="after"
        />
      </section>
    </main>
  );
}
