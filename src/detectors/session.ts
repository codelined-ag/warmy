import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

const FIVE_HOURS_MS = 5 * 3600 * 1000;
const ONE_MIN_MS = 60 * 1000;
const TEN_MIN_MS = 10 * 60 * 1000;

interface HistoryEntry { timestamp?: number }
interface SessionFile { pid?: number }

function isClaudeRunning(): boolean {
  try {
    const dir = join(homedir(), ".claude", "sessions");
    if (!existsSync(dir)) return false;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const data: SessionFile = JSON.parse(readFileSync(join(dir, f), "utf-8"));
        if (data.pid) { process.kill(data.pid, 0); return true; }
      } catch {}
    }
  } catch {}
  return false;
}

function readHistoryLines(path: string): string[] {
  try {
    return readFileSync(path, "utf-8").trim().split("\n").filter(Boolean);
  } catch { return []; }
}

export function getNextClaudeWarmup(): number | null {
  try {
    const historyPath = join(homedir(), ".claude", "history.jsonl");
    if (!existsSync(historyPath)) return Date.now();

    const lines = readHistoryLines(historyPath);
    if (lines.length === 0) return Date.now();

    const now = Date.now();
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const line of lines) {
      try {
        const entry: HistoryEntry = JSON.parse(line);
        const ts = entry.timestamp;
        if (!ts || ts < now - FIVE_HOURS_MS) continue;
        if (oldest === null || ts < oldest) oldest = ts;
        if (newest === null || ts > newest) newest = ts;
      } catch {}
    }

    if (oldest === null) return Date.now();

    const resetTime = oldest + FIVE_HOURS_MS;
    const within10min = newest !== null && newest >= resetTime - TEN_MIN_MS;

    if (within10min) return null;

    if (isClaudeRunning() && resetTime - now < TEN_MIN_MS) return null;

    return resetTime + ONE_MIN_MS;
  } catch { return Date.now(); }
}

export function getNextCodexWarmup(): number | null {
  try {
    const dbPath = join(homedir(), ".codex", "logs_1.sqlite");
    if (!existsSync(dbPath)) return Date.now();

    const now = Date.now();
    const cutoff = Math.floor((now - FIVE_HOURS_MS) / 1000);

    const oldestResult = execSync(
      `sqlite3 ${JSON.stringify(dbPath)} "SELECT MIN(ts) FROM logs WHERE ts > ${cutoff}"`,
      { encoding: "utf-8", stdio: "pipe" }
    ).trim();

    if (!oldestResult || oldestResult === "null") return Date.now();

    const oldestTs = parseInt(oldestResult, 10) * 1000;
    const resetTime = oldestTs + FIVE_HOURS_MS;

    const newestResult = execSync(
      `sqlite3 ${JSON.stringify(dbPath)} "SELECT MAX(ts) FROM logs WHERE ts > ${cutoff}"`,
      { encoding: "utf-8", stdio: "pipe" }
    ).trim();

    if (newestResult && newestResult !== "null") {
      const newestTs = parseInt(newestResult, 10) * 1000;
      if (newestTs >= resetTime - TEN_MIN_MS && newestTs <= resetTime) return null;
    }

    try {
      execSync("pgrep -x codex", { stdio: "pipe" });
      if (resetTime - now < TEN_MIN_MS) return null;
    } catch {}

    return resetTime + ONE_MIN_MS;
  } catch { return Date.now(); }
}
