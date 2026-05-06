import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

interface SessionFile {
  updatedAt?: number;
}

export function getLastClaudeActivity(): number | null {
  try {
    const sessionsDir = join(homedir(), ".claude", "sessions");
    if (!existsSync(sessionsDir)) return null;

    const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) return null;

    let latest = 0;
    for (const file of files) {
      try {
        const data: SessionFile = JSON.parse(
          readFileSync(join(sessionsDir, file), "utf-8")
        );
        if (data.updatedAt && data.updatedAt > latest) {
          latest = data.updatedAt;
        }
      } catch {
      }
    }
    return latest > 0 ? latest : null;
  } catch {
    return null;
  }
}

export function getLastCodexActivity(): number | null {
  try {
    const dbPath = join(homedir(), ".codex", "logs_1.sqlite");
    if (!existsSync(dbPath)) return null;

    const result = execSync(
      `sqlite3 ${JSON.stringify(dbPath)} "SELECT MAX(ts) FROM logs"`,
      { encoding: "utf-8", stdio: "pipe" }
    ).trim();

    if (!result) return null;
    const ts = parseInt(result, 10);
    return isNaN(ts) ? null : ts * 1000;
  } catch {
    return null;
  }
}
