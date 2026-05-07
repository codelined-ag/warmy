import { fileURLToPath } from "url";
import { loadConfig } from "../config.js";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  clearStoppedMarker,
  isDaemonRunning,
  isDaemonStopped,
  readDaemonPid,
  runDaemonLoop,
  safeKillWarmyDaemon,
  setStoppedMarker,
  startDaemonDetached,
  verifyDaemonOwnership,
} from "../daemon.js";

export async function runDaemon(): Promise<void> {
  try {
    const config = await loadConfig();
    const interval = config.pollIntervalSeconds || DEFAULT_POLL_INTERVAL_SECONDS;
    await runDaemonLoop(interval);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("Daemon already running")) {
      console.log(`[warmy] ${msg}; exiting cleanly.`);
      process.exit(0);
    }
    throw err;
  }
}

function resolveWarmyPath(): string {
  return process.argv[1] || fileURLToPath(import.meta.url);
}

export async function ensureDaemon(): Promise<void> {
  if (isDaemonStopped()) {
    console.log("Stopped by user (~/.warmy/stopped present). Run 'warmy start-daemon' to start.");
    return;
  }
  if (await isDaemonRunning()) {
    const pid = await readDaemonPid();
    console.log(`Warmy daemon already running (pid ${pid}).`);
    return;
  }
  try {
    const pid = await startDaemonDetached(resolveWarmyPath());
    console.log(`Warmy daemon started (pid ${pid}).`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("Daemon already running")) return;
    throw err;
  }
}

export async function startDaemonCmd(): Promise<void> {
  if (isDaemonStopped()) {
    clearStoppedMarker();
    console.log("Cleared stopped marker.");
  }
  if (await isDaemonRunning()) {
    const pid = await readDaemonPid();
    console.log(`Warmy daemon already running (pid ${pid}).`);
    return;
  }
  const pid = await startDaemonDetached(resolveWarmyPath());
  console.log(`Warmy daemon started (pid ${pid}).`);
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ESRCH") return true;
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

export async function stopDaemon(): Promise<void> {
  setStoppedMarker();
  const pid = await readDaemonPid();
  if (pid === null || !(await isDaemonRunning())) {
    console.log("Daemon not running. Stop marker set; run 'warmy start-daemon' to start.");
    return;
  }
  if (!verifyDaemonOwnership(pid)) {
    console.log("PID file does not match a running warmy daemon. Stop marker set anyway.");
    return;
  }
  if (!safeKillWarmyDaemon(pid, "SIGTERM")) {
    console.error(`Failed to send SIGTERM to pid ${pid}.`);
    console.error("Run 'warmy stop-daemon && warmy start-daemon' manually if needed.");
    return;
  }
  console.log(`Sent SIGTERM to daemon (pid ${pid}).`);
  const exited = await waitForExit(pid, 3000);
  if (!exited) {
    console.log(`Daemon did not exit; sending SIGKILL.`);
    safeKillWarmyDaemon(pid, "SIGKILL");
  }
  console.log("Stopped. Run 'warmy start-daemon' to start it again.");
}

export async function restartDaemon(): Promise<void> {
  if (await isDaemonRunning()) {
    const pid = await readDaemonPid();
    if (pid !== null && verifyDaemonOwnership(pid)) {
      if (safeKillWarmyDaemon(pid, "SIGTERM")) {
        console.log(`Sent SIGTERM to daemon (pid ${pid}).`);
        const exited = await waitForExit(pid, 3000);
        if (!exited) safeKillWarmyDaemon(pid, "SIGKILL");
      }
    }
  }
  if (isDaemonStopped()) {
    clearStoppedMarker();
    console.log("Cleared stopped marker.");
  }
  const pid = await startDaemonDetached(resolveWarmyPath());
  console.log(`Warmy daemon started (pid ${pid}).`);
}
