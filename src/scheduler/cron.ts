import { execSync } from "child_process";
import { writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const WARMY_TAG = "# warmy-managed";

function sanitizePath(path: string): boolean {
  return path.startsWith("/") && !path.includes("..");
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

function stripWarmyEntries(existing: string): string[] {
  return existing.split("\n").filter((line) => {
    if (line.trim() === "") return false;
    if (line.includes(WARMY_TAG)) return false;
    if (line.includes("/tmp/warmy.log")) return false;
    if (line.includes("warmy run")) return false;
    if (line.includes("warmy daemon")) return false;
    if (line.includes("warmy ensure-daemon")) return false;
    return true;
  });
}

async function writeCrontab(lines: string[]): Promise<void> {
  const newCrontab = lines.join("\n") + "\n";
  const tmpFile = join(tmpdir(), `warmy-cron-${Date.now()}.tmp`);
  await writeFile(tmpFile, newCrontab, "utf-8");
  execSync(`crontab "${tmpFile}"`, { stdio: "pipe" });
}

export async function installCron(warmyPath: string): Promise<void> {
  if (!sanitizePath(warmyPath)) {
    throw new Error("warmyPath must be an absolute path");
  }

  const node = process.execPath;
  const logPath = "/tmp/warmy.log";

  const rebootJob = `@reboot ${node} ${warmyPath} ensure-daemon >> ${logPath} 2>&1 ${WARMY_TAG}`;
  const watchdogJob = `* * * * * ${node} ${warmyPath} ensure-daemon >> ${logPath} 2>&1 ${WARMY_TAG}`;

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
