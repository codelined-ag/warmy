import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

const FIVE_HRS = 5 * 3600 * 1000;
const ONE_MIN = 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

/**
 * The 5-hour rate limit window starts from the FIRST request in that window.
 * Find the oldest request in the last 5 hours. The reset is oldest + 5hr.
 * Warmup fires 1 minute after reset.
 * If user was active within 10 min before reset, skip (their usage already resets it).
 */
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

export function getNextClaudeWarmup(): number | null {
  try {
    const historyPath = join(homedir(), ".claude", "history.jsonl");
    if (!existsSync(historyPath)) return 0;

    const content = readFileSync(historyPath, "utf-8");
    const entries = parseHistoryLines(content);
    if (entries.length === 0) return 0;

    const now = Date.now();
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const e of entries) {
      if (e.timestamp < now - FIVE_HRS) continue;
      if (oldest === null || e.timestamp < oldest) oldest = e.timestamp;
      if (newest === null || e.timestamp > newest) newest = e.timestamp;
    }

    return getNextWarmupImpl(oldest, newest);
  } catch {
    return 0;
  }
}

export function getNextCodexWarmup(): number | null {
  try {
    const dbPath = join(homedir(), ".codex", "logs_1.sqlite");
    if (!existsSync(dbPath)) return 0;

    const now = Date.now();
    const cutoff = Math.floor((now - FIVE_HRS) / 1000);

    const oldestResult = execSync(
      `sqlite3 ${JSON.stringify(dbPath)} "SELECT MIN(ts) FROM logs WHERE ts > ${cutoff}"`,
      { encoding: "utf-8", stdio: "pipe" }
    ).trim();

    if (!oldestResult || oldestResult === "null") return 0;

    const oldestTs = parseInt(oldestResult, 10) * 1000;
    const resetTime = oldestTs + FIVE_HRS;

    const newestResult = execSync(
      `sqlite3 ${JSON.stringify(dbPath)} "SELECT MAX(ts) FROM logs WHERE ts > ${cutoff}"`,
      { encoding: "utf-8", stdio: "pipe" }
    ).trim();

    let newestTs: number | null = null;
    if (newestResult && newestResult !== "null") {
      newestTs = parseInt(newestResult, 10) * 1000;
    }

    return getNextWarmupImpl(oldestTs, newestTs);
  } catch {
    return 0;
  }
}
