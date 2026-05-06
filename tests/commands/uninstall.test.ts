import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("../../dist/config.js", () => ({
  getConfigPath: vi.fn().mockReturnValue("/tmp/.warmy/config.json"),
}));
vi.mock("../../dist/scheduler/index.js", () => ({ uninstallScheduler: vi.fn() }));
vi.mock("../../dist/keyring.js", () => ({ removeToken: vi.fn() }));

const UNINSTALL_PATH = "/home/slay/projects/experiments/warmy/warmy/dist/commands/uninstall.js";

describe("uninstall", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should uninstall scheduler and remove tokens and config", async () => {
    const { uninstallScheduler } = await import("../../dist/scheduler/index.js");
    const { removeToken } = await import("../../dist/keyring.js");
    vi.mocked(uninstallScheduler).mockResolvedValue(undefined);
    vi.mocked(removeToken).mockResolvedValue(true);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { uninstall } = await import(UNINSTALL_PATH);
    await uninstall();

    expect(uninstallScheduler).toHaveBeenCalled();
    expect(removeToken).toHaveBeenCalledWith("claude");
    expect(removeToken).toHaveBeenCalledWith("codex");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Scheduler removed"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Tokens removed"));
    consoleSpy.mockRestore();
  });

  it("should handle scheduler failure gracefully", async () => {
    const { uninstallScheduler } = await import("../../dist/scheduler/index.js");
    const { removeToken } = await import("../../dist/keyring.js");
    vi.mocked(uninstallScheduler).mockRejectedValue(new Error("no cron"));
    vi.mocked(removeToken).mockResolvedValue(true);

    const { uninstall } = await import(UNINSTALL_PATH);
    await expect(uninstall()).resolves.not.toThrow();
    expect(removeToken).toHaveBeenCalled();
  });

  it("should handle all failures gracefully", async () => {
    const { uninstallScheduler } = await import("../../dist/scheduler/index.js");
    const { removeToken } = await import("../../dist/keyring.js");
    vi.mocked(uninstallScheduler).mockRejectedValue(new Error("no cron"));
    vi.mocked(removeToken).mockRejectedValue(new Error("no keychain"));

    const { uninstall } = await import(UNINSTALL_PATH);
    await expect(uninstall()).resolves.not.toThrow();
  });
});
