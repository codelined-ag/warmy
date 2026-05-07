import { execSync } from "child_process";
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
    const reply = execSync(
      `${JSON.stringify(codexBin)} exec --ephemeral --dangerously-bypass-approvals-and-sandbox --sandbox read-only ${JSON.stringify(message)}`,
      {
        encoding: "utf-8",
        timeout: 120_000,
        stdio: ["pipe", "pipe", "pipe"],
      }
    ).trim();
    return { success: true, reply: reply || "(empty)", error: null };
  } catch (err) {
    return {
      success: false,
      reply: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
