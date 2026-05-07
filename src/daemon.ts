import { writeFile, mkdir, readFile, rm } from "fs/promises";
import { join } from "path";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { getWarmyDir } from "./config.js";

export const DEFAULT_POLL_INTERVAL_SECONDS = 30;

export function getPidFilePath(): string {
  return join(getWarmyDir(), "daemon.pid");
}

export function getDaemonLogPath(): string {
  return join(getWarmyDir(), "daemon.log");
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === "EPERM";
  }
}

export async function readDaemonPid(): Promise<number | null> {
  const pidFile = getPidFilePath();
  if (!existsSync(pidFile)) return null;
  try {
    const raw = await readFile(pidFile, "utf-8");
    const pid = parseInt(raw.trim(), 10);
    if (!Number.isFinite(pid) || pid <= 0) return null;
    return pid;
  } catch {
    return null;
  }
}

export async function isDaemonRunning(): Promise<boolean> {
  const pid = await readDaemonPid();
  if (pid === null) return false;
  return isProcessAlive(pid);
}

async function writePidFile(pid: number): Promise<void> {
  const dir = getWarmyDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(getPidFilePath(), String(pid), "utf-8");
}

async function clearPidFile(): Promise<void> {
  try {
    await rm(getPidFilePath(), { force: true });
  } catch {
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startDaemonDetached(warmyPath: string): Promise<number> {
  const dir = getWarmyDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });

  const { openSync } = await import("fs");
  const logPath = getDaemonLogPath();
  const out = openSync(logPath, "a");
  const err = openSync(logPath, "a");

  const child = spawn(process.execPath, [warmyPath, "daemon"], {
    detached: true,
    stdio: ["ignore", out, err],
    env: { ...process.env, WARMY_DAEMON_DETACHED: "1" },
  });
  child.unref();

  if (!child.pid) {
    throw new Error("Failed to spawn daemon process");
  }
  return child.pid;
}

export async function runDaemonLoop(pollIntervalSeconds: number): Promise<void> {
  if (await isDaemonRunning()) {
    const existing = await readDaemonPid();
    throw new Error(`Daemon already running (pid ${existing})`);
  }

  await writePidFile(process.pid);

  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    void clearPidFile().finally(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("exit", () => {
    void clearPidFile();
  });

  const interval = Math.max(5, pollIntervalSeconds) * 1000;
  const { runWarmup } = await import("./commands/run.js");

  console.log(`[warmy] daemon started (pid ${process.pid}, poll=${pollIntervalSeconds}s)`);

  while (!stopping) {
    const tickStart = Date.now();
    try {
      await runWarmup();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[warmy] daemon tick error: ${msg}`);
    }
    const elapsed = Date.now() - tickStart;
    const wait = Math.max(1000, interval - elapsed);
    await sleep(wait);
  }
}
