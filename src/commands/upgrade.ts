import { spawnSync, execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const PACKAGE_NAME = "@codelined/warmy";

function findInstallRoot(): string | null {
  let dir = dirname(process.argv[1] || "");
  while (dir && dir !== "/") {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name === PACKAGE_NAME) return dir;
      } catch {
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "volta";

function detectPackageManager(): PackageManager {
  const fullPath = (process.argv[1] || "") + " " + (findInstallRoot() || "");
  if (/\/\.bun\b|\/bun\/install\b/.test(fullPath)) return "bun";
  if (/\/\.volta\//.test(fullPath)) return "volta";
  if (/\/pnpm\/|\/\.pnpm\//.test(fullPath)) return "pnpm";
  if (/\/yarn\b|\/\.yarn\//.test(fullPath)) return "yarn";
  return "npm";
}

function currentVersion(): string {
  try {
    const root = findInstallRoot();
    if (!root) return "unknown";
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

function fetchLatestVersion(): string | null {
  try {
    const out = execSync(`npm view ${PACKAGE_NAME} version`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 30_000,
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function parseFlags(argv: string[]): { noRestart: boolean } {
  return { noRestart: argv.includes("--no-restart") };
}

async function maybeRestartDaemon(noRestart: boolean): Promise<void> {
  if (noRestart) {
    console.log("\nSkipping daemon restart (--no-restart). Restart manually with:");
    console.log("  warmy stop-daemon && warmy start-daemon");
    return;
  }

  const daemonMod = await import("../daemon.js");
  const { isDaemonRunning, readDaemonPid, startDaemonDetached, clearStoppedMarker } = daemonMod;

  if (!(await isDaemonRunning())) {
    console.log("\nDaemon was not running. Run 'warmy ensure-daemon' to start it.");
    return;
  }

  const pid = await readDaemonPid();
  if (pid === null) return;

  console.log(`\nRestarting daemon (pid ${pid})...`);
  try {
    process.kill(pid, "SIGTERM");
  } catch (err) {
    console.error(`Failed to send SIGTERM: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const start = Date.now();
  while (Date.now() - start < 3000) {
    if (!(await isDaemonRunning())) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (await isDaemonRunning()) {
    try { process.kill(pid, "SIGKILL"); } catch {}
  }

  clearStoppedMarker();

  const warmyPath = process.argv[1] || fileURLToPath(import.meta.url);
  try {
    const newPid = await startDaemonDetached(warmyPath);
    console.log(`✓ Daemon restarted (pid ${newPid}).`);
  } catch (err) {
    console.error(`Failed to restart daemon: ${err instanceof Error ? err.message : String(err)}`);
    console.error("Run 'warmy ensure-daemon' manually.");
  }
}

export async function upgrade(...args: unknown[]): Promise<void> {
  const argv = (args.find((a) => Array.isArray(a)) as string[] | undefined) ?? process.argv.slice(3);
  const { noRestart } = parseFlags(argv);
  const pm = detectPackageManager();
  const before = currentVersion();
  const latest = fetchLatestVersion();

  console.log(`Warmy upgrade (via ${pm}) — current: ${before}${latest ? `, latest: ${latest}` : ""}`);

  if (latest && before === latest) {
    console.log("✓ Already on latest version. Nothing to do.");
    return;
  }

  if (pm === "volta") {
    console.log(
      "\nVolta detected. Volta does not support 'npm i -g' for arbitrary packages.\n" +
      `Run manually: volta install ${PACKAGE_NAME}@latest`
    );
    return;
  }

  const installCmd: Record<Exclude<PackageManager, "volta">, [string, string[]]> = {
    npm: ["npm", ["install", "-g", `${PACKAGE_NAME}@latest`]],
    pnpm: ["pnpm", ["add", "-g", `${PACKAGE_NAME}@latest`]],
    yarn: ["yarn", ["global", "add", `${PACKAGE_NAME}@latest`]],
    bun: ["bun", ["add", "-g", `${PACKAGE_NAME}@latest`]],
  };

  const [cmd, cmdArgs] = installCmd[pm];
  console.log(`\nRunning: ${cmd} ${cmdArgs.join(" ")}\n`);

  const result = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    timeout: 5 * 60_000,
  });

  if (result.status !== 0) {
    console.error(`\n✗ Upgrade failed with exit code ${result.status ?? "?"}.`);
    if (cmd === "npm") {
      console.error(`If this is a permission error, try: sudo npm install -g ${PACKAGE_NAME}@latest`);
    }
    process.exit(result.status ?? 1);
  }

  console.log(`\n✓ Upgrade complete.`);
  console.log(`Your config in ~/.warmy/config.json was not touched.`);

  await maybeRestartDaemon(noRestart);
}
