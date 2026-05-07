import { fileURLToPath } from "url";
import { loadConfig } from "../config.js";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  isDaemonRunning,
  readDaemonPid,
  runDaemonLoop,
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
  if (await isDaemonRunning()) {
    const pid = await readDaemonPid();
    console.log(`Warmy daemon already running (pid ${pid}).`);
    return;
  }
  const pid = await startDaemonDetached(resolveWarmyPath());
  console.log(`Warmy daemon started (pid ${pid}).`);
}

export async function stopDaemon(): Promise<void> {
  const pid = await readDaemonPid();
  if (pid === null || !(await isDaemonRunning())) {
    console.log("Warmy daemon is not running.");
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Sent SIGTERM to daemon (pid ${pid}).`);
  } catch (err) {
    console.error(`Failed to stop daemon: ${err instanceof Error ? err.message : String(err)}`);
  }
}
