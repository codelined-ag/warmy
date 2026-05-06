#!/usr/bin/env node

import { Command } from "commander";
import { init } from "./commands/init.js";
import { runWarmup } from "./commands/run.js";
import { status } from "./commands/status.js";
import { uninstall } from "./commands/uninstall.js";
import { configEdit, setMessage } from "./commands/config.js";

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

if (process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("warmy")) {
  program.parse();
}
