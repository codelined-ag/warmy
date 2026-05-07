import { type WarmupResult } from "./types.js";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

function getOAuthToken(): string | null {
  try {
    const creds = JSON.parse(
      readFileSync(join(homedir(), ".claude", ".credentials.json"), "utf-8")
    );
    const token = creds?.claudeAiOauth?.accessToken;
    if (typeof token === "string" && token.startsWith("sk-ant-oat")) return token;
    return null;
  } catch {
    return null;
  }
}

export async function warmupClaude(message: string): Promise<WarmupResult> {
  const token = getOAuthToken();
  if (!token) {
    return { success: false, reply: null, error: "No Claude Code OAuth token found" };
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      const text = (await response.text()).slice(0, 300);
      const scrubbed = text
        .replace(/sk-ant-[A-Za-z0-9_-]+/g, "<redacted>")
        .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, "Bearer <redacted>");
      return {
        success: false,
        reply: null,
        error: `Anthropic API error: ${response.status} ${response.statusText} ${scrubbed}`,
      };
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const textBlock = data.content?.find((b) => b.type === "text");
    return { success: true, reply: textBlock?.text ?? "(no text)", error: null };
  } catch (err) {
    return {
      success: false,
      reply: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
