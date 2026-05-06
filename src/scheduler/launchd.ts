import { writeFile, chmod, mkdir, rm } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { existsSync } from "fs";

const PLIST_NAME = "com.warmy.warmy.plist";
const WARMUP_INTERVAL_SECONDS = 5 * 60; // 5 minutes

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generatePlist(warmyPath: string): string {
  const safePath = escapeXml(warmyPath);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.warmy.warmy</string>
    <key>ProgramArguments</key>
    <array>
        <string>${safePath}</string>
        <string>run</string>
    </array>
    <key>StartInterval</key>
    <integer>${WARMUP_INTERVAL_SECONDS}</integer>
    <key>StandardOutPath</key>
    <string>/tmp/warmy.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/warmy.stderr.log</string>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>`;
}

export async function installLaunchd(warmyPath: string): Promise<void> {
  if (!warmyPath.startsWith("/")) {
    throw new Error("warmyPath must be an absolute path");
  }

  const home = homedir();
  const launchAgentsDir = join(home, "Library", "LaunchAgents");
  const plistPath = join(launchAgentsDir, PLIST_NAME);

  try {
    await mkdir(launchAgentsDir, { recursive: true, mode: 0o755 });
  } catch (err) {
    throw new Error(`Failed to create LaunchAgents directory: ${err instanceof Error ? err.message : String(err)}`);
  }

  const plist = generatePlist(warmyPath);

  try {
    await writeFile(plistPath, plist, "utf-8");
  } catch (err) {
    throw new Error(`Failed to write plist file: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await chmod(plistPath, 0o600);
  } catch (err) {
    throw new Error(`Failed to set plist permissions: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    execSync(`launchctl load -w "${plistPath}"`, { stdio: "pipe" });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load launchd agent: ${error}`);
  }
}

export async function uninstallLaunchd(): Promise<void> {
  const home = homedir();
  const plistPath = join(home, "Library", "LaunchAgents", PLIST_NAME);

  try {
    execSync(`launchctl unload -w "${plistPath}"`, { stdio: "pipe" });
  } catch {
    // ignore if not loaded
  }

  try {
    await rm(plistPath, { force: true });
  } catch {
    // ignore if not found
  }
}

export async function isLaunchdInstalled(): Promise<boolean> {
  return existsSync(join(homedir(), "Library", "LaunchAgents", PLIST_NAME));
}