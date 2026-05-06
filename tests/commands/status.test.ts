import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("../../dist/config.js", () => ({
  loadConfig: vi.fn(),
  getConfigPath: vi.fn().mockReturnValue("/tmp/.warmy/config.json"),
}));
vi.mock("../../dist/scheduler/index.js", () => ({ isSchedulerInstalled: vi.fn() }));
vi.mock("fs", () => ({ existsSync: vi.fn() }));

const STATUS_PATH = "/home/slay/projects/experiments/warmy/warmy/dist/commands/status.js";

describe("status", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should show scheduler status", async () => {
    const { loadConfig } = await import("../../dist/config.js");
    const { isSchedulerInstalled } = await import("../../dist/scheduler/index.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: false,
      lastRun: null, lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }
    });
    vi.mocked(isSchedulerInstalled).mockResolvedValue(true);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { status } = await import(STATUS_PATH);
    await status();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Scheduler"));
    consoleSpy.mockRestore();
  });

  it("should show next warmup when available", async () => {
    const { loadConfig } = await import("../../dist/config.js");
    const { isSchedulerInstalled } = await import("../../dist/scheduler/index.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: true,
      lastRun: null,
      lastWarmupAt: { claude: "2026-01-01T00:00:00.000Z", codex: "2026-01-01T01:00:00.000Z" },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }
    });
    vi.mocked(isSchedulerInstalled).mockResolvedValue(false);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { status } = await import(STATUS_PATH);
    await status();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Claude next"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Codex next"));
    consoleSpy.mockRestore();
  });

  it("should show last results", async () => {
    const { loadConfig } = await import("../../dist/config.js");
    const { isSchedulerInstalled } = await import("../../dist/scheduler/index.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: true,
      lastRun: "2026-01-01T00:00:00.000Z",
      lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: {
        claude: { success: true, timestamp: "2026-01-01T00:00:00.000Z" },
        codex: { success: false, timestamp: "2026-01-01T01:00:00.000Z" }
      }
    });
    vi.mocked(isSchedulerInstalled).mockResolvedValue(true);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { status } = await import(STATUS_PATH);
    await status();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Claude result"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Codex result"));
    consoleSpy.mockRestore();
  });
});
