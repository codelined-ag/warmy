import { spawnSync } from "child_process";
import { accessSync, constants, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { type WarmupResult } from "./types.js";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const SPAWN_TIMEOUT_MS = 120_000;

function findClaudeBinary(): string {
  const pathDirs = (process.env.PATH || "").split(":");
  for (const dir of pathDirs) {
    if (!dir) continue;
    const candidate = join(dir, "claude");
    try {
      if (!existsSync(candidate)) continue;
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return "claude";
}

function getWarmupCwd(): string {
  const dir = join(homedir(), ".warmy");
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  } catch {
    return homedir();
  }
}

function firstLine(text: string, max = 240): string {
  const line = (text || "").split("\n").find((l) => l.trim().length > 0) || "";
  return line.trim().slice(0, max);
}

export async function warmupClaude(message: string): Promise<WarmupResult> {
  const claudeBin = findClaudeBinary();
  try {
    const result = spawnSync(
      claudeBin,
      [
        "-p",
        "--model",
        DEFAULT_MODEL,
        "--setting-sources",
        "user",
        "--output-format",
        "text",
        "--permission-mode",
        "default",
        "--disable-slash-commands",
        "--no-session-persistence",
        message,
      ],
      {
        encoding: "utf-8",
        timeout: SPAWN_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        cwd: getWarmupCwd(),
        env: { ...process.env, CI: "1" },
      }
    );

    if (result.error) {
      return {
        success: false,
        reply: null,
        error: firstLine(result.error.message),
      };
    }
    const exitCode = result.status ?? -1;
    if (exitCode !== 0) {
      const stderr = (result.stderr || "").toString();
      const stdout = (result.stdout || "").toString();
      return {
        success: false,
        reply: null,
        error:
          firstLine(stderr) ||
          firstLine(stdout) ||
          `claude -p failed with exit code ${exitCode}`,
      };
    }

    const reply = (result.stdout || "").toString().trim();
    return { success: true, reply: reply || "(empty)", error: null };
  } catch (err) {
    return {
      success: false,
      reply: null,
      error: firstLine(err instanceof Error ? err.message : String(err)),
    };
  }
}
