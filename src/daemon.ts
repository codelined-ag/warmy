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

export class DaemonAlreadyRunningError extends Error {
  readonly existingPid: number;
  constructor(pid: number) {
    super(`Daemon already running (pid ${pid})`);
    this.name = "DaemonAlreadyRunningError";
    this.existingPid = pid;
  }
}

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

export async function readDaemonStartedAt(): Promise<string | null> {
  const record = await readDaemonRecord();
  return record?.startedAt || null;
}

export async function readDaemonRecord(): Promise<PidRecord | null> {
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
  const path = getStoppedMarkerPath();
  if (!existsSync(path)) return false;
  try {
    const lst = lstatSync(path);
    if (lst.isSymbolicLink()) return false;
    if (typeof process.geteuid === "function" && lst.uid !== process.geteuid()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function setStoppedMarker(): void {
  ensureSafeWarmyDir();
  const path = getStoppedMarkerPath();
  try { unlinkSync(path); } catch {}
  const flags =
    fsConstants.O_WRONLY |
    fsConstants.O_CREAT |
    fsConstants.O_EXCL |
    fsConstants.O_NOFOLLOW;
  const fd = openSync(path, flags, 0o600);
  try {
    writeSync(fd, new Date().toISOString());
  } finally {
    closeSync(fd);
  }
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
    throw new Error(`Refusing to use ${dir}: it is a symlink. Inspect the path and remove it.`);
  }
  if (typeof process.geteuid === "function" && lst.uid !== process.geteuid()) {
    throw new Error(
      `Refusing to use ${dir}: owner uid ${lst.uid} != ours ${process.geteuid()}. ` +
      `If you ran warmy with sudo by mistake, fix with: sudo chown -R $USER ${dir}`
    );
  }
  return dir;
}

export function verifyDaemonOwnership(pid: number): boolean {
  const record = readRecordSync();
  if (!record) return false;
  if (record.pid !== pid) return false;
  if (record.tag !== DAEMON_OWNER_TAG) return false;
  return isProcessAlive(pid);
}

export function safeKillWarmyDaemon(pid: number, signal: NodeJS.Signals | number): boolean {
  if (!verifyDaemonOwnership(pid)) return false;
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function openNoFollow(path: string, flags: number, mode: number): number {
  return openSync(path, flags | fsConstants.O_NOFOLLOW, mode);
}

const LOG_ROTATION_KEEP = 3;

function rotateDaemonLogIfLarge(): void {
  const logPath = getDaemonLogPath();
  if (!existsSync(logPath)) return;
  try {
    const lst = lstatSync(logPath);
    if (lst.isSymbolicLink()) {
      unlinkSync(logPath);
      return;
    }
    if (lst.size < MAX_LOG_BYTES) return;

    for (let i = LOG_ROTATION_KEEP; i >= 1; i--) {
      const src = i === 1 ? logPath : `${logPath}.${i - 1}`;
      const dst = `${logPath}.${i}`;
      if (!existsSync(src)) continue;
      try { unlinkSync(dst); } catch {}
      try { renameSync(src, dst); } catch {}
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

  for (let attempt = 0; attempt < 5; attempt++) {
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
        throw new DaemonAlreadyRunningError(existing.pid);
      }
      try {
        unlinkSync(pidFile);
      } catch {
      }
    }
  }
  throw new Error("Failed to acquire daemon PID file after retries");
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
