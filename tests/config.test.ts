import { describe, it, vi, beforeEach, expect } from "vitest";
import { existsSync, renameSync, unlinkSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { platform } from "os";

const PROJECT_ROOT = "/home/slay/projects/codex-projects/warmy/warmy";
const CONFIG_SRC_PATH = `${PROJECT_ROOT}/dist/config.js`;

vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual("fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  };
});

vi.mock("os", async () => {
  const actual = await vi.importActual("os");
  return {
    ...actual,
    homedir: () => "/home/user",
    platform: vi.fn(),
  };
});

describe("config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(renameSync).mockReturnValue(undefined);
    vi.mocked(unlinkSync).mockReturnValue(undefined);
  });

  describe("loadConfig", () => {
    it("should return default config when file does not exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const { loadConfig } = await import(CONFIG_SRC_PATH);
      const result = await loadConfig();

      expect(result.scheduleTime).toBe("06:00");
      expect(result.claudeEnabled).toBe(false);
      expect(result.codexEnabled).toBe(false);
      expect(result.timezone).toBeTruthy();
    });

    it("should load existing config", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          scheduleTime: "07:30",
          claudeEnabled: true,
          codexEnabled: false,
        })
      );

      const { loadConfig } = await import(CONFIG_SRC_PATH);
      const result = await loadConfig();

      expect(result.scheduleTime).toBe("07:30");
      expect(result.claudeEnabled).toBe(true);
      expect(result.codexEnabled).toBe(false);
      expect(result.timezone).toBeTruthy();
    });

    it("should merge with defaults for missing fields", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({}));

      const { loadConfig } = await import(CONFIG_SRC_PATH);
      const result = await loadConfig();

      expect(result.scheduleTime).toBe("06:00");
      expect(result.timezone).toBeTruthy();
    });
  });

  describe("saveConfig", () => {
    it("should create directory and write config file atomically", async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(existsSync).mockReturnValue(true);

      const { saveConfig } = await import(CONFIG_SRC_PATH);
      await saveConfig({
        scheduleTime: "08:00",
        claudeEnabled: true,
        codexEnabled: true,
        lastRun: null,
        lastWarmupAt: { claude: null, codex: null },
        warmupIntervalSeconds: 18060,
        warmupMessage: "Hello",
        lastResult: { claude: null, codex: null },
        timezone: "America/New_York",
      });

      expect(mkdir).toHaveBeenCalledWith("/home/user/.warmy", {
        recursive: true,
        mode: 0o700,
      });
      expect(writeFile).toHaveBeenCalledWith(
        "/home/user/.warmy/config.json.tmp",
        expect.any(String),
        "utf-8"
      );
      expect(renameSync).toHaveBeenCalledWith(
        "/home/user/.warmy/config.json.tmp",
        "/home/user/.warmy/config.json"
      );
    });
  });

  describe("detectTimezone", () => {
    it("should return valid timezone string", async () => {
      const { detectTimezone } = await import(CONFIG_SRC_PATH);
      const tz = detectTimezone();
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  describe("formatInTimezone", () => {
    it("should format ISO string in given timezone", async () => {
      const { formatInTimezone } = await import(CONFIG_SRC_PATH);
      const result = formatInTimezone("2026-01-01T00:00:00.000Z", "UTC");
      expect(result).toContain("UTC");
    });

    it("should return dash for null input", async () => {
      const { formatInTimezone } = await import(CONFIG_SRC_PATH);
      expect(formatInTimezone(null, "UTC")).toBe("—");
    });

    it("should handle non-UTC timezone", async () => {
      const { formatInTimezone } = await import(CONFIG_SRC_PATH);
      const result = formatInTimezone("2026-01-01T00:00:00.000Z", "America/New_York");
      expect(result).toContain("America/New_York");
    });
  });

  describe("getPlatform", () => {
    it("should return linux for Linux platform", async () => {
      vi.mocked(platform).mockReturnValue("linux");

      const { getPlatform } = await import(CONFIG_SRC_PATH);
      expect(getPlatform()).toBe("linux");
    });

    it("should return macos for Darwin platform", async () => {
      vi.mocked(platform).mockReturnValue("darwin");

      const { getPlatform } = await import(CONFIG_SRC_PATH);
      expect(getPlatform()).toBe("macos");
    });

    it("should return windows for Windows platform", async () => {
      vi.mocked(platform).mockReturnValue("win32");

      const { getPlatform } = await import(CONFIG_SRC_PATH);
      expect(getPlatform()).toBe("windows");
    });
  });
});
