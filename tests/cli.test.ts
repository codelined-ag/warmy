import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("../dist/detectors/claude.js", () => ({ isClaudeInstalled: vi.fn(), detectClaudeCredentials: vi.fn() }));
vi.mock("../dist/detectors/codex.js", () => ({ isCodexInstalled: vi.fn(), detectCodexCredentials: vi.fn() }));
vi.mock("../dist/warmup/anthropic.js", () => ({ warmupClaude: vi.fn() }));
vi.mock("../dist/warmup/openai.js", () => ({ warmupCodex: vi.fn() }));
vi.mock("../dist/keyring.js", () => ({ removeToken: vi.fn() }));
vi.mock("../dist/detectors/session.js", () => ({ getLastClaudeActivity: vi.fn(), getLastCodexActivity: vi.fn() }));
vi.mock("../dist/config.js", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getWarmyDir: vi.fn().mockReturnValue("/tmp/.warmy"),
  getConfigPath: vi.fn().mockReturnValue("/tmp/.warmy/config.json"),
  getPlatform: vi.fn().mockReturnValue("linux"),
  WARMUP_INTERVAL_SECONDS: 18060,
  WarmyConfig: {}
}));
vi.mock("../dist/scheduler/index.js", () => ({
  installScheduler: vi.fn(),
  uninstallScheduler: vi.fn(),
  isSchedulerInstalled: vi.fn(),
}));
vi.mock("fs", () => ({ existsSync: vi.fn(), readFileSync: vi.fn() }));
vi.mock("readline", () => ({ createInterface: vi.fn() }));

const PROJECT_ROOT = "/home/slay/projects/experiments/warmy/warmy";
const CLI_PATH = `${PROJECT_ROOT}/dist/cli.js`;

describe("warmy CLI functions", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("status", () => {
    it("should print scheduler status", async () => {
      const { loadConfig } = await import("../dist/config.js");
      const { isSchedulerInstalled } = await import("../dist/scheduler/index.js");
      vi.mocked(loadConfig).mockResolvedValue({
        scheduleTime: "06:00", claudeEnabled: true, codexEnabled: false,
        lastRun: null, lastWarmupAt: { claude: null, codex: null },
        warmupIntervalSeconds: 18060, warmupMessage: "Hello",
        lastResult: { claude: null, codex: null }
      });
      vi.mocked(isSchedulerInstalled).mockResolvedValue(true);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { status } = await import(CLI_PATH);
      await status();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Scheduler"));
      consoleSpy.mockRestore();
    });

    it("should print Claude next warmup time", async () => {
      const { loadConfig } = await import("../dist/config.js");
      const { isSchedulerInstalled } = await import("../dist/scheduler/index.js");
      vi.mocked(loadConfig).mockResolvedValue({
        scheduleTime: "06:00", claudeEnabled: true, codexEnabled: false,
        lastRun: null,
        lastWarmupAt: { claude: "2026-01-01T00:00:00.000Z", codex: null },
        warmupIntervalSeconds: 18060, warmupMessage: "Hello",
        lastResult: { claude: null, codex: null }
      });
      vi.mocked(isSchedulerInstalled).mockResolvedValue(false);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { status } = await import(CLI_PATH);
      await status();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Claude next"));
      consoleSpy.mockRestore();
    });
  });

  describe("setMessage", () => {
    it("should save custom message to config", async () => {
      const { loadConfig, saveConfig } = await import("../dist/config.js");
      vi.mocked(loadConfig).mockResolvedValue({
        scheduleTime: "06:00", claudeEnabled: false, codexEnabled: false,
        lastRun: null, lastWarmupAt: { claude: null, codex: null },
        warmupIntervalSeconds: 18060, warmupMessage: "Hello",
        lastResult: { claude: null, codex: null }
      });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { setMessage } = await import(CLI_PATH);
      await setMessage("Custom message");
      expect(vi.mocked(saveConfig).mock.calls[0][0].warmupMessage).toBe("Custom message");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Custom message"));
      consoleSpy.mockRestore();
    });
  });

  describe("uninstall", () => {
    it("should uninstall scheduler and remove tokens", async () => {
      const { uninstallScheduler } = await import("../dist/scheduler/index.js");
      const { removeToken } = await import("../dist/keyring.js");
      const { existsSync } = await import("fs");
      vi.mocked(uninstallScheduler).mockResolvedValue(undefined);
      vi.mocked(removeToken).mockResolvedValue(true);
      vi.mocked(existsSync).mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { uninstall } = await import(CLI_PATH);
      await uninstall();
      expect(uninstallScheduler).toHaveBeenCalled();
      expect(removeToken).toHaveBeenCalledWith("claude");
      expect(removeToken).toHaveBeenCalledWith("codex");
      consoleSpy.mockRestore();
    });

    it("should handle scheduler uninstall failure gracefully", async () => {
      const { uninstallScheduler } = await import("../dist/scheduler/index.js");
      const { removeToken } = await import("../dist/keyring.js");
      vi.mocked(uninstallScheduler).mockRejectedValue(new Error("no cron"));
      vi.mocked(removeToken).mockResolvedValue(true);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { uninstall } = await import(CLI_PATH);
      await expect(uninstall()).resolves.not.toThrow();
      expect(removeToken).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("runWarmup", () => {
    it("should skip warmup when not needed", async () => {
      const { loadConfig } = await import("../dist/config.js");
      const { getLastClaudeActivity } = await import("../dist/detectors/session.js");
      vi.mocked(loadConfig).mockResolvedValue({
        scheduleTime: "06:00", claudeEnabled: true, codexEnabled: false,
        lastRun: null,
        lastWarmupAt: { claude: new Date().toISOString(), codex: null },
        warmupIntervalSeconds: 18060, warmupMessage: "Hello",
        lastResult: { claude: null, codex: null }
      });
      vi.mocked(getLastClaudeActivity).mockReturnValue(null);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { runWarmup } = await import(CLI_PATH);
      await runWarmup();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("next warmup"));
      consoleSpy.mockRestore();
    });
  });
});
