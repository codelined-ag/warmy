import { execSync } from "child_process";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir, homedir } from "os";

const WARMY_TAG = "# warmy-managed";
const SAFE_PATH_RE = /^\/[A-Za-z0-9_./@:+-]+$/;

function sanitizePath(path: string): boolean {
  if (!SAFE_PATH_RE.test(path)) return false;
  if (path.includes("..")) return false;
  return true;
}

function shellSingleQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function readCrontab(): string {
  try {
    return execSync("crontab -l 2>/dev/null", {
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    return "";
  }
}

const LEGACY_CRON_RE = /^\s*\*\/5\s+\*\s+\*\s+\*\s+\*\s+.*\bwarmy\b\s+run\b/;

function stripWarmyEntries(existing: string): string[] {
  return existing.split("\n").filter((line) => {
    if (line.trim() === "") return false;
    if (line.includes(WARMY_TAG)) return false;
    if (LEGACY_CRON_RE.test(line)) return false;
    return true;
  });
}

async function writeCrontab(lines: string[]): Promise<void> {
  const newCrontab = lines.join("\n") + "\n";
  const tmpFile = join(tmpdir(), `warmy-cron-${Date.now()}-${process.pid}.tmp`);
  await writeFile(tmpFile, newCrontab, { encoding: "utf-8", mode: 0o600 });
  execSync(`crontab "${tmpFile}"`, { stdio: "pipe" });
}

export async function installCron(warmyPath: string): Promise<void> {
  if (!sanitizePath(warmyPath)) {
    throw new Error(
      "warmyPath must be an absolute path with safe characters only (alnum / . _ / @ : + -)"
    );
  }
  if (!sanitizePath(process.execPath)) {
    throw new Error("Node binary path contains unsafe characters; refusing to install cron");
  }

  const home = homedir();
  const warmyDir = join(home, ".warmy");
  try {
    await mkdir(warmyDir, { recursive: true, mode: 0o700 });
  } catch {
  }

  const node = shellSingleQuote(process.execPath);
  const path = shellSingleQuote(warmyPath);
  const logPath = shellSingleQuote(join(warmyDir, "cron.log"));

  const rebootJob = `@reboot ${node} ${path} ensure-daemon >> ${logPath} 2>&1 ${WARMY_TAG}`;
  const watchdogJob = `* * * * * ${node} ${path} ensure-daemon >> ${logPath} 2>&1 ${WARMY_TAG}`;

  const lines = stripWarmyEntries(readCrontab());
  lines.push(rebootJob);
  lines.push(watchdogJob);

  await writeCrontab(lines);
}

export function uninstallCron(): Promise<void> {
  try {
    const lines = stripWarmyEntries(readCrontab());
    return writeCrontab(lines);
  } catch (err) {
    return Promise.reject(
      new Error(
        `Failed to uninstall cron job: ${err instanceof Error ? err.message : String(err)}`
      )
    );
  }
}

export function isCronInstalled(): Promise<boolean> {
  const crons = readCrontab();
  return Promise.resolve(crons.includes(WARMY_TAG));
}
