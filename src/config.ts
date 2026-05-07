import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { homedir, platform } from "os";
import { existsSync, lstatSync, mkdirSync, renameSync } from "fs";
import { WARMUP_INTERVAL_SECONDS } from "./warmup/types.js";

export interface WarmupResultEntry {
  success: boolean;
  timestamp: string;
  error?: string | null;
}

export interface WarmyStats {
  claudeWarmups: number;
  codexWarmups: number;
  claudeFailures: number;
  codexFailures: number;
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
  stats: WarmyStats;
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
  stats: {
    claudeWarmups: 0,
    codexWarmups: 0,
    claudeFailures: 0,
    codexFailures: 0,
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
    const merged = { ...DEFAULT_CONFIG, ...data };
    merged.stats = { ...DEFAULT_CONFIG.stats, ...(data.stats || {}) };
    return merged;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function ensureSafeWarmyDirSync(): string {
  const dir = getWarmyDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }
  const lst = lstatSync(dir);
  if (lst.isSymbolicLink()) {
    throw new Error(`Refusing to use ${dir}: it is a symlink`);
  }
  if (typeof process.geteuid === "function" && lst.uid !== process.geteuid()) {
    throw new Error(`Refusing to use ${dir}: owner uid ${lst.uid} != ours ${process.geteuid()}`);
  }
  return dir;
}

export async function saveConfig(config: WarmyConfig): Promise<void> {
  ensureSafeWarmyDirSync();
  const configPath = getConfigPath();

  if (existsSync(configPath)) {
    const lst = lstatSync(configPath);
    if (lst.isSymbolicLink()) {
      throw new Error(`Refusing to save: ${configPath} is a symlink`);
    }
  }

  const tmpPath = `${configPath}.${process.pid}.tmp`;
  await writeFile(tmpPath, JSON.stringify(config, null, 2), { encoding: "utf-8", mode: 0o600 });
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
