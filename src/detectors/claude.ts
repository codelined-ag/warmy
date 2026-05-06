import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { execSync } from "child_process";

export interface ClaudeCredentials {
  apiKey: string | null;
  oauthToken: string | null;
}

export async function detectClaudeCredentials(): Promise<ClaudeCredentials> {
  const home = homedir();
  const credentialsPath = join(home, ".claude", ".credentials.json");

  if (!existsSync(credentialsPath)) {
    return { apiKey: null, oauthToken: null };
  }

  try {
    const content = await readFile(credentialsPath, "utf-8");
    const data = JSON.parse(content);

    let apiKey: string | null = null;
    let oauthToken: string | null = null;

    if (
      typeof data?.anthropic?.credentials?.key === "string" &&
      data.anthropic.credentials.key.startsWith("sk-ant-api")
    ) {
      apiKey = data.anthropic.credentials.key;
    }

    if (
      typeof data?.claudeAiOauth?.accessToken === "string" &&
      data.claudeAiOauth.accessToken.startsWith("sk-ant-oat")
    ) {
      oauthToken = data.claudeAiOauth.accessToken;
    }

    return { apiKey, oauthToken };
  } catch {
    return { apiKey: null, oauthToken: null };
  }
}

export function isClaudeInstalled(): boolean {
  try {
    execSync("claude --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
