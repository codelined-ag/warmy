import { fileURLToPath } from "url";
import { loadConfig } from "../config.js";
import {
  DaemonAlreadyRunningError,
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
    if (err instanceof DaemonAlreadyRunningError) {
      console.log(`[warmy] ${err.message}; exiting cleanly.`);
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
    if (err instanceof DaemonAlreadyRunningError) return;
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
  let markerOk = true;
  try {
    setStoppedMarker();
  } catch (err) {
    markerOk = false;
    console.error(`Warning: failed to write stop marker: ${err instanceof Error ? err.message : String(err)}`);
    console.error("The watchdog cron may restart the daemon within 1 minute.");
  }

  const pid = await readDaemonPid();
  if (pid === null || !(await isDaemonRunning())) {
    if (markerOk) {
      console.log("Daemon not running. Stop marker set; run 'warmy start-daemon' to start.");
    } else {
      console.log("Daemon not running.");
    }
    return;
  }
  if (!verifyDaemonOwnership(pid)) {
    console.log("PID file does not match a running warmy daemon; not signaling.");
    return;
  }
  if (!safeKillWarmyDaemon(pid, "SIGTERM")) {
    console.error(`Failed to send SIGTERM to pid ${pid}.`);
    console.error("Run 'warmy restart-daemon' manually if needed.");
    return;
  }
  console.log(`Sent SIGTERM to daemon (pid ${pid}).`);
  const exited = await waitForExit(pid, 3000);
  if (!exited) {
    console.log(`Daemon did not exit; sending SIGKILL.`);
    safeKillWarmyDaemon(pid, "SIGKILL");
  }
  if (markerOk) {
    console.log("Stopped. Run 'warmy start-daemon' to start it again.");
  } else {
    console.log("Stopped (marker not written; watchdog may restart within 1 min).");
  }
}

export async function restartDaemon(): Promise<void> {
  if (await isDaemonRunning()) {
    const pid = await readDaemonPid();
    if (pid === null) {
      console.error("PID file is unreadable; refusing to restart.");
      return;
    }
    if (!verifyDaemonOwnership(pid)) {
      console.error("PID file does not match a warmy daemon; refusing to signal.");
      console.error("Inspect ~/.warmy/daemon.pid manually before retrying.");
      return;
    }
    if (safeKillWarmyDaemon(pid, "SIGTERM")) {
      console.log(`Sent SIGTERM to daemon (pid ${pid}).`);
      const exited = await waitForExit(pid, 3000);
      if (!exited) safeKillWarmyDaemon(pid, "SIGKILL");
    }
  }
  if (isDaemonStopped()) {
    clearStoppedMarker();
    console.log("Cleared stopped marker.");
  }
  const newPid = await startDaemonDetached(resolveWarmyPath());
  console.log(`Warmy daemon started (pid ${newPid}).`);
}
