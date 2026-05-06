import { existsSync } from "fs";
import { loadConfig, getConfigPath } from "../config.js";
import { isSchedulerInstalled } from "../scheduler/index.js";
import { getNextClaudeWarmup, getNextCodexWarmup } from "../detectors/session.js";

export async function status(): Promise<void> {
  const config = await loadConfig();
  const installed = await isSchedulerInstalled();
  const configPath = getConfigPath();

  console.log("=== Warmy Status ===\n");
  console.log(`Config file: ${configPath} ${existsSync(configPath) ? "✓" : "(not found)"}`);
  console.log(`Scheduler:   ${installed ? "✓ installed (every 5 min)" : "✗ not installed"}`);
  console.log(`Claude Code: ${config.claudeEnabled ? "✓ enabled" : "✗ disabled"}`);
  console.log(`Codex CLI:   ${config.codexEnabled ? "✓ enabled" : "✗ disabled"}`);
  console.log(`Message:     "${config.warmupMessage}"`);

  if (config.claudeEnabled) {
    const next = getNextClaudeWarmup();
    if (next === null) {
      console.log(`\nClaude:    user active near window reset, skipping this window`);
    } else if (next <= Date.now()) {
      console.log(`\nClaude:    window reset, warmup ready to fire`);
    } else {
      const mins = Math.floor((next - Date.now()) / 60000);
      console.log(`\nClaude:    next warmup at ${new Date(next).toISOString()} (${mins} min)`);
    }
  }

  if (config.codexEnabled) {
    const next = getNextCodexWarmup();
    if (next === null) {
      console.log(`Codex:     user active near window reset, skipping this window`);
    } else if (next <= Date.now()) {
      console.log(`Codex:     window reset, warmup ready to fire`);
    } else {
      const mins = Math.floor((next - Date.now()) / 60000);
      console.log(`Codex:     next warmup at ${new Date(next).toISOString()} (${mins} min)`);
    }
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
