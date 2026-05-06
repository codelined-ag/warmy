import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir, platform } from "os";
import { existsSync } from "fs";
import { renameSync, unlinkSync } from "fs";

export interface WarmyConfig {
  scheduleTime: string;
  claudeEnabled: boolean;
  codexEnabled: boolean;
  lastRun: string | null;
  lastWarmupAt: {
    claude: string | null;
    codex: string | null;
  };
  warmupIntervalSeconds: number;
  lastResult: {
    claude: { success: boolean; timestamp: string } | null;
    codex: { success: boolean; timestamp: string } | null;
  };
}

const DEFAULT_CONFIG: WarmyConfig = {
  scheduleTime: "06:00",
  claudeEnabled: false,
  codexEnabled: false,
  lastRun: null,
  lastWarmupAt: {
    claude: null,
    codex: null,
  },
  warmupIntervalSeconds: 4 * 60 + 59,
  lastResult: {
    claude: null,
    codex: null,
  },
};

export function getConfigPath(): string {
  const home = homedir();
  return join(home, ".warmy", "config.json");
}

export function getWarmyDir(): string {
  const home = homedir();
  return join(home, ".warmy");
}

export async function loadConfig(): Promise<WarmyConfig> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    const data = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: WarmyConfig): Promise<void> {
  const dir = getWarmyDir();
  const configPath = getConfigPath();

  await mkdir(dir, { recursive: true, mode: 0o700 });

  const tmpPath = `${configPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(config, null, 2), "utf-8");

  try {
    unlinkSync(configPath);
  } catch {
    // ignore if doesn't exist
  }
  renameSync(tmpPath, configPath);
}

export function shouldWarmup(lastWarmupAt: string | null, intervalSeconds: number): boolean {
  if (!lastWarmupAt) return true;

  const lastWarmup = new Date(lastWarmupAt).getTime();
  const now = Date.now();
  const elapsed = (now - lastWarmup) / 1000;

  return elapsed >= intervalSeconds;
}

export function getPlatform(): "macos" | "linux" | "windows" {
  const p = platform();
  if (p === "darwin") return "macos";
  if (p === "win32") return "windows";
  return "linux";
}
