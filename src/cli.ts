#!/usr/bin/env node

import { Command } from "commander";
import { createInterface } from "readline";
import { platform } from "os";
import { detectClaudeCredentials, isClaudeInstalled } from "./detectors/claude.js";
import { detectCodexCredentials, isCodexInstalled } from "./detectors/codex.js";
import { warmupAnthropic } from "./warmup/anthropic.js";
import { warmupOpenAI } from "./warmup/openai.js";
import { storeToken, getToken, removeToken } from "./keyring.js";
import {
  loadConfig,
  saveConfig,
  getWarmyDir,
  getConfigPath,
  getPlatform,
  shouldWarmup,
  type WarmyConfig,
} from "./config.js";
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

  console.log("=== Auto-detecting credentials ===\n");

  let claudeToken: string | null = null;
  let codexToken: string | null = null;

  if (claudeDetected) {
    const creds = await detectClaudeCredentials();
    if (creds.apiKey) {
      console.log(`Claude Code API key found in ~/.claude/.credentials.json`);
      claudeToken = creds.apiKey;
    } else {
      console.log(`Claude Code API key not found in local credentials.`);
      console.log(`  Run 'claude setup-token' to generate a long-lived token.`);
    }
  }

  if (codexDetected) {
    const creds = await detectCodexCredentials();
    if (creds.apiKey) {
      console.log(`Codex CLI API key found in ~/.codex/auth.json`);
      codexToken = creds.apiKey;
    } else if (creds.accessToken) {
      console.log(`Codex CLI access token found (ChatGPT OAuth)`);
      codexToken = creds.accessToken;
    } else {
      console.log(`Codex CLI credentials not found.`);
      console.log(`  Run 'codex login' or set OPENAI_API_KEY environment variable.`);
    }
  }

  console.log("");

  const enableClaude = await askYesNo(
    "Enable Claude Code warmup?",
    claudeToken !== null
  );

  let claudeTokenToStore: string | null = null;
  if (enableClaude) {
    if (claudeToken) {
      const confirm = await askYesNo("Store detected token in OS Keychain?", true);
      if (confirm) claudeTokenToStore = claudeToken;
    } else {
      console.log(
        "\nPlease provide your Claude Code OAuth token (from 'claude setup-token'):"
      );
      const token = await ask("Token (sk-ant-oat01-...): ");
      if (token.trim().startsWith("sk-ant-")) {
        claudeTokenToStore = token.trim();
      } else {
        console.log("Invalid token format. Skipping Claude Code warmup.");
      }
    }
  }

  const enableCodex = await askYesNo(
    "Enable Codex CLI warmup?",
    codexToken !== null
  );

  let codexTokenToStore: string | null = null;
  if (enableCodex) {
    if (codexToken) {
      const confirm = await askYesNo("Store detected token in OS Keychain?", true);
      if (confirm) codexTokenToStore = codexToken;
    } else {
      console.log(
        "\nPlease provide your OpenAI API key (from platform.openai.com/api-keys):"
      );
      const token = await ask("API Key (sk-...): ");
      if (token.trim().startsWith("sk-")) {
        codexTokenToStore = token.trim();
      } else {
        console.log("Invalid token format. Skipping Codex CLI warmup.");
      }
    }
  }

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

  if (claudeTokenToStore) {
    await storeToken("claude", claudeTokenToStore);
    console.log("✓ Claude Code token stored in OS Keychain");
  }

  if (codexTokenToStore) {
    await storeToken("codex", codexTokenToStore);
    console.log("✓ Codex CLI token stored in OS Keychain");
  }

  const newConfig: WarmyConfig = {
    ...cfg,
    scheduleTime,
    claudeEnabled: enableClaude && claudeTokenToStore !== null,
    codexEnabled: enableCodex && codexTokenToStore !== null,
    lastWarmupAt: {
      claude: null,
      codex: null,
    },
    warmupIntervalSeconds: 4 * 60 + 59,
  };

  await saveConfig(newConfig);

  console.log("\n=== Installing scheduler ===\n");

  try {
    await installScheduler(process.argv[1] || "warmy");
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
  const interval = config.warmupIntervalSeconds;

  console.log(`[${timestamp}] Warmy starting...\n`);

  let needsClaudeWarmup = config.claudeEnabled &&
    shouldWarmup(config.lastWarmupAt.claude, interval);
  let needsCodexWarmup = config.codexEnabled &&
    shouldWarmup(config.lastWarmupAt.codex, interval);

  if (config.claudeEnabled && needsClaudeWarmup) {
    const token = await getToken("claude");
    if (token) {
      console.log("Warming up Claude Code...");
      const result = await warmupAnthropic(token);
      if (result.success) {
        console.log(`✓ Claude Code warmup succeeded: "${result.reply}"`);
        config.lastWarmupAt.claude = timestamp;
      } else {
        console.error(`✗ Claude Code warmup failed: ${result.error}`);
      }
      config.lastResult.claude = {
        success: result.success,
        timestamp,
      };
    } else {
      console.warn("⚠ Claude Code enabled but no token found in Keychain");
    }
  } else if (config.claudeEnabled) {
    const next = config.lastWarmupAt.claude
      ? new Date(new Date(config.lastWarmupAt.claude).getTime() + interval * 1000).toISOString()
      : "now";
    console.log(`○ Claude Code: next warmup at ${next}`);
  } else {
    console.log("○ Claude Code: disabled");
  }

  if (config.codexEnabled && needsCodexWarmup) {
    const token = await getToken("codex");
    if (token) {
      console.log("Warming up Codex CLI...");
      const result = await warmupOpenAI(token);
      if (result.success) {
        console.log(`✓ Codex CLI warmup succeeded: "${result.reply}"`);
        config.lastWarmupAt.codex = timestamp;
      } else {
        console.error(`✗ Codex CLI warmup failed: ${result.error}`);
      }
      config.lastResult.codex = {
        success: result.success,
        timestamp,
      };
    } else {
      console.warn("⚠ Codex CLI enabled but no token found in Keychain");
    }
  } else if (config.codexEnabled) {
    const next = config.lastWarmupAt.codex
      ? new Date(new Date(config.lastWarmupAt.codex).getTime() + interval * 1000).toISOString()
      : "now";
    console.log(`○ Codex CLI: next warmup at ${next}`);
  } else {
    console.log("○ Codex CLI: disabled");
  }

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
  console.log(`Warmup interval: ${config.warmupIntervalSeconds}s before 5hr window expires`);
  console.log(`Claude Code: ${config.claudeEnabled ? "✓ enabled" : "✗ disabled"}`);
  console.log(`Codex CLI:   ${config.codexEnabled ? "✓ enabled" : "✗ disabled"}`);

  if (config.lastWarmupAt.claude) {
    const next = new Date(new Date(config.lastWarmupAt.claude).getTime() + config.warmupIntervalSeconds * 1000).toISOString();
    console.log(`\nClaude next: ${next}`);
  }

  if (config.lastWarmupAt.codex) {
    const next = new Date(new Date(config.lastWarmupAt.codex).getTime() + config.warmupIntervalSeconds * 1000).toISOString();
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

  await uninstallScheduler();

  await removeToken("claude");
  await removeToken("codex");

  const configPath = getConfigPath();
  const { rm } = await import("fs/promises");
  try {
    await rm(configPath, { force: true });
  } catch {
    // ignore
  }

  console.log("✓ Scheduler removed");
  console.log("✓ Tokens removed from Keychain");
  console.log("✓ Config file removed");
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
      warmupIntervalSeconds: 4 * 60 + 59,
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

program.name("warmy").description("Warm up Claude Code and Codex CLI rate limit windows");

program.command("init").description("Interactive setup").action(init);

program.command("run").description("Run warmup now").action(runWarmup);

program.command("status").description("Show status").action(status);

program.command("uninstall").description("Remove scheduler and config").action(uninstall);

program.command("config").description("Edit config file").action(configEdit);

program.parse();
