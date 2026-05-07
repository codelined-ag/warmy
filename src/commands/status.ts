import { existsSync } from "fs";
import { loadConfig, getConfigPath, formatInTimezone } from "../config.js";
import { isSchedulerInstalled } from "../scheduler/index.js";
import { getNextClaudeWarmup, getNextCodexWarmup } from "../detectors/session.js";
import { isDaemonRunning, readDaemonPid, DEFAULT_POLL_INTERVAL_SECONDS } from "../daemon.js";

export async function status(): Promise<void> {
  const config = await loadConfig();
  const installed = await isSchedulerInstalled();
  const daemonAlive = await isDaemonRunning();
  const daemonPid = await readDaemonPid();
  const configPath = getConfigPath();
  const tz = config.timezone;
  const pollInterval = config.pollIntervalSeconds || DEFAULT_POLL_INTERVAL_SECONDS;

  console.log("=== Warmy Status ===\n");
  console.log(`Config file: ${configPath} ${existsSync(configPath) ? "✓" : "(not found)"}`);
  console.log(`Scheduler:   ${installed ? "✓ installed (auto-starts on reboot)" : "✗ not installed"}`);
  console.log(`Daemon:      ${daemonAlive ? `✓ running (pid ${daemonPid}, poll=${pollInterval}s)` : "✗ not running"}`);
  console.log(`Claude Code: ${config.claudeEnabled ? "✓ enabled" : "✗ disabled"}`);
  console.log(`Codex CLI:   ${config.codexEnabled ? "✓ enabled" : "✗ disabled"}`);
  console.log(`Timezone:    ${tz}`);
  console.log(`Message:     "${config.warmupMessage}"`);

  if (config.claudeEnabled) {
    const lastWarmup = config.lastWarmupAt.claude
      ? new Date(config.lastWarmupAt.claude).getTime()
      : null;
    const next = getNextClaudeWarmup(lastWarmup);
    if (next === null) {
      console.log(`\nClaude:    user active near window reset, skipping this window`);
    } else if (next <= Date.now()) {
      console.log(`\nClaude:    window reset, warmup ready to fire`);
    } else {
      const mins = Math.floor((next - Date.now()) / 60000);
      const nextFmt = new Date(next).toISOString();
      const nextLocal = formatInTimezone(nextFmt, tz);
      console.log(`\nClaude:    next warmup at ${nextFmt} (${mins} min) — ${nextLocal}`);
    }
  }

  if (config.codexEnabled) {
    const lastCodexWarmup = config.lastWarmupAt.codex
      ? new Date(config.lastWarmupAt.codex).getTime()
      : null;
    const next = getNextCodexWarmup(lastCodexWarmup);
    if (next === null) {
      console.log(`Codex:     user active near window reset, skipping this window`);
    } else if (next <= Date.now()) {
      console.log(`Codex:     window reset, warmup ready to fire`);
    } else {
      const mins = Math.floor((next - Date.now()) / 60000);
      const nextFmt = new Date(next).toISOString();
      const nextLocal = formatInTimezone(nextFmt, tz);
      console.log(`Codex:     next warmup at ${nextFmt} (${mins} min) — ${nextLocal}`);
    }
  }

  if (config.lastRun) console.log(`\nLast run: ${formatInTimezone(config.lastRun, tz)}`);
  if (config.lastResult.claude) {
    const r = config.lastResult.claude;
    const line = `Claude result: ${r.success ? "✓" : "✗"} at ${formatInTimezone(r.timestamp, tz)}`;
    console.log(r.success ? line : `${line}\n               error: ${r.error || "unknown"}`);
  }
  if (config.lastResult.codex) {
    const r = config.lastResult.codex;
    const line = `Codex result:  ${r.success ? "✓" : "✗"} at ${formatInTimezone(r.timestamp, tz)}`;
    console.log(r.success ? line : `${line}\n               error: ${r.error || "unknown"}`);
  }
}
