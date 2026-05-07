import { readFile } from "fs/promises";
import { join } from "path";
import { spawn } from "child_process";
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "fs";
import { getWarmyDir } from "./config.js";

export const DEFAULT_POLL_INTERVAL_SECONDS = 30;
const DAEMON_OWNER_TAG = "warmy-daemon";
const MAX_LOG_BYTES = 5 * 1024 * 1024;

export function getPidFilePath(): string {
  return join(getWarmyDir(), "daemon.pid");
}

export function getDaemonLogPath(): string {
  return join(getWarmyDir(), "daemon.log");
}

export function getStoppedMarkerPath(): string {
  return join(getWarmyDir(), "stopped");
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === "EPERM";
  }
}

interface PidRecord {
  pid: number;
  tag: string;
  startedAt: string;
}

function parsePidRecord(raw: string): PidRecord | null {
  try {
    const parsed = JSON.parse(raw.trim());
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.pid === "number" &&
      typeof parsed.tag === "string"
    ) {
      return parsed as PidRecord;
    }
  } catch {
  }
  const pid = parseInt(raw.trim(), 10);
  if (Number.isFinite(pid) && pid > 0) {
    return { pid, tag: "legacy", startedAt: "" };
  }
  return null;
}

export async function readDaemonPid(): Promise<number | null> {
  const record = await readDaemonRecord();
  return record?.pid ?? null;
}

async function readDaemonRecord(): Promise<PidRecord | null> {
  const pidFile = getPidFilePath();
  if (!existsSync(pidFile)) return null;
  try {
    const raw = await readFile(pidFile, "utf-8");
    return parsePidRecord(raw);
  } catch {
    return null;
  }
}

function readRecordSync(): PidRecord | null {
  const pidFile = getPidFilePath();
  try {
    if (!existsSync(pidFile)) return null;
    return parsePidRecord(readFileSync(pidFile, "utf-8"));
  } catch {
    return null;
  }
}

export async function isDaemonRunning(): Promise<boolean> {
  const record = await readDaemonRecord();
  if (record === null) return false;
  if (record.tag !== DAEMON_OWNER_TAG && record.tag !== "legacy") return false;
  return isProcessAlive(record.pid);
}

export function isDaemonStopped(): boolean {
  return existsSync(getStoppedMarkerPath());
}

export function setStoppedMarker(): void {
  try {
    ensureSafeWarmyDir();
  } catch {
    return;
  }
  const path = getStoppedMarkerPath();
  try {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
      unlinkSync(path);
    }
  } catch {
  }
  writeFileSync(path, new Date().toISOString(), { mode: 0o600 });
}

export function clearStoppedMarker(): void {
  try {
    unlinkSync(getStoppedMarkerPath());
  } catch {
  }
}

function clearPidFileSync(onlyIfMine: boolean): void {
  try {
    const record = readRecordSync();
    if (onlyIfMine && record?.pid !== process.pid) return;
    unlinkSync(getPidFilePath());
  } catch {
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureSafeWarmyDir(): string {
  const dir = getWarmyDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const lst = lstatSync(dir);
  if (lst.isSymbolicLink()) {
    throw new Error(`Refusing to use ${dir}: it is a symlink`);
  }
  if (typeof process.geteuid === "function" && lst.uid !== process.geteuid()) {
    throw new Error(`Refusing to use ${dir}: owner uid ${lst.uid} != ours ${process.geteuid()}`);
  }
  return dir;
}

function openNoFollow(path: string, flags: number, mode: number): number {
  return openSync(path, flags | fsConstants.O_NOFOLLOW, mode);
}

function rotateDaemonLogIfLarge(): void {
  const logPath = getDaemonLogPath();
  if (!existsSync(logPath)) return;
  try {
    const lst = lstatSync(logPath);
    if (lst.isSymbolicLink()) {
      unlinkSync(logPath);
      return;
    }
    if (lst.size >= MAX_LOG_BYTES) {
      const rotated = `${logPath}.1`;
      try { unlinkSync(rotated); } catch {}
      renameSync(logPath, rotated);
    }
  } catch {
  }
}

export async function startDaemonDetached(warmyPath: string): Promise<number> {
  ensureSafeWarmyDir();
  rotateDaemonLogIfLarge();

  const logPath = getDaemonLogPath();
  const flags = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_APPEND;
  const out = openNoFollow(logPath, flags, 0o600);

  const child = spawn(process.execPath, [warmyPath, "daemon"], {
    detached: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, WARMY_DAEMON_DETACHED: "1" },
  });
  child.unref();

  closeSync(out);

  if (!child.pid) {
    throw new Error("Failed to spawn daemon process");
  }
  return child.pid;
}

function acquirePidFile(): void {
  ensureSafeWarmyDir();
  const pidFile = getPidFilePath();
  const record: PidRecord = {
    pid: process.pid,
    tag: DAEMON_OWNER_TAG,
    startedAt: new Date().toISOString(),
  };
  const payload = JSON.stringify(record);

  if (existsSync(pidFile)) {
    try {
      const lst = lstatSync(pidFile);
      if (lst.isSymbolicLink()) {
        unlinkSync(pidFile);
      }
    } catch {
    }
  }

  const flags =
    fsConstants.O_WRONLY |
    fsConstants.O_CREAT |
    fsConstants.O_EXCL |
    fsConstants.O_NOFOLLOW;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(pidFile, flags, 0o600);
      try {
        writeSync(fd, payload);
      } finally {
        closeSync(fd);
      }
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw err;
      }
      const existing = readRecordSync();
      if (existing && isProcessAlive(existing.pid) && existing.pid !== process.pid) {
        throw new Error(`Daemon already running (pid ${existing.pid})`);
      }
      try {
        unlinkSync(pidFile);
      } catch {
      }
    }
  }
  throw new Error("Failed to acquire daemon PID file");
}

export async function runDaemonLoop(pollIntervalSeconds: number): Promise<void> {
  if (isDaemonStopped()) {
    console.log("[warmy] stopped marker present (~/.warmy/stopped); not starting daemon");
    return;
  }

  ensureSafeWarmyDir();
  rotateDaemonLogIfLarge();
  acquirePidFile();

  let stopping = false;
  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    console.log(`[warmy] received ${signal}, shutting down`);
    clearPidFileSync(true);
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("exit", () => {
    clearPidFileSync(true);
  });

  const interval = Math.max(5, pollIntervalSeconds) * 1000;
  const { runWarmup } = await import("./commands/run.js");
  const { loadConfig, saveConfig } = await import("./config.js");

  try {
    const cfg = await loadConfig();
    cfg.stats.daemonStartedAt = new Date().toISOString();
    await saveConfig(cfg);
  } catch (err) {
    console.error(`[warmy] could not record daemon start: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log(`[warmy] daemon started (pid ${process.pid}, poll=${pollIntervalSeconds}s)`);

  while (!stopping) {
    if (isDaemonStopped()) {
      console.log("[warmy] stopped marker appeared; exiting");
      break;
    }
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
