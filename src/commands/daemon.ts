import { fileURLToPath } from "url";
import { loadConfig } from "../config.js";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  clearStoppedMarker,
  isDaemonRunning,
  isDaemonStopped,
  readDaemonPid,
  runDaemonLoop,
  setStoppedMarker,
  startDaemonDetached,
} from "../daemon.js";

export async function runDaemon(): Promise<void> {
  const config = await loadConfig();
  const interval = config.pollIntervalSeconds || DEFAULT_POLL_INTERVAL_SECONDS;
  await runDaemonLoop(interval);
}

function resolveWarmyPath(): string {
  return process.argv[1] || fileURLToPath(import.meta.url);
}

export async function ensureDaemon(): Promise<void> {
  if (isDaemonStopped()) {
    console.log("Stopped marker present (~/.warmy/stopped); refusing to start. Run 'warmy start-daemon' to override.");
    return;
  }
  if (await isDaemonRunning()) {
    const pid = await readDaemonPid();
    console.log(`Warmy daemon already running (pid ${pid}).`);
    return;
  }
  const pid = await startDaemonDetached(resolveWarmyPath());
  console.log(`Warmy daemon started (pid ${pid}).`);
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
    console.log("Warmy daemon is not running. Stopped marker set; watchdog will not restart it.");
    console.log("Run 'warmy start-daemon' to start it again.");
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Sent SIGTERM to daemon (pid ${pid}).`);
    const exited = await waitForExit(pid, 3000);
    if (!exited) {
      console.log(`Daemon did not exit; sending SIGKILL.`);
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
    console.log("Stopped marker set; watchdog will not restart it.");
    console.log("Run 'warmy start-daemon' to start it again.");
  } catch (err) {
    console.error(`Failed to stop daemon: ${err instanceof Error ? err.message : String(err)}`);
  }
}
