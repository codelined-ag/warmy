import { createInterface } from "readline";
import { platform } from "os";
import { fileURLToPath } from "url";
import { isClaudeInstalled } from "../detectors/claude.js";
import { isCodexInstalled } from "../detectors/codex.js";
import { loadConfig, saveConfig, getWarmyDir, getPlatform, detectTimezone, type WarmyConfig } from "../config.js";
import { WARMUP_INTERVAL_SECONDS } from "../warmup/types.js";
import { installScheduler } from "../scheduler/index.js";

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
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

export async function init(): Promise<void> {
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

  const defaultTz = cfg.timezone || detectTimezone();
  const tzAnswer = await ask(`Timezone [${defaultTz}]: `);
  const timezone = tzAnswer.trim() || defaultTz;

  const newConfig: WarmyConfig = {
    ...cfg, scheduleTime, timezone,
    claudeEnabled: enableClaude, codexEnabled: enableCodex,
    lastWarmupAt: cfg.lastWarmupAt || { claude: null, codex: null },
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
