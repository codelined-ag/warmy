import { getConfigPath, getWarmyDir } from "../config.js";
import { uninstallScheduler } from "../scheduler/index.js";
import { removeToken } from "../keyring.js";
import { isDaemonRunning, readDaemonPid, getPidFilePath, getDaemonLogPath, getStoppedMarkerPath, safeKillWarmyDaemon, verifyDaemonOwnership } from "../daemon.js";
import { join } from "path";

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

export async function uninstall(): Promise<void> {
  console.log("=== Uninstalling Warmy ===\n");

  let schedulerOk = false;
  let tokensOk = false;
  let configOk = false;
  let daemonOk = true;

  if (await isDaemonRunning()) {
    const pid = await readDaemonPid();
    daemonOk = false;
    if (pid !== null && verifyDaemonOwnership(pid)) {
      if (safeKillWarmyDaemon(pid, "SIGTERM")) {
        const exited = await waitForExit(pid, 3000);
        if (!exited) safeKillWarmyDaemon(pid, "SIGKILL");
        daemonOk = true;
      } else {
        console.error("Failed to send SIGTERM to daemon");
      }
    } else {
      console.error("PID file does not match a running warmy daemon; skipping kill");
      daemonOk = true;
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

  const { rm } = await import("fs/promises");

  const filesToClean = [
    getConfigPath(),
    getPidFilePath(),
    getDaemonLogPath(),
    getStoppedMarkerPath(),
    join(getWarmyDir(), "cron.log"),
    join(getWarmyDir(), "launchd.log"),
  ];

  let cleanupErrs = 0;
  for (const f of filesToClean) {
    try {
      await rm(f, { force: true });
    } catch {
      cleanupErrs++;
    }
  }
  configOk = cleanupErrs === 0;
  if (!configOk) {
    console.error(`Some warmy files could not be removed (${cleanupErrs} errors).`);
  }

  if (daemonOk) console.log("✓ Daemon stopped");
  if (schedulerOk) console.log("✓ Scheduler removed");
  if (tokensOk) console.log("✓ Tokens removed from Keychain");
  if (configOk) console.log("✓ Config and runtime files removed");
  console.log("\nWarmy uninstall complete.");
}
