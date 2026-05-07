import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("../../dist/config.js", () => ({
  loadConfig: vi.fn(),
  getConfigPath: vi.fn().mockReturnValue("/tmp/.warmy/config.json"),
  formatInTimezone: vi.fn((ts, tz) => {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString("en-US", { timeZone: tz }) + ` ${tz}`; }
    catch { return ts; }
  }),
}));
vi.mock("../../dist/scheduler/index.js", () => ({ isSchedulerInstalled: vi.fn() }));
vi.mock("../../dist/detectors/session.js", () => ({
  getNextClaudeWarmup: vi.fn(),
  getNextCodexWarmup: vi.fn(),
}));
vi.mock("fs", () => ({ existsSync: vi.fn() }));
vi.mock("../../dist/daemon.js", () => ({
  isDaemonRunning: vi.fn().mockResolvedValue(false),
  readDaemonPid: vi.fn().mockResolvedValue(null),
  DEFAULT_POLL_INTERVAL_SECONDS: 30,
}));

const STATUS_PATH = "/home/slay/projects/codex-projects/warmy/warmy/dist/commands/status.js";

describe("status", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should show scheduler status", async () => {
    const { loadConfig } = await import("../../dist/config.js");
    const { isSchedulerInstalled } = await import("../../dist/scheduler/index.js");
    const { getNextClaudeWarmup, getNextCodexWarmup } = await import("../../dist/detectors/session.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: false,
      lastRun: null, lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }, stats: { daemonStartedAt: null, claudeWarmups: 0, codexWarmups: 0, claudeFailures: 0, codexFailures: 0 },
      timezone: "UTC"
    });
    vi.mocked(isSchedulerInstalled).mockResolvedValue(true);
    vi.mocked(getNextClaudeWarmup).mockReturnValue(Date.now() + 3600000);
    vi.mocked(getNextCodexWarmup).mockReturnValue(null);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { status } = await import(STATUS_PATH);
    await status();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Scheduler"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Timezone"));
    consoleSpy.mockRestore();
  });

  it("should show next warmup when available", async () => {
    const { loadConfig } = await import("../../dist/config.js");
    const { isSchedulerInstalled } = await import("../../dist/scheduler/index.js");
    const { getNextClaudeWarmup, getNextCodexWarmup } = await import("../../dist/detectors/session.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: true,
      lastRun: null,
      lastWarmupAt: { claude: "2026-01-01T00:00:00.000Z", codex: "2026-01-01T01:00:00.000Z" },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }, stats: { daemonStartedAt: null, claudeWarmups: 0, codexWarmups: 0, claudeFailures: 0, codexFailures: 0 },
      timezone: "America/New_York"
    });
    vi.mocked(isSchedulerInstalled).mockResolvedValue(false);
    vi.mocked(getNextClaudeWarmup).mockReturnValue(Date.now() + 3600000);
    vi.mocked(getNextCodexWarmup).mockReturnValue(Date.now() + 7200000);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { status } = await import(STATUS_PATH);
    await status();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("next warmup"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("America/New_York"));
    consoleSpy.mockRestore();
  });

  it("should show last results with errors", async () => {
    const { loadConfig } = await import("../../dist/config.js");
    const { isSchedulerInstalled } = await import("../../dist/scheduler/index.js");
    const { getNextClaudeWarmup, getNextCodexWarmup } = await import("../../dist/detectors/session.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: true,
      lastRun: "2026-01-01T00:00:00.000Z",
      lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: {
        claude: { success: true, timestamp: "2026-01-01T00:00:00.000Z" },
        codex: { success: false, timestamp: "2026-01-01T01:00:00.000Z", error: "API timeout after 30s" }
      },
      timezone: "UTC"
    });
    vi.mocked(isSchedulerInstalled).mockResolvedValue(true);
    vi.mocked(getNextClaudeWarmup).mockReturnValue(Date.now() + 3600000);
    vi.mocked(getNextCodexWarmup).mockReturnValue(Date.now() + 7200000);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { status } = await import(STATUS_PATH);
    await status();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Claude result"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Codex result"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("API timeout"));
    consoleSpy.mockRestore();
  });
});
