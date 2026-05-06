import { loadConfig, saveConfig } from "../config.js";
import { WARMUP_INTERVAL_SECONDS } from "../warmup/types.js";
import type { WarmupResult } from "../warmup/types.js";
import { warmupClaude } from "../warmup/anthropic.js";
import { warmupCodex } from "../warmup/openai.js";
import { getLastClaudeActivity, getLastCodexActivity } from "../detectors/session.js";

export async function runWarmup(): Promise<void> {
  const config = await loadConfig();
  const timestamp = new Date().toISOString();
  const interval = WARMUP_INTERVAL_SECONDS;
  const nowMs = Date.now();

  async function doWarmup(
    label: string,
    provider: "claude" | "codex",
    warmupFn: (msg: string) => WarmupResult,
    getLastActivity: () => number | null
  ) {
    if (!config.claudeEnabled && provider === "claude") {
      console.log(`○ ${label}: disabled`);
      return;
    }
    if (!config.codexEnabled && provider === "codex") {
      console.log(`○ ${label}: disabled`);
      return;
    }

    const lastActivity = getLastActivity();
    const lastWarmup = config.lastWarmupAt[provider]
      ? new Date(config.lastWarmupAt[provider]!).getTime()
      : 0;
    const lastInteraction = Math.max(lastActivity || 0, lastWarmup);
    const needsWarmup = lastInteraction === 0 || (nowMs - lastInteraction) / 1000 >= interval;

    if (needsWarmup) {
      console.log(`Warming up ${label}...`);
      const result = warmupFn(config.warmupMessage);
      if (result.success) {
        console.log(`✓ ${label} warmup succeeded: "${result.reply}"`);
        config.lastWarmupAt[provider] = timestamp;
      } else {
        console.error(`✗ ${label} warmup failed: ${result.error}`);
      }
      config.lastResult[provider] = { success: result.success, timestamp };
    } else {
      const next = lastInteraction > 0
        ? new Date(lastInteraction + interval * 1000).toISOString()
        : "now";
      console.log(`○ ${label}: next warmup at ${next}`);
    }
  }

  await doWarmup("Claude Code", "claude", warmupClaude, getLastClaudeActivity);
  await doWarmup("Codex CLI", "codex", warmupCodex, getLastCodexActivity);

  config.lastRun = timestamp;
  await saveConfig(config);
}
