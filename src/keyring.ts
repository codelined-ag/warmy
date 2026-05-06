import keytar from "keytar";

const SERVICE = "warmy";
const ACCOUNT_CLAUDE = "claude-code";
const ACCOUNT_CODEX = "codex-cli";

export async function storeToken(
  account: "claude" | "codex",
  token: string
): Promise<void> {
  const acct = account === "claude" ? ACCOUNT_CLAUDE : ACCOUNT_CODEX;
  await keytar.setPassword(SERVICE, acct, token);
}

export async function getToken(account: "claude" | "codex"): Promise<string | null> {
  const acct = account === "claude" ? ACCOUNT_CLAUDE : ACCOUNT_CODEX;
  return await keytar.getPassword(SERVICE, acct);
}

export async function removeToken(account: "claude" | "codex"): Promise<boolean> {
  const acct = account === "claude" ? ACCOUNT_CLAUDE : ACCOUNT_CODEX;
  return await keytar.deletePassword(SERVICE, acct);
}

export function getKeyringServiceName(): string {
  return SERVICE;
}
