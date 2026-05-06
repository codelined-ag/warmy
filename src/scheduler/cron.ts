import { execSync } from "child_process";
import { writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

function sanitizePath(path: string): boolean {
  return path.startsWith("/") && !path.includes("..");
}

export async function installCron(
  warmyPath: string
): Promise<void> {
  if (!sanitizePath(warmyPath)) {
    throw new Error("warmyPath must be an absolute path");
  }

  const cronJob = `*/5 * * * * ${warmyPath} run >> /tmp/warmy.log 2>&1`;

  let existingCrons = "";
  try {
    existingCrons = execSync("crontab -l 2>/dev/null", {
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    existingCrons = "";
  }

  const lines = existingCrons.split("\n").filter((line) => {
    return line.trim() !== "" && !line.includes("warmy run");
  });

  lines.push(cronJob);

  const newCrontab = lines.join("\n") + "\n";

  const tmpFile = join(tmpdir(), `warmy-cron-${Date.now()}.tmp`);
  await writeFile(tmpFile, newCrontab, "utf-8");

  execSync(`crontab "${tmpFile}"`, { stdio: "pipe" });
}

export async function uninstallCron(): Promise<void> {
  try {
    const existingCrons = execSync("crontab -l 2>/dev/null", {
      encoding: "utf-8",
      stdio: "pipe",
    });

    const lines = existingCrons.split("\n").filter((line) => {
      return line.trim() !== "" && !line.includes("warmy run");
    });

    const newCrontab = lines.join("\n") + "\n";
    execSync(`echo "${newCrontab}" | crontab -`, { stdio: "pipe" });
  } catch {
    throw new Error("Failed to uninstall cron job");
  }
}

export async function isCronInstalled(): Promise<boolean> {
  try {
    const crons = execSync("crontab -l 2>/dev/null", {
      encoding: "utf-8",
      stdio: "pipe",
    });
    return crons.includes("warmy run");
  } catch {
    return false;
  }
}