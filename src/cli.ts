#!/usr/bin/env node

import { Command } from "commander";
import { init } from "./commands/init.js";
import { runWarmup } from "./commands/run.js";
import { status } from "./commands/status.js";
import { uninstall } from "./commands/uninstall.js";
import { configEdit, setMessage } from "./commands/config.js";

const program = new Command();

program.name("warmy").description("Warm up Claude Code and Codex CLI rate limit windows");

program.command("init").description("Interactive setup").action(init);
program.command("run").description("Run warmup now").action(runWarmup);
program.command("status").description("Show status").action(status);
program.command("uninstall").description("Remove scheduler and config").action(uninstall);
program.command("edit-config").description("Edit config file").action(configEdit);
program.command("set-message")
  .description("Set a custom warmup message")
  .argument("<message>", "The message to send during warmup")
  .action(setMessage);

if (process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("warmy")) {
  program.parse();
}
