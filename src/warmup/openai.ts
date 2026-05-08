import { spawnSync } from "child_process";
import { existsSync, readFileSync, accessSync, constants } from "fs";
import { join } from "path";
import { type WarmupResult } from "./types.js";

function findCodexBinary(): string {
  const pathDirs = (process.env.PATH || "").split(":");
  for (const dir of pathDirs) {
    try {
      const candidate = join(dir, "codex");
      if (!existsSync(candidate)) continue;
      try { accessSync(candidate, constants.X_OK); } catch { continue; }
      try {
        const content = readFileSync(candidate, "utf-8");
        if (content.includes("Session Vault wrapper")) continue;
      } catch { }
      return candidate;
    } catch { continue; }
  }
  return "codex";
}

export function warmupCodex(message: string): WarmupResult {
  try {
    const codexBin = findCodexBinary();
    const result = spawnSync(
      codexBin,
      [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        message,
      ],
      {
        encoding: "utf-8",
        timeout: 120_000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      }
    );

    if (result.error) {
      return {
        success: false,
        reply: null,
        error: result.error.message.split("\n")[0].slice(0, 200),
      };
    }
    if ((result.status ?? 0) !== 0) {
      const errText = (result.stderr || "").toString().split("\n")[0].slice(0, 200);
      return {
        success: false,
        reply: null,
        error: errText || `codex exec failed with code ${result.status}`,
      };
    }

    const reply = (result.stdout || "").toString().trim();
    return { success: true, reply: reply || "(empty)", error: null };
  } catch (err) {
    return {
      success: false,
      reply: null,
      error: (err instanceof Error ? err.message : String(err)).split("\n")[0].slice(0, 200),
    };
  }
}
