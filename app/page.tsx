"use client";

import { useMemo, useState } from "react";
import { ImgComparisonSlider } from "@img-comparison-slider/react";
import type { FormEvent } from "react";

const SAMPLE_AD_PATH = "/sample-ad.png";
const RESULT_STORAGE_KEY = "troopod:last-result";

interface Change {
  zone: string;
  original: string;
  new: string;
  selector: string;
  overflow: boolean;
  changed: boolean;
  rect?: { x: number; y: number; width: number; height: number };
}

interface AdIntent {
  offer_type: string;
  urgency_level: string;
  cta_style: string;
  key_messages: string[];
}

interface ResultMeta {
  zones_changed: number;
}

interface PersonaliseResult {
  success: boolean;
  changes: Change[];
  images: { before: string; after: string };
  ad_intent: AdIntent;
  banner: { text: string; backgroundColor: string; textColor: string } | null;
  meta: ResultMeta;
}

function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

function ChangeCard({ change }: { change: Change }) {
  return (
    <article className="change-card glass">
      <span className="zone-label">{change.zone}</span>
      <div className="change-copy">
        <div className="change-block">{change.original}</div>
        <div className="change-arrow">→</div>
        <div className="change-block">{change.new}</div>
      </div>
      <div className="selector-line">{change.selector}</div>
      <div className="overflow-line">Overflow: {change.overflow ? "detected" : "none"}</div>
    </article>
  );
}

