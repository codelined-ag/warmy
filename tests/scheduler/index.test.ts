import { describe, it, vi, expect, beforeEach } from "vitest";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";

const PROJECT_ROOT = "/home/slay/projects/experiments/warmy/warmy";
const INDEX_SRC_PATH = `${PROJECT_ROOT}/dist/scheduler/index.js`;

vi.mock("child_process", async () => {
  const actual = await vi.importActual("child_process");
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

describe("scheduler/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("installScheduler", () => {
    it("should route to launchd on macos", async () => {
      const { getPlatform } = await import(`${PROJECT_ROOT}/dist/config.js`);
      const orig = getPlatform;
      Object.defineProperty(await import(`${PROJECT_ROOT}/dist/config.js`), "getPlatform", {
        get: () => () => "macos",
      });

      const { installScheduler } = await import(INDEX_SRC_PATH);
      await installScheduler("/usr/local/bin/warmy");

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("launchctl"),
        expect.any(Object)
      );
    });
  });

  describe("isSchedulerInstalled", () => {
    it("should return true when launchd plist exists on macos", async () => {
      Object.defineProperty(await import(`${PROJECT_ROOT}/dist/config.js`), "getPlatform", {
        get: () => () => "macos",
      });

      vi.mocked(existsSync).mockReturnValue(true);

      const { isSchedulerInstalled } = await import(INDEX_SRC_PATH);
      const result = await isSchedulerInstalled();

      expect(result).toBe(true);
    });

    it("should return false when launchd plist does not exist on macos", async () => {
      Object.defineProperty(await import(`${PROJECT_ROOT}/dist/config.js`), "getPlatform", {
        get: () => () => "macos",
      });

      vi.mocked(existsSync).mockReturnValue(false);

      const { isSchedulerInstalled } = await import(INDEX_SRC_PATH);
      const result = await isSchedulerInstalled();

      expect(result).toBe(false);
    });

    it("should check crontab on linux", async () => {
      Object.defineProperty(await import(`${PROJECT_ROOT}/dist/config.js`), "getPlatform", {
        get: () => () => "linux",
      });

      vi.mocked(execSync).mockReturnValue("*/5 * * * * /usr/local/bin/warmy run >> /tmp/warmy.log 2>&1");

      const { isSchedulerInstalled } = await import(INDEX_SRC_PATH);
      const result = await isSchedulerInstalled();

      expect(result).toBe(true);
    });
  });
});