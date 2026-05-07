import { getConfigPath } from "../config.js";
import { uninstallScheduler } from "../scheduler/index.js";
import { removeToken } from "../keyring.js";
import { isDaemonRunning, readDaemonPid } from "../daemon.js";

export async function uninstall(): Promise<void> {
  console.log("=== Uninstalling Warmy ===\n");

  let schedulerOk = false;
  let tokensOk = false;
  let configOk = false;
  let daemonOk = true;

  if (await isDaemonRunning()) {
    const pid = await readDaemonPid();
    daemonOk = false;
    if (pid !== null) {
      try {
        process.kill(pid, "SIGTERM");
        daemonOk = true;
      } catch (err) {
        console.error(`Failed to stop daemon: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

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

  if (daemonOk) console.log("✓ Daemon stopped");
  if (schedulerOk) console.log("✓ Scheduler removed");
  if (tokensOk) console.log("✓ Tokens removed from Keychain");
  if (configOk) console.log("✓ Config file removed");
  console.log("\nWarmy uninstall complete.");
}
