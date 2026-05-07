import { loadConfig, saveConfig } from "../config.js";
import type { WarmupResult } from "../warmup/types.js";
import { warmupClaude } from "../warmup/anthropic.js";
import { warmupCodex } from "../warmup/openai.js";
import { getNextClaudeWarmup, getNextCodexWarmup } from "../detectors/session.js";

const FAILURE_BACKOFF_MS = 5 * 60 * 1000;

export async function runWarmup(): Promise<void> {
  const config = await loadConfig();
  const timestamp = new Date().toISOString();
  const nowMs = Date.now();
  let dirty = false;

  async function doWarmup(
    label: string,
    provider: "claude" | "codex",
    warmupFn: (msg: string) => WarmupResult | Promise<WarmupResult>,
    getNextWarmup: (lastWarmupAt?: number | null) => number | null
  ) {
    if ((!config.claudeEnabled && provider === "claude") ||
        (!config.codexEnabled && provider === "codex")) {
      console.log(`○ ${label}: disabled`);
      return;
    }

    const lastWarmupTs = config.lastWarmupAt[provider]
      ? new Date(config.lastWarmupAt[provider]!).getTime()
      : null;
    const nextWarmup = getNextWarmup(lastWarmupTs);

    if (nextWarmup === null) {
      console.log(`○ ${label}: user was active near window reset, skipping`);
      return;
    }

    if (nextWarmup > nowMs) {
      console.log(`○ ${label}: next warmup at ${new Date(nextWarmup).toISOString()}`);
      return;
    }

    const lastFail = config.lastResult[provider];
    if (lastFail && !lastFail.success) {
      const lastFailMs = new Date(lastFail.timestamp).getTime();
      if (nowMs - lastFailMs < FAILURE_BACKOFF_MS) {
        const remainingMs = FAILURE_BACKOFF_MS - (nowMs - lastFailMs);
        console.log(`○ ${label}: backing off after failure (retry in ${Math.ceil(remainingMs / 1000)}s)`);
        return;
      }
    }

    console.log(`Warming up ${label}...`);
    const result = await warmupFn(config.warmupMessage);
    if (result.success) {
      const reply = (result.reply || "").slice(0, 80);
      console.log(`✓ ${label} warmup succeeded: "${reply}"`);
      config.lastWarmupAt[provider] = timestamp;
    } else {
      console.error(`✗ ${label} warmup failed: ${result.error}`);
    }
    config.lastResult[provider] = { success: result.success, timestamp, error: result.error };
    dirty = true;
  }

  await doWarmup("Claude Code", "claude", warmupClaude, getNextClaudeWarmup);
  await doWarmup("Codex CLI", "codex", warmupCodex, getNextCodexWarmup);

  if (dirty) {
    config.lastRun = timestamp;
    await saveConfig(config);
  }
}
