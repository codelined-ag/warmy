#!/usr/bin/env node

import { Command } from "commander";
import { createInterface } from "readline";
import { platform } from "os";
import { fileURLToPath } from "url";
import { isClaudeInstalled } from "./detectors/claude.js";
import { isCodexInstalled } from "./detectors/codex.js";
import { warmupClaude } from "./warmup/anthropic.js";
import { warmupCodex } from "./warmup/openai.js";
import { removeToken } from "./keyring.js";
import { getLastClaudeActivity, getLastCodexActivity } from "./detectors/session.js";
import { loadConfig,
  saveConfig,
  getWarmyDir,
  getConfigPath,
  getPlatform,
  type WarmyConfig,
} from "./config.js";
import { WARMUP_INTERVAL_SECONDS } from "./warmup/types.js";
import type { WarmupResult } from "./warmup/types.js";
import {
  installScheduler,
  uninstallScheduler,
  isSchedulerInstalled,
} from "./scheduler/index.js";
import { existsSync } from "fs";

const program = new Command();

function ask(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function askYesNo(question: string, defaultYes: boolean = false): Promise<boolean> {
  const suffix = defaultYes ? " [Y/n]: " : " [y/N]: ";
  return ask(question + suffix).then((a) => {
    const trimmed = a.trim().toLowerCase();
    if (trimmed === "") return defaultYes;
    return trimmed === "y" || trimmed === "yes";
  });
}

async function init(): Promise<void> {
  console.log("Warmy - Claude Code & Codex CLI Warmup Setup\n");

  const cfg = await loadConfig();
  const configDir = getWarmyDir();
  console.log(`Config directory: ${configDir}`);
  console.log(`Platform: ${platform()} (${getPlatform()})\n`);

  console.log("=== Detecting installed CLIs ===\n");

  const claudeDetected = isClaudeInstalled();
  const codexDetected = isCodexInstalled();

  console.log(`Claude Code: ${claudeDetected ? "✓ installed" : "✗ not found"}`);
  console.log(`Codex CLI:   ${codexDetected ? "✓ installed" : "✗ not found"}\n`);

  if (!claudeDetected && !codexDetected) {
    console.error("Neither Claude Code nor Codex CLI is installed. Nothing to warm up.");
    return;
  }

  const enableClaude = claudeDetected && await askYesNo("Enable Claude Code warmup?", true);
  const enableCodex = codexDetected && await askYesNo("Enable Codex CLI warmup?", true);

  const defaultTime = cfg.scheduleTime || "06:00";
  const timeAnswer = await ask(`Schedule time [${defaultTime}]: `);
  const scheduleTime = timeAnswer.trim() || defaultTime;

  if (timeAnswer.trim()) {
    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(scheduleTime)) {
      console.error("Invalid time format. Use HH:MM (e.g., 06:00 or 14:30)");
      return;
    }
  }

  const newConfig: WarmyConfig = {
    ...cfg,
    scheduleTime,
    claudeEnabled: enableClaude,
    codexEnabled: enableCodex,
    lastWarmupAt: {
      claude: null,
      codex: null,
    },
    warmupIntervalSeconds: WARMUP_INTERVAL_SECONDS,
  };

  await saveConfig(newConfig);

  console.log("\n=== Installing scheduler ===\n");

  try {
    const warmyPath = process.argv[1] || fileURLToPath(import.meta.url);
    await installScheduler(warmyPath);
    console.log("✓ Scheduler installed (runs every 5 minutes)\n");
  } catch (err) {
    console.error(`✗ Failed to install scheduler: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  console.log("=== Warmy setup complete! ===\n");
  console.log("Schedule: Every 5 minutes (keeps sessions warm near 5hr window end)");
  console.log(`Claude Code warmup: ${newConfig.claudeEnabled ? "enabled" : "disabled"}`);
  console.log(`Codex CLI warmup: ${newConfig.codexEnabled ? "enabled" : "disabled"}`);
  console.log("\nRun 'warmy run' to trigger a warmup now.");
  console.log("Run 'warmy status' to check the next scheduled run.");
}

async function runWarmup(): Promise<void> {
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
      config.lastResult[provider] = {
        success: result.success,
        timestamp,
      };
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

async function status(): Promise<void> {
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

  if (config.lastRun) {
    console.log(`\nLast run: ${config.lastRun}`);
  }

  if (config.lastResult.claude) {
    const { success, timestamp } = config.lastResult.claude;
    console.log(`Claude result: ${success ? "✓" : "✗"} at ${timestamp}`);
  }

  if (config.lastResult.codex) {
    const { success, timestamp } = config.lastResult.codex;
    console.log(`Codex result:  ${success ? "✓" : "✗"} at ${timestamp}`);
  }
}

async function uninstall(): Promise<void> {
  console.log("=== Uninstalling Warmy ===\n");

  let schedulerOk = false;
  let tokensOk = false;
  let configOk = false;

  try {
    await uninstallScheduler();
    schedulerOk = true;
  } catch (err) {
    console.error(`Failed to remove scheduler: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await removeToken("claude");
    await removeToken("codex");
    tokensOk = true;
  } catch (err) {
    console.error(`Failed to remove tokens: ${err instanceof Error ? err.message : String(err)}`);
  }

  const configPath = getConfigPath();
  const { rm } = await import("fs/promises");
  try {
    await rm(configPath, { force: true });
    configOk = true;
  } catch (err) {
    console.error(`Failed to remove config: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (schedulerOk) console.log("✓ Scheduler removed");
  if (tokensOk) console.log("✓ Tokens removed from Keychain");
  if (configOk) console.log("✓ Config file removed");
  console.log("\nWarmy uninstall complete.");
}

async function configEdit(): Promise<void> {
  const configPath = getConfigPath();
  const { execSync: exec } = await import("child_process");

  const editor = process.env.EDITOR || "vi";
  const editorBase = editor.split(/[\s/]/)[0].split("/").pop() || "";

  const safeEditors = ["vi", "vim", "nano", "code", "emacs", "subl", "pico"];
  if (!safeEditors.some((e) => editorBase === e)) {
    console.error("EDITOR must be one of: vi, vim, nano, code, emacs, subl");
    return;
  }

  if (!existsSync(configPath)) {
    await saveConfig({
      scheduleTime: "06:00",
      claudeEnabled: false,
      codexEnabled: false,
      lastRun: null,
      lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: WARMUP_INTERVAL_SECONDS,
      warmupMessage: "Hello Claude. Howdy?",
      lastResult: { claude: null, codex: null },
    });
  }

  try {
    exec(`${editor} "${configPath}"`, { stdio: "inherit" });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`Editor failed: ${error}`);
  }
}

async function setMessage(message: string): Promise<void> {
  if (!message) {
    console.error("Usage: warmy set-message <your warmup message>");
    return;
  }

  const config = await loadConfig();
  config.warmupMessage = message;
  await saveConfig(config);
  console.log(`✓ Warmup message set to: "${message}"`);
}

program.name("warmy").description("Warm up Claude Code and Codex CLI rate limit windows");

program.command("init").description("Interactive setup").action(init);

program.command("run").description("Run warmup now").action(runWarmup);

program.command("status").description("Show status").action(status);

program.command("uninstall").description("Remove scheduler and config").action(uninstall);

program.command("edit-config").description("Edit config file").action(configEdit);

program.command("set-message")
  .description("Set a custom warmup message")
  .argument("<message>", "The message to send during warmup")
  .action(setMessage);

export { init, runWarmup, status, uninstall, configEdit as editConfig, setMessage };

if (process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("warmy")) {
  program.parse();
}
