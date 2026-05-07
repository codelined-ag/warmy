#!/usr/bin/env node

import { Command } from "commander";
import { init } from "./commands/init.js";
import { runWarmup } from "./commands/run.js";
import { status } from "./commands/status.js";
import { uninstall } from "./commands/uninstall.js";
import { configEdit, setMessage } from "./commands/config.js";
import { runDaemon, ensureDaemon, startDaemonCmd, stopDaemon, restartDaemon } from "./commands/daemon.js";
import { upgrade } from "./commands/upgrade.js";

const program = new Command();

program
  .name("warmy")
  .description("Prevent your AI coding sessions from going cold")
  .usage("<command> [options]")
  .addHelpText("beforeAll", `
  ╔══════════════════════════════════════════════╗
  ║  🔥  Warmy — Session Keeper for AI Coding  ║
  ╚══════════════════════════════════════════════╝

  Claude Code and Codex CLI have a 5-hour rate limit window.
  Warmy sends a ping 1 minute after it resets — so your
  next session always starts fresh.

  ──────────────────────────────────────────────`);

program.command("init")
  .description("Interactive setup — detects installed CLIs and installs scheduler")
  .action(init);

program.command("run")
  .description("Check the window and warm up if needed")
  .action(runWarmup);

program.command("status")
  .description("Show config, scheduler, and next warmup time")
  .action(status);

program.command("uninstall")
  .description("Remove scheduler, config, and stored tokens")
  .action(uninstall);

program.command("daemon")
  .description("Run as a long-lived daemon process (used by scheduler)")
  .action(runDaemon);

program.command("ensure-daemon")
  .description("Start daemon unless explicitly stopped (cron watchdog hook; will not override stop-daemon)")
  .action(ensureDaemon);

program.command("start-daemon")
  .description("Force-start the daemon, clearing any stop marker set by stop-daemon")
  .action(startDaemonCmd);

program.command("restart-daemon")
  .description("Stop the daemon if running, clear the stop marker, and start a fresh one")
  .action(restartDaemon);

program.command("stop-daemon")
  .description("Stop the daemon and prevent the watchdog from restarting it")
  .action(stopDaemon);

program.command("upgrade")
  .description("Pull the latest version from npm without touching config")
  .option("--no-restart", "do not restart the daemon after upgrading")
  .action((opts) => upgrade(opts.restart === false ? ["--no-restart"] : []));

program.command("edit-config")
  .description("Open config file in your $EDITOR")
  .action(configEdit);

program.command("set-message")
  .description("Set a custom warmup message")
  .argument("<message>", "the message Claude/Codex receives during warmup")
  .action(setMessage);

program.addHelpText("afterAll", `
  ──────────────────────────────────────────────
  📖  Readme:  https://github.com/codelined-ag/warmy
  ⚠️  Issues:  https://github.com/codelined-ag/warmy/issues

  The 5-hour window starts from your first API request.
  Warmy sends a message 1 minute after it expires,
  so your next session gets a fresh window.`);

function fatal(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("Refusing to use")) {
    console.error(`\n✗ ${msg}\n`);
  } else {
    console.error(`\n✗ ${msg}\n`);
  }
  process.exit(1);
}

if (process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("warmy")) {
  program.parseAsync().catch(fatal);
}
