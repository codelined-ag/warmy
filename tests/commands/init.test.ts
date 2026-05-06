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
vi.mock("readline", () => ({ createInterface: vi.fn() }));

const INIT_PATH = "/home/slay/projects/experiments/warmy/warmy/dist/commands/init.js";

describe("init", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should show not-found when no CLIs installed", async () => {
    const { isClaudeInstalled } = await import("../../dist/detectors/claude.js");
    const { isCodexInstalled } = await import("../../dist/detectors/codex.js");
    vi.mocked(isClaudeInstalled).mockReturnValue(false);
    vi.mocked(isCodexInstalled).mockReturnValue(false);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { init } = await import(INIT_PATH);
    await init();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Nothing to warm up"));
    consoleSpy.mockRestore();
  });
});
