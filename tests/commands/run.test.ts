import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("../../dist/detectors/claude.js", () => ({ isClaudeInstalled: vi.fn() }));
vi.mock("../../dist/detectors/codex.js", () => ({ isCodexInstalled: vi.fn() }));
vi.mock("../../dist/detectors/session.js", () => ({
  getNextClaudeWarmup: vi.fn(),
  getNextCodexWarmup: vi.fn(),
}));
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
vi.mock("../../dist/warmup/anthropic.js", () => ({ warmupClaude: vi.fn() }));
vi.mock("../../dist/warmup/openai.js", () => ({ warmupCodex: vi.fn() }));

const RUN_PATH = "/home/slay/projects/codex-projects/warmy/warmy/dist/commands/run.js";

describe("runWarmup", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should skip warmup when not needed", async () => {
    const { loadConfig } = await import("../../dist/config.js");
    const { getNextClaudeWarmup } = await import("../../dist/detectors/session.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: false,
      lastRun: null,
      lastWarmupAt: { claude: new Date().toISOString(), codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }, stats: { daemonStartedAt: null, claudeWarmups: 0, codexWarmups: 0, claudeFailures: 0, codexFailures: 0 },
      timezone: "UTC"
    });
    vi.mocked(getNextClaudeWarmup).mockReturnValue(Date.now() + 600000);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runWarmup } = await import(RUN_PATH);
    await runWarmup();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("next warmup"));
    consoleSpy.mockRestore();
  });

  it("should warm up claude when needed", async () => {
    const { loadConfig, saveConfig } = await import("../../dist/config.js");
    const { getNextClaudeWarmup } = await import("../../dist/detectors/session.js");
    const { warmupClaude } = await import("../../dist/warmup/anthropic.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: false,
      lastRun: null, lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }, stats: { daemonStartedAt: null, claudeWarmups: 0, codexWarmups: 0, claudeFailures: 0, codexFailures: 0 },
      timezone: "UTC"
    });
    vi.mocked(getNextClaudeWarmup).mockReturnValue(0);
    vi.mocked(warmupClaude).mockResolvedValue({ success: true, reply: "warmed up", error: null });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runWarmup } = await import(RUN_PATH);
    await runWarmup();
    expect(warmupClaude).toHaveBeenCalledWith("Hello");
    expect(saveConfig).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("warmup succeeded"));
    consoleSpy.mockRestore();
  });

  it("should persist warmup error in config", async () => {
    const { loadConfig, saveConfig } = await import("../../dist/config.js");
    const { getNextClaudeWarmup } = await import("../../dist/detectors/session.js");
    const { warmupClaude } = await import("../../dist/warmup/anthropic.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: false,
      lastRun: null, lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }, stats: { daemonStartedAt: null, claudeWarmups: 0, codexWarmups: 0, claudeFailures: 0, codexFailures: 0 },
      timezone: "UTC"
    });
    vi.mocked(getNextClaudeWarmup).mockReturnValue(0);
    vi.mocked(warmupClaude).mockResolvedValue({ success: false, reply: null, error: "API timeout" });

    const { runWarmup } = await import(RUN_PATH);
    await runWarmup();
    const saved = vi.mocked(saveConfig).mock.calls[0][0];
    expect(saved.lastResult.claude.success).toBe(false);
    expect(saved.lastResult.claude.error).toBe("API timeout");
  });

  it("should warm up codex when needed", async () => {
    const { loadConfig, saveConfig } = await import("../../dist/config.js");
    const { getNextCodexWarmup } = await import("../../dist/detectors/session.js");
    const { warmupCodex } = await import("../../dist/warmup/openai.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: true, codexEnabled: true,
      lastRun: null, lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }, stats: { daemonStartedAt: null, claudeWarmups: 0, codexWarmups: 0, claudeFailures: 0, codexFailures: 0 },
      timezone: "UTC"
    });
    vi.mocked(getNextCodexWarmup).mockReturnValue(0);
    vi.mocked(warmupCodex).mockReturnValue({ success: true, reply: "ok", error: null });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runWarmup } = await import(RUN_PATH);
    await runWarmup();
    expect(warmupCodex).toHaveBeenCalledWith("Hello");
    expect(saveConfig).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should skip disabled providers", async () => {
    const { loadConfig } = await import("../../dist/config.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: false, codexEnabled: false,
      lastRun: null, lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null }, stats: { daemonStartedAt: null, claudeWarmups: 0, codexWarmups: 0, claudeFailures: 0, codexFailures: 0 },
      timezone: "UTC"
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runWarmup } = await import(RUN_PATH);
    await runWarmup();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("disabled"));
    consoleSpy.mockRestore();
  });
});
