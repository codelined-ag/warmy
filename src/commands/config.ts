import { existsSync } from "fs";
import { loadConfig, saveConfig, getConfigPath, detectTimezone } from "../config.js";
import { WARMUP_INTERVAL_SECONDS } from "../warmup/types.js";

export async function configEdit(): Promise<void> {
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
      scheduleTime: "06:00", claudeEnabled: false, codexEnabled: false,
      lastRun: null, lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: WARMUP_INTERVAL_SECONDS,
      pollIntervalSeconds: 30,
      warmupMessage: "Hey Claude, just warming up the session. How's it going?",
      lastResult: { claude: null, codex: null },
      timezone: detectTimezone(),
    });
  }

  try {
    exec(`${editor} "${configPath}"`, { stdio: "inherit" });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`Editor failed: ${error}`);
  }
}

export async function setMessage(message: string): Promise<void> {
  if (!message) {
    console.error("Usage: warmy set-message <your warmup message>");
    return;
  }

  const config = await loadConfig();
  config.warmupMessage = message;
  await saveConfig(config);
  console.log(`✓ Warmup message set to: "${message}"`);
}
