/** Step 1 — Validates inputs. pageUrl and adFilePath are pre-resolved by the
 * API route before graph invocation; this node just confirms they exist. */
import type { PipelineState } from "../types";
import { PipelineError } from "../errors";

export async function resolveInputs(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const { pageUrl, adFilePath } = state;

  if (!pageUrl) {
    throw new PipelineError("pageUrl is required", 400);
  }

  try {
    const parsed = new URL(pageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new PipelineError("pageUrl must be a valid http or https URL", 400);
  }

  if (!adFilePath) {
    throw new PipelineError("adFilePath is required", 400);
  }

  // No state changes — inputs are already in state. Return empty update.
  return {};
}
