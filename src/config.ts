import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir, platform } from "os";
import { existsSync, renameSync, unlinkSync } from "fs";
import { WARMUP_INTERVAL_SECONDS } from "./warmup/types.js";

export interface WarmupResultEntry {
  success: boolean;
  timestamp: string;
  error?: string | null;
}

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
  pollIntervalSeconds: number;
  warmupMessage: string;
  lastResult: {
    claude: WarmupResultEntry | null;
    codex: WarmupResultEntry | null;
  };
  timezone: string;
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
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
  warmupIntervalSeconds: WARMUP_INTERVAL_SECONDS,
  pollIntervalSeconds: 30,
  warmupMessage: "Hey Claude, just warming up the session. How's it going?",
  lastResult: {
    claude: null,
    codex: null,
  },
  timezone: detectTimezone(),
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

export function formatInTimezone(isoString: string | null, tz: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", { timeZone: tz, timeStyle: "medium", dateStyle: "short" }) + ` ${tz}`;
  } catch {
    return isoString;
  }
}

export function getPlatform(): "macos" | "linux" | "windows" {
  const p = platform();
  if (p === "darwin") return "macos";
  if (p === "win32") return "windows";
  return "linux";
}
