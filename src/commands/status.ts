import { existsSync } from "fs";
import { loadConfig, getConfigPath } from "../config.js";
import { WARMUP_INTERVAL_SECONDS } from "../warmup/types.js";
import { isSchedulerInstalled } from "../scheduler/index.js";

export async function status(): Promise<void> {
  const config = await loadConfig();
  const installed = await isSchedulerInstalled();
  const configPath = getConfigPath();

  console.log("=== Warmy Status ===\n");
  console.log(`Config file: ${configPath} ${existsSync(configPath) ? "✓" : "(not found)"}`);
  console.log(`Scheduler:   ${installed ? "✓ installed (every 5 min)" : "✗ not installed"}`);
  const hours = Math.floor(WARMUP_INTERVAL_SECONDS / 3600);
  const mins = Math.floor((WARMUP_INTERVAL_SECONDS % 3600) / 60);
  const intervalLabel = mins > 0 ? `${hours}hr ${mins}min` : `${hours}hr`;
  console.log(`Warmup interval: ${intervalLabel} after last activity`);
  console.log(`Claude Code: ${config.claudeEnabled ? "✓ enabled" : "✗ disabled"}`);
  console.log(`Codex CLI:   ${config.codexEnabled ? "✓ enabled" : "✗ disabled"}`);
  console.log(`Message:     "${config.warmupMessage}"`);

  if (config.lastWarmupAt.claude) {
    const next = new Date(new Date(config.lastWarmupAt.claude).getTime() + WARMUP_INTERVAL_SECONDS * 1000).toISOString();
    console.log(`\nClaude next: ${next}`);
  }
  if (config.lastWarmupAt.codex) {
    const next = new Date(new Date(config.lastWarmupAt.codex).getTime() + WARMUP_INTERVAL_SECONDS * 1000).toISOString();
    console.log(`Codex next:  ${next}`);
  }
  if (config.lastRun) console.log(`\nLast run: ${config.lastRun}`);
  if (config.lastResult.claude) {
    const { success, timestamp } = config.lastResult.claude;
    console.log(`Claude result: ${success ? "✓" : "✗"} at ${timestamp}`);
  }
  if (config.lastResult.codex) {
    const { success, timestamp } = config.lastResult.codex;
    console.log(`Codex result:  ${success ? "✓" : "✗"} at ${timestamp}`);
  }
}
