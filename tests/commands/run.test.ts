import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("../../dist/detectors/claude.js", () => ({ isClaudeInstalled: vi.fn() }));
vi.mock("../../dist/detectors/codex.js", () => ({ isCodexInstalled: vi.fn() }));
vi.mock("../../dist/config.js", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getWarmyDir: vi.fn().mockReturnValue("/tmp/.warmy"),
  getConfigPath: vi.fn().mockReturnValue("/tmp/.warmy/config.json"),
  getPlatform: vi.fn().mockReturnValue("linux"),
  WARMUP_INTERVAL_SECONDS: 18060,
  WarmyConfig: {}
}));
vi.mock("../../dist/scheduler/index.js", () => ({ installScheduler: vi.fn() }));

const RUN_PATH = "/home/slay/projects/experiments/warmy/warmy/dist/commands/run.js";

describe("runWarmup", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should skip warmup when not needed", async () => {
    const { loadConfig } = await import("../../dist/config.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: false,
      lastRun: null,
      lastWarmupAt: { claude: new Date().toISOString(), codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runWarmup } = await import(RUN_PATH);
    await runWarmup();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("next warmup"));
    consoleSpy.mockRestore();
  });

  it("should warm up claude when needed", async () => {
    const { loadConfig, saveConfig } = await import("../../dist/config.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: false,
      lastRun: null, lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runWarmup } = await import(RUN_PATH);
    await runWarmup();
    expect(saveConfig).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
