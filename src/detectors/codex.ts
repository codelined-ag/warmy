import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { execSync } from "child_process";

export interface CodexCredentials {
  apiKey: string | null;
  accessToken: string | null;
}

export async function detectCodexCredentials(): Promise<CodexCredentials> {
  const home = homedir();
  const codexHome = process.env.CODEX_HOME || join(home, ".codex");
  const authPath = join(codexHome, "auth.json");

  if (!existsSync(authPath)) {
    return { apiKey: null, accessToken: null };
  }

  try {
    const content = await readFile(authPath, "utf-8");
    const data = JSON.parse(content);

    const apiKey =
      typeof data.OPENAI_API_KEY === "string" &&
      data.OPENAI_API_KEY.startsWith("sk-")
        ? data.OPENAI_API_KEY
        : null;

    const accessToken =
      typeof data.tokens?.access_token === "string"
        ? data.tokens.access_token
        : null;

    return { apiKey, accessToken };
  } catch {
    return { apiKey: null, accessToken: null };
  }
}

export function isCodexInstalled(): boolean {
  try {
    execSync("codex --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
