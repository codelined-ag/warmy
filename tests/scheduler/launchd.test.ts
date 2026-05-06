import { describe, it, vi, beforeEach, afterEach, expect } from "vitest";
import { execSync } from "child_process";
import { writeFile } from "fs/promises";
import { homedir } from "os";

const PROJECT_ROOT = "/home/slay/projects/experiments/warmy/warmy";
const LAUNCHD_SRC_PATH = `${PROJECT_ROOT}/dist/scheduler/launchd.js`;

vi.mock("child_process", async () => {
  const actual = await vi.importActual("child_process");
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual("fs/promises");
  return {
    ...actual,
    writeFile: vi.fn(),
    chmod: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn().mockResolvedValue(undefined),
  };
});

describe("launchd", () => {
  const home = homedir();
  const expectedPlistPath = `${home}/Library/LaunchAgents/com.warmy.warmy.plist`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("installLaunchd", () => {
    it("should create plist file and load it", async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const { installLaunchd } = await import(LAUNCHD_SRC_PATH);
      await installLaunchd("/usr/local/bin/warmy");

      expect(execSync).toHaveBeenCalledWith(
        `launchctl load -w "${expectedPlistPath}"`,
        expect.any(Object)
      );
    });

    it("should set correct StartInterval in plist", async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const { installLaunchd } = await import(LAUNCHD_SRC_PATH);
      await installLaunchd("/usr/local/bin/warmy");

      const plistContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(plistContent).toContain("<integer>18060</integer>");
    });

    it("should include warmy path in ProgramArguments", async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const { installLaunchd } = await import(LAUNCHD_SRC_PATH);
      await installLaunchd("/usr/local/bin/warmy");

      const plistContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(plistContent).toContain("<string>/usr/local/bin/warmy</string>");
    });
  });

  describe("uninstallLaunchd", () => {
    it("should unload and remove plist", async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));

      const { uninstallLaunchd } = await import(LAUNCHD_SRC_PATH);
      await uninstallLaunchd();

      expect(execSync).toHaveBeenCalledWith(
        `launchctl unload -w "${expectedPlistPath}"`,
        expect.any(Object)
      );
    });
  });

  describe("isLaunchdInstalled", () => {
    it("should return a boolean", async () => {
      const { isLaunchdInstalled } = await import(LAUNCHD_SRC_PATH);
      const result = await isLaunchdInstalled();
      expect(typeof result).toBe("boolean");
    });
  });

  it("should validate warmyPath is absolute", async () => {
    const { installLaunchd } = await import(LAUNCHD_SRC_PATH);
    await expect(installLaunchd("relative/path")).rejects.toThrow("absolute path");
  });
});