export default function HomePage() {
  const [adFile, setAdFile] = useState<File | null>(null);
  const [adInputUrl, setAdInputUrl] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState<string>("");
  const [status, setStatus] = useState<string>("Ready to run.");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<PersonaliseResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

  const changedZones = useMemo<Change[]>(
    () => result?.changes?.filter((c) => c.changed) ?? [],
    [result]
  );

  function applyFile(file: File | null): void {
    setAdFile(file);
    setAdInputUrl("");
    setResult(null);
    setError("");
    setStatus(file ? "Ad creative attached." : "Ready to run.");
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? createPreviewUrl(file) : null);
  }

  function applyUrl(url: string): void {
    setAdInputUrl(url);
    setAdFile(null);
    setResult(null);
    setError("");

    if (!url) {
      setPreviewUrl(null);
      setStatus("Ready to analyse.");
      return;
    }
    
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    
    setPreviewUrl(url);
    setStatus("Ad creative URL attached.");
  }

  function useSampleAd(): void {
    setAdFile(null);
    setAdInputUrl("");
    setResult(null);
    setError("");
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(SAMPLE_AD_PATH);
    setStatus("Sample ad selected.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!pageUrl.trim()) { setError("Landing page URL is required."); return; }

    setIsSubmitting(true);
    setError("");
    setResult(null);
    setStatus("Extracting ad intent and rendering page…");

    try {
      const formData = new FormData();
      formData.append("pageUrl", pageUrl.trim());
      if (adFile) {
        formData.append("adFile", adFile);
      } else if (adInputUrl) {
        formData.append("adUrl", adInputUrl);
      } else if (previewUrl === SAMPLE_AD_PATH) {
        formData.append("adUrl", new URL(SAMPLE_AD_PATH, window.location.origin).toString());
      } else {
        throw new Error("Please provide an Ad File, an Ad URL, or use the sample ad.");
      }

      const response = await fetch("/api/personalise", { method: "POST", body: formData });
      const payload: PersonaliseResult & { error?: string } = await response.json();

      if (!response.ok) throw new Error(payload.error || "Personalisation failed.");

      setResult(payload);
      window.localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(payload));
      setStatus(payload.success ? "Personalisation complete." : "Finished with a graceful fallback.");
    } catch (err) {
      setError((err as Error).message || "Personalisation failed.");
      setStatus("Run failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="troopod-shell">
      {/* Decorative glow orbs */}
      <div className="glow-orb" style={{ width: 500, height: 500, top: -120, left: -140, background: "rgba(162,89,255,0.10)" }} />
      <div className="glow-orb" style={{ width: 380, height: 380, top: 80, right: -100, background: "rgba(232,61,77,0.09)" }} />

      {/* ── Hero ── */}
      <section className="hero">
        <span className="eyebrow">AutoCRO · Powered by Local AI</span>
        <h1>
          Your ads speak.<br />
          <span className="accent-word">Make your pages listen.</span>
        </h1>
        <p>
          Drop in an ad creative, paste a landing page URL — AutoCRO reads the ad's intent,
          rewrites your page copy to match it, and hands you before/after evidence.
          Zero external APIs. Runs entirely on your machine.
        </p>
      </section>

      {/* ── Input form ── */}
      <form className="glass-strong panel" onSubmit={handleSubmit}>
        <div className="input-grid">
          {/* Ad creative */}
          <div className="field-column">
            <label className="field-label">Ad Creative</label>
            <label
              className={`dropzone${isDragActive ? " is-active" : ""}`}
              onDragEnter={() => setIsDragActive(true)}
              onDragLeave={() => setIsDragActive(false)}
              onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
              onDrop={(e) => { e.preventDefault(); setIsDragActive(false); applyFile(e.dataTransfer.files?.[0] ?? null); }}
            >
              <input accept=".png,.jpg,.jpeg,.gif" type="file" onChange={(e) => applyFile(e.target.files?.[0] ?? null)} />
              {previewUrl ? (
                <img alt="Ad preview" className="dropzone-preview" src={previewUrl} />
              ) : (
                <div>
                  <strong>Drop JPG, PNG, or GIF here</strong>
                  <p className="hint" style={{ marginTop: 6 }}>
                    The ad is analysed locally via Ollama vision — no cloud uploads.
                  </p>
                </div>
              )}
              <div className="dropzone-actions" style={{ flexWrap: "wrap", justifyContent: "center" }}>
                <span className="ghost-button">Choose file</span>
                <button
                  className="ghost-button"
                  onClick={(e) => { e.preventDefault(); useSampleAd(); }}
                  type="button"
                >
                  Use sample ad
                </button>
              </div>
            </label>

            <div style={{ margin: "1rem 0", display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ flex: 1, borderTop: "1px solid currentColor", opacity: 0.15 }}></span>
                <span style={{ fontSize: "0.85rem", opacity: 0.5, fontWeight: 500, textTransform: "uppercase" }}>or paste image url</span>
                <span style={{ flex: 1, borderTop: "1px solid currentColor", opacity: 0.15 }}></span>
            </div>

            <input
              className="text-input"
              id="adUrl"
              onChange={(event) => applyUrl(event.target.value)}
              placeholder="https://example.com/ad-image.jpg"
              type="url"
              value={adInputUrl}
            />
          </div>

          {/* Page URL */}
          <div className="field-column">
            <label className="field-label" htmlFor="pageUrl">Landing Page URL</label>
            <input
              className="text-input"
              id="pageUrl"
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="https://your-landing-page.com"
              type="url"
              value={pageUrl}
            />
            <p className="hint">
              AutoCRO opens a headless browser, detects CRO zones (headline, subheadline,
              CTA), rewrites them to align with the ad's message, and injects the changes
              — all locally.
            </p>
            <p className="hint" style={{ marginTop: 8 }}>
              Accepts <code className="hint">multipart/form-data</code> with{" "}
              <code className="hint">adFile</code> or <code className="hint">adUrl</code> plus{" "}
              <code className="hint">pageUrl</code>.
            </p>
          </div>
        </div>

        <div className="submit-row">
          <div className={`status-line${error ? " error" : ""}`}>{error || status}</div>
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Running pipeline…" : "Analyse & Personalise →"}
          </button>
        </div>
      </form>

      {/* ── Results ── */}
      {result ? (
        <section className="results">
          <div className="results-head">
            <div>
              <h2>Run Output</h2>
              <p className="hint" style={{ marginTop: 6 }}>
                {result.success
                  ? "Before and after screenshots captured successfully."
                  : "Injection finished with a graceful fallback — after image may match before."}
              </p>
            </div>
          </div>

          {/* Slider comparison */}
          <div className="glass comparison-frame">
            <ImgComparisonSlider>
              <img alt="Before personalisation" slot="first" src={result.images.before} />
              <img alt="After personalisation" slot="second" src={result.images.after} />
            </ImgComparisonSlider>
            <p className="slider-caption">Drag to reveal before / after.</p>
          </div>

          {/* Open full compare */}
          <div className="compare-launch-row">
            <a className="primary-button compare-launch-link" href="/compare" rel="noreferrer" target="_blank">
              Open full-page compare →
            </a>
            <p className="hint compare-launch-hint">
              Side-by-side scrollable view of the full website — before and after.
            </p>
          </div>

          {/* Fallback side-by-side */}
          <div className="comparison-fallback">
            <div className="glass comparison-card">
              <h3>Before</h3>
              <img alt="Before screenshot" src={result.images.before} />
            </div>
            <div className="glass comparison-card">
              <h3>After</h3>
              <img alt="After screenshot" src={result.images.after} />
            </div>
          </div>

          {/* Meta grid */}
          <div className="glass-strong meta-grid">
            <div className="meta-item">
              <strong>Offer Type</strong>
              <span>{result.ad_intent.offer_type || "none"}</span>
            </div>
            <div className="meta-item">
              <strong>Urgency</strong>
              <span>{result.ad_intent.urgency_level || "none"}</span>
            </div>
            <div className="meta-item">
              <strong>CTA Style</strong>
              <span>{result.ad_intent.cta_style || "soft"}</span>
            </div>
            <div className="meta-item">
              <strong>Key Messages</strong>
              <span>{result.ad_intent.key_messages.join(" · ") || "—"}</span>
            </div>
            <div className="meta-item">
              <strong>Zones Changed</strong>
              <span>{result.meta.zones_changed}</span>
            </div>
          </div>

          {/* Structured diff */}
          <div className="glass diff-grid">
            <h3>Structured Diff</h3>
            {changedZones.length > 0 ? (
              changedZones.map((change) => <ChangeCard change={change} key={change.zone} />)
            ) : (
              <div className="empty-state">
                No zones changed — model output was invalid, all changes failed validation,
                or injection was blocked by the page's CSP.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
