import { describe, it, vi, beforeEach, afterEach, expect } from "vitest";
import { execSync } from "child_process";
import { writeFile, chmod, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";

const PROJECT_ROOT = "/home/slay/projects/experiments/warmy/warmy";
const CRON_SRC_PATH = `${PROJECT_ROOT}/dist/scheduler/cron.js`;

vi.mock("child_process", async () => {
  const actual = await vi.importActual("child_process");
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

describe("cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("installCron", () => {
    it("should add warmy entry to crontab via temp file", async () => {
      vi.mocked(execSync).mockReturnValue("");

      const { installCron } = await import(CRON_SRC_PATH);
      await installCron("/usr/local/bin/warmy");

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("crontab"),
        expect.any(Object)
      );
    });

    it("should preserve existing crontab entries", async () => {
      vi.mocked(execSync)
        .mockReturnValueOnce("0 * * * * some-other-job")
        .mockReturnValueOnce("");

      const { installCron } = await import(CRON_SRC_PATH);
      await installCron("/usr/local/bin/warmy");

      expect(execSync).toHaveBeenCalledTimes(2);
    });

    it("should remove existing warmy entries before adding", async () => {
      vi.mocked(execSync)
        .mockReturnValueOnce("0 6 * * * /usr/local/bin/warmy run\n0 * * * * other")
        .mockReturnValueOnce("");

      const { installCron } = await import(CRON_SRC_PATH);
      await installCron("/usr/local/bin/warmy");

      expect(execSync).toHaveBeenCalledTimes(2);
      const secondCall = vi.mocked(execSync).mock.calls[1];
      const crontabCmd = secondCall[0] as string;
      expect(crontabCmd).toContain("crontab");
      expect(crontabCmd).toContain("/tmp/warmy-cron-");
    });
  });

  describe("uninstallCron", () => {
    it("should remove warmy entry from crontab", async () => {
      vi.mocked(execSync)
        .mockReturnValueOnce("0 6 * * * /usr/local/bin/warmy run\n0 * * * * other")
        .mockReturnValueOnce("");

      const { uninstallCron } = await import(CRON_SRC_PATH);
      await expect(uninstallCron()).resolves.not.toThrow();

      expect(execSync).toHaveBeenCalledTimes(2);
    });
  });

  describe("isCronInstalled", () => {
    it("should return true when warmy entry exists", async () => {
      vi.mocked(execSync).mockReturnValue("0 6 * * * /usr/local/bin/warmy run");

      const { isCronInstalled } = await import(CRON_SRC_PATH);
      const result = await isCronInstalled();

      expect(result).toBe(true);
    });

    it("should return false when no warmy entry exists", async () => {
      vi.mocked(execSync).mockReturnValue("0 * * * * other");

      const { isCronInstalled } = await import(CRON_SRC_PATH);
      const result = await isCronInstalled();

      expect(result).toBe(false);
    });

    it("should return false when crontab is empty", async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("no crontab");
      });

      const { isCronInstalled } = await import(CRON_SRC_PATH);
      const result = await isCronInstalled();

      expect(result).toBe(false);
    });
  });

  it("should validate warmyPath is absolute", async () => {
    vi.mocked(execSync).mockReturnValue("");

    const { installCron } = await import(CRON_SRC_PATH);
    await expect(installCron("relative/path")).rejects.toThrow("absolute path");
  });

  it("should write crontab to temp file before installing", async () => {
    vi.mocked(execSync).mockReturnValue("");

    const { installCron } = await import(CRON_SRC_PATH);
    await installCron("/usr/local/bin/warmy");

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("/tmp/warmy-cron-"),
      expect.any(Object)
    );
  });
});