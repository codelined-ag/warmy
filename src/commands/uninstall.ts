import { getConfigPath } from "../config.js";
import { uninstallScheduler } from "../scheduler/index.js";
import { removeToken } from "../keyring.js";

export async function uninstall(): Promise<void> {
  console.log("=== Uninstalling Warmy ===\n");

  let schedulerOk = false;
  let tokensOk = false;
  let configOk = false;

  try {
    await uninstallScheduler();
    schedulerOk = true;
  } catch (err) {
    console.error(`Failed to remove scheduler: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await removeToken("claude");
    await removeToken("codex");
    tokensOk = true;
  } catch (err) {
    console.error(`Failed to remove tokens: ${err instanceof Error ? err.message : String(err)}`);
  }

  const configPath = getConfigPath();
  const { rm } = await import("fs/promises");
  try {
    await rm(configPath, { force: true });
    configOk = true;
  } catch (err) {
    console.error(`Failed to remove config: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (schedulerOk) console.log("✓ Scheduler removed");
  if (tokensOk) console.log("✓ Tokens removed from Keychain");
  if (configOk) console.log("✓ Config file removed");
  console.log("\nWarmy uninstall complete.");
}
