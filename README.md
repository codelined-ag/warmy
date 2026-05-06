![Warmy](warmy.png)

# Warmy 🔥

**Keep your Claude Code and Codex CLI sessions warm — automatically.**

Warmy sends a periodic ping through `claude -p` and `codex exec` so your AI coding sessions don't go cold after 5 hours of inactivity. It tracks real session activity, so it only fires when needed.

## How it works

Claude Code and Codex CLI have a **5-hour inactivity timeout**. If you step away from a long-running task, grab lunch, or sleep on a problem, your session expires and you lose context.

Warmy detects the last time you *actually used* each tool (by reading session files), then sends a warmup message **5 hours and 1 minute after your last interaction** — right when the window is about to close. If you're actively using the tool, it stays out of your way.

```
┌─ You use Claude ─┐        ┌─ Warmy pings ─┐
│                  │ 5hr 1m  │               │
▸░░░░░░░░░░░░░░░░░▸░░░░░░░░░▸░░░░░░░░░░░░░░░▸
```

## Installation

```bash
npm install -g warmy
```

## Quick start

```bash
# Interactive setup — detects installed tools
warmy init

# Check status
warmy status

# Trigger a warmup now
warmy run
```

## Commands

| Command | Description |
|---------|-------------|
| `warmy init` | Interactive setup — detects Claude Code / Codex CLI, enables warmup |
| `warmy run` | Run warmup now (only if past the 5hr + 1min window) |
| `warmy status` | Show config, scheduler state, last results, and next warmup time |
| `warmy set-message <msg>` | Set a custom warmup message |
| `warmy edit-config` | Open config file in `$EDITOR` |
| `warmy uninstall` | Remove scheduler, config, and stored data |

## Customizing the warmup message

```bash
warmy set-message "Hey Claude, just keeping the session warm. How's it going?"
```

Both Claude Code and Codex will receive this message during warmup. The default is `"Hello Claude. Howdy?"`.

## How session tracking works

Warmy doesn't use a fixed timer. It reads real session data:

- **Claude Code**: Reads `updatedAt` timestamps from `~/.claude/sessions/*.json`
- **Codex CLI**: Reads the latest log timestamp from `~/.codex/logs_1.sqlite`

The warmup fires when `max(lastSessionActivity, lastWarmup) + 5hr 1min < now`. This means:
- If you're actively using a tool, no warmup happens
- If you stop using it, warmup fires 1 minute after the 5-hour window expires
- If warmy already warmed up, the next warmup is 5hr 1min later

## Scheduler

```bash
# Install launchd (macOS) or cron (Linux) scheduler
warmy init   # walks you through setup

# The scheduler runs warmy every 5 minutes,
# checks if warmup is needed, and fires if so
```

The scheduler only triggers the warmup logic — it doesn't spam your tools. The actual warmup only happens when the inactivity window expires.

## Requirements

- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and/or [Codex CLI](https://github.com/openai/codex) installed and authenticated
- macOS (launchd) or Linux (cron) for scheduled mode

## How it's different

| Approach | What it does |
|----------|-------------|
| Direct API call | Hits the Anthropic/OpenAI API directly — doesn't touch your CLI session |
| **Warmy** | Runs `claude -p` / `codex exec` — actually keeps your **CLI session** warm |

Most "keep-alive" tools call APIs directly. Warmy runs commands through your actual CLI sessions, so the session itself stays active.
