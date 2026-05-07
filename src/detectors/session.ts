import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

const FIVE_HRS = 5 * 3600 * 1000;
const ONE_MIN = 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

function getNextWarmupImpl(oldestInWindow: number | null, newestInWindow: number | null): number | null {
  if (oldestInWindow === null) return 0;

  const resetTime = oldestInWindow + FIVE_HRS;

  if (newestInWindow !== null && newestInWindow >= resetTime - TEN_MIN) {
    return null;
  }

  return resetTime + ONE_MIN;
}

function parseHistoryLines(content: string): Array<{ timestamp: number }> {
  return content.trim().split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter((e): e is { timestamp: number } => e !== null && typeof e.timestamp === "number");
}

export function getNextClaudeWarmup(lastWarmupAt?: number | null): number | null {
  try {
    const historyPath = join(homedir(), ".claude", "history.jsonl");
    const now = Date.now();

    let oldest: number | null = null;
    let newest: number | null = null;

    if (existsSync(historyPath)) {
      const content = readFileSync(historyPath, "utf-8");
      const entries = parseHistoryLines(content);

      for (const e of entries) {
        if (e.timestamp < now - FIVE_HRS) continue;
        if (oldest === null || e.timestamp < oldest) oldest = e.timestamp;
        if (newest === null || e.timestamp > newest) newest = e.timestamp;
      }
    }

    if (lastWarmupAt && lastWarmupAt > now - FIVE_HRS) {
      if (oldest === null || lastWarmupAt < oldest) oldest = lastWarmupAt;
    }

    return getNextWarmupImpl(oldest, newest);
  } catch {
    return 0;
  }
}

export function getNextCodexWarmup(lastWarmupAt?: number | null): number | null {
  try {
    const now = Date.now();
    let oldest: number | null = null;
    let newest: number | null = null;

    const dbPath = join(homedir(), ".codex", "logs_1.sqlite");
    if (existsSync(dbPath)) {
      const cutoff = Math.floor((now - FIVE_HRS) / 1000);

      try {
        const oldestResult = execSync(
          `sqlite3 ${JSON.stringify(dbPath)} "SELECT MIN(ts) FROM logs WHERE ts > ${cutoff}"`,
          { encoding: "utf-8", stdio: "pipe" }
        ).trim();
        if (oldestResult && oldestResult !== "null") {
          oldest = parseInt(oldestResult, 10) * 1000;
        }

        const newestResult = execSync(
          `sqlite3 ${JSON.stringify(dbPath)} "SELECT MAX(ts) FROM logs WHERE ts > ${cutoff}"`,
          { encoding: "utf-8", stdio: "pipe" }
        ).trim();
        if (newestResult && newestResult !== "null") {
          newest = parseInt(newestResult, 10) * 1000;
        }
      } catch {
      }
    }

    if (lastWarmupAt && lastWarmupAt > now - FIVE_HRS) {
      if (oldest === null || lastWarmupAt < oldest) oldest = lastWarmupAt;
      if (newest === null || lastWarmupAt > newest) newest = lastWarmupAt;
    }

    return getNextWarmupImpl(oldest, newest);
  } catch {
    return 0;
  }
}
