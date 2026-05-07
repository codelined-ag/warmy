import { execSync } from "child_process";
import { type WarmupResult } from "./types.js";

export function warmupCodex(message: string): WarmupResult {
  try {
    const reply = execSync(
      `codex exec --ephemeral --dangerously-bypass-approvals-and-sandbox --sandbox read-only ${JSON.stringify(message)}`,
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
