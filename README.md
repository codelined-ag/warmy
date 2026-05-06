![Warmy](warmy.png)

# Warmy

**Keep your Claude Code and Codex CLI sessions warm, automatically.**

Warmy sends a ping to the Anthropic API 1 minute after your 5-hour rate limit window expires, so your next session always starts fresh. It tracks your actual API usage from `~/.claude/history.jsonl` and `~/.codex/logs_1.sqlite`, so it only fires when needed.

## How it works

Claude Code and Codex CLI use a **rolling 5-hour rate limit window**. The clock starts from your first API request in that window. Warmy finds that first request, waits for the window to expire, then sends a warmup message 1 minute later. This starts a fresh window before your next session.

If you were actively using the tool within 10 minutes before the window would reset, Warmy skips the ping (your own usage already refreshed it).

## Installation

```bash
npm install -g warmy
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
| `warmy init` | Interactive setup |
| `warmy run` | Check window and warm up if needed |
| `warmy status` | Show config, scheduler, next warmup time |
| `warmy set-message <msg>` | Set a custom warmup message |
| `warmy edit-config` | Open config file in `$EDITOR` |
| `warmy uninstall` | Remove scheduler, config, and stored data |

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

## Scheduler

```bash
warmy init   # installs launchd (macOS) or cron (Linux) scheduler
```

The scheduler runs Warmy every 5 minutes to check the window and fire if needed.

## Requirements

- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and/or [Codex CLI](https://github.com/openai/codex) installed and authenticated
- macOS (launchd) or Linux (cron) for scheduled mode

---

## Quality metrics

![Desloppify Scorecard](scorecard.png)
