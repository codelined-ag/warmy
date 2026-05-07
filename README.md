![Warmy](warmy.png)

# Warmy

**Keep your Claude Code and Codex CLI sessions warm, automatically.**

Warmy sends a ping to the Anthropic API 1 minute after your 5-hour rate limit window expires, so your next session always starts fresh. It tracks your actual API usage from `~/.claude/history.jsonl` and `~/.codex/logs_1.sqlite`, so it only fires when needed.

Warmy runs as a long-lived background daemon that polls every **30 seconds** and auto-restarts on reboot.

## How it works

Claude Code and Codex CLI use a **rolling 5-hour rate limit window**. The clock starts from your first API request in that window. Warmy finds that first request, waits for the window to expire, then sends a warmup message 1 minute later. This starts a fresh window before your next session.

If you were actively using the tool within 10 minutes before the window would reset, Warmy skips the ping (your own usage already refreshed it).

If a warmup attempt fails (e.g. expired token), Warmy backs off for 5 minutes before trying again — it will not hammer the API.

## Installation

```bash
npm install -g @codelined/warmy
```

## Quick start

```bash
# Interactive setup
warmy init

# Check status
warmy status

# Trigger a warmup now
warmy run
```

## Commands

| Command | Description |
|---------|-------------|
| `warmy init` | Interactive setup, installs scheduler and starts the daemon |
| `warmy run` | Check window and warm up if needed (one-shot) |
| `warmy status` | Show config, scheduler, daemon, next warmup time |
| `warmy daemon` | Run the polling loop in the foreground (used by scheduler) |
| `warmy ensure-daemon` | Start the daemon if it isn't running (used as a watchdog) |
| `warmy stop-daemon` | Stop the running daemon |
| `warmy upgrade` | Pull the latest version from npm without touching config |
| `warmy set-message <msg>` | Set a custom warmup message |
| `warmy edit-config` | Open config file in `$EDITOR` |
| `warmy uninstall` | Remove scheduler, daemon, config, and stored data |

## Customizing the warmup message

```bash
warmy set-message "Hey Claude, just keeping the session warm."
```

Both Claude Code and Codex will receive this message during warmup. Default is `"Hello Claude. Howdy?"`.

## How window tracking works

Warmy tracks the 5-hour rate limit window by reading your actual API request history:

- **Claude Code**: Reads `timestamp` fields from `~/.claude/history.jsonl`
- **Codex CLI**: Reads log timestamps from `~/.codex/logs_1.sqlite`

The oldest request in the last 5 hours is the start of your current window. Warmy fires 1 minute after that window expires. If no requests exist in the last 5 hours, the window has already reset and Warmy fires immediately.

## Scheduler & daemon

```bash
warmy init   # installs launchd (macOS) or cron (Linux), and starts the daemon
```

Warmy runs as a long-lived **daemon** that polls every 30 seconds. The
scheduler keeps the daemon alive across reboots and crashes:

- **macOS** — launchd plist with `KeepAlive=true` and `RunAtLoad=true` runs
  `warmy daemon`. launchd auto-restarts it if it dies and starts it on login.
- **Linux** — `cron` installs `@reboot warmy ensure-daemon` (so the daemon
  starts on every reboot) plus a one-minute watchdog (`* * * * * warmy
  ensure-daemon`) that respawns it if it ever dies. No `loginctl
  enable-linger` required.

The daemon writes its PID to `~/.warmy/daemon.pid` and refuses to start a
second instance. Logs go to `~/.warmy/daemon.log`.

## Upgrading

```bash
warmy upgrade
```

Pulls `@codelined/warmy@latest` globally without touching `~/.warmy/config.json`.
Restart the daemon afterwards to pick up the new version:

```bash
warmy stop-daemon && warmy ensure-daemon
```

## Requirements

- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and/or [Codex CLI](https://github.com/openai/codex) installed and authenticated
- macOS (launchd) or Linux (cron) for scheduled mode

---

## Quality metrics

![Desloppify Scorecard](scorecard.png)
