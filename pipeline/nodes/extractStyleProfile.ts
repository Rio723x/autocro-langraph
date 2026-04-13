/** Step 5 — Read computed CSS from body and the first visible interactive
 * element to produce a style "fingerprint" used to style injected elements. */
import type { PipelineState, StyleProfile } from "../types";
import { getPage } from "../browserContext";

export async function extractStyleProfile(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  void state;
  const page = getPage();

  const styleProfile: StyleProfile = await page.evaluate(() => {
    function firstVisibleButton(): Element | null {
      const candidates = Array.from(
        document.querySelectorAll(
          "button, a, input[type='button'], input[type='submit']"
        )
      );
      return (
        candidates.find((node) => {
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0
          );
        }) ?? null
      );
    }

    const bodyStyle = window.getComputedStyle(document.body);
    const button = firstVisibleButton();
    const buttonStyle = button ? window.getComputedStyle(button) : null;

    return {
      fontFamily: bodyStyle.fontFamily || "inherit",
      textColor: bodyStyle.color || "#111827",
      surfaceColor:
        bodyStyle.backgroundColor &&
        bodyStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
          ? bodyStyle.backgroundColor
          : "#ffffff",
      accentColor:
        buttonStyle?.backgroundColor &&
        buttonStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
          ? buttonStyle.backgroundColor
          : bodyStyle.color || "#111827",
      accentTextColor: buttonStyle?.color || "#ffffff",
      accentSoftColor:
        buttonStyle?.backgroundColor &&
        buttonStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
          ? buttonStyle.backgroundColor
              .replace("rgb(", "rgba(")
              .replace(")", ", 0.12)")
          : "rgba(17, 24, 39, 0.08)",
      accentBorderColor:
        buttonStyle?.borderColor &&
        buttonStyle.borderColor !== "rgba(0, 0, 0, 0)"
          ? buttonStyle.borderColor
          : "rgba(17, 24, 39, 0.12)",
      borderRadius: buttonStyle?.borderRadius || "16px",
      cardRadius:
        bodyStyle.borderRadius || buttonStyle?.borderRadius || "18px",
      shadow:
        buttonStyle?.boxShadow && buttonStyle.boxShadow !== "none"
          ? buttonStyle.boxShadow
          : "0 12px 28px rgba(15, 23, 42, 0.18)",
      softShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
    };
  });

  return { styleProfile };
}
