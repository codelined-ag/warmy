import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("../../dist/config.js", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getConfigPath: vi.fn().mockReturnValue("/tmp/.warmy/config.json"),
  detectTimezone: vi.fn().mockReturnValue("UTC"),
}));
vi.mock("fs", () => ({ existsSync: vi.fn() }));

const CONFIG_PATH = "/home/slay/projects/codex-projects/warmy/warmy/dist/commands/config.js";

describe("setMessage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should save custom message to config", async () => {
    const { loadConfig, saveConfig } = await import("../../dist/config.js");
    vi.mocked(loadConfig).mockResolvedValue({
      scheduleTime: "06:00", claudeEnabled: false, codexEnabled: false,
      lastRun: null, lastWarmupAt: { claude: null, codex: null },
      warmupIntervalSeconds: 18060, warmupMessage: "Hello",
      lastResult: { claude: null, codex: null },
      timezone: "UTC"
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { setMessage } = await import(CONFIG_PATH);
    await setMessage("Custom warmup message");
    expect(vi.mocked(saveConfig).mock.calls[0][0].warmupMessage).toBe("Custom warmup message");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Custom warmup message"));
    consoleSpy.mockRestore();
  });

  it("should show usage when message is empty", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { setMessage } = await import(CONFIG_PATH);
    await setMessage("");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Usage"));
    consoleSpy.mockRestore();
  });
});
