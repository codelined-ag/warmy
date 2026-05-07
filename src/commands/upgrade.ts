import { spawnSync, execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";

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

function detectPackageManager(): "npm" | "pnpm" | "yarn" | "bun" {
  const root = findInstallRoot();
  if (root) {
    const grandparent = dirname(dirname(root));
    if (grandparent.includes("/pnpm/")) return "pnpm";
    if (grandparent.includes("/yarn/")) return "yarn";
    if (grandparent.includes("/.bun/")) return "bun";
  }
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

export async function upgrade(): Promise<void> {
  const pm = detectPackageManager();
  const before = currentVersion();
  const latest = fetchLatestVersion();

  console.log(`Warmy upgrade — current: ${before}${latest ? `, latest: ${latest}` : ""}`);

  if (latest && before === latest) {
    console.log("✓ Already on latest version. Nothing to do.");
    return;
  }

  const installCmd: Record<typeof pm, [string, string[]]> = {
    npm: ["npm", ["install", "-g", `${PACKAGE_NAME}@latest`]],
    pnpm: ["pnpm", ["add", "-g", `${PACKAGE_NAME}@latest`]],
    yarn: ["yarn", ["global", "add", `${PACKAGE_NAME}@latest`]],
    bun: ["bun", ["add", "-g", `${PACKAGE_NAME}@latest`]],
  };

  const [cmd, args] = installCmd[pm];
  console.log(`\nRunning: ${cmd} ${args.join(" ")}\n`);

  const result = spawnSync(cmd, args, {
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
  console.log(`If a daemon is running, restart it to pick up the new version:`);
  console.log(`  warmy stop-daemon && warmy ensure-daemon`);
}
