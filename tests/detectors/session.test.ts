import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return { ...actual, readFileSync: vi.fn(), readdirSync: vi.fn(), existsSync: vi.fn() };
});

vi.mock("child_process", () => {
  const mockExec = vi.fn();
  mockExec.mockImplementation(() => { throw new Error("not found"); });
  return { execSync: mockExec };
});

const PROJECT_ROOT = "/home/slay/projects/experiments/warmy/warmy";
const SESSION_PATH = `${PROJECT_ROOT}/dist/detectors/session.js`;

describe("getLastClaudeActivity", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return null when sessions dir missing", async () => {
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(false);

    const { getLastClaudeActivity } = await import(SESSION_PATH);
    expect(getLastClaudeActivity()).toBeNull();
  });

  it("should return null when no session files", async () => {
    const { existsSync, readdirSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([]);

    const { getLastClaudeActivity } = await import(SESSION_PATH);
    expect(getLastClaudeActivity()).toBeNull();
  });

  it("should return latest updatedAt from session files", async () => {
    const { existsSync, readdirSync, readFileSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(["a.json", "b.json"]);
    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify({ updatedAt: 1000 }))
      .mockReturnValueOnce(JSON.stringify({ updatedAt: 2000 }));

    const { getLastClaudeActivity } = await import(SESSION_PATH);
    expect(getLastClaudeActivity()).toBe(2000);
  });

  it("should handle unparseable session files", async () => {
    const { existsSync, readdirSync, readFileSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(["bad.json", "good.json"]);
    vi.mocked(readFileSync)
      .mockReturnValueOnce("invalid json")
      .mockReturnValueOnce(JSON.stringify({ updatedAt: 500 }));

    const { getLastClaudeActivity } = await import(SESSION_PATH);
    expect(getLastClaudeActivity()).toBe(500);
  });

  it("should filter non-json files", async () => {
    const { existsSync, readdirSync, readFileSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(["a.json", "b.txt", "c.json"]);
    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify({ updatedAt: 100 }))
      .mockReturnValueOnce(JSON.stringify({ updatedAt: 200 }));

    const { getLastClaudeActivity } = await import(SESSION_PATH);
    expect(getLastClaudeActivity()).toBe(200);
  });
});

describe("getLastCodexActivity", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return null when db missing", async () => {
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(false);

    const { getLastCodexActivity } = await import(SESSION_PATH);
    expect(getLastCodexActivity()).toBeNull();
  });

  it("should return timestamp from sqlite query", async () => {
    const { existsSync } = await import("fs");
    const { execSync } = await import("child_process");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync)
      .mockImplementationOnce(() => { throw new Error("not found"); })
      .mockReturnValueOnce("1700000000");

    const { getLastCodexActivity } = await import(SESSION_PATH);
    expect(getLastCodexActivity()).toBe(1700000000000);
  });

  it("should return null when sqlite returns empty", async () => {
    const { existsSync } = await import("fs");
    const { execSync } = await import("child_process");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync)
      .mockImplementationOnce(() => { throw new Error("not found"); })
      .mockReturnValueOnce("");

    const { getLastCodexActivity } = await import(SESSION_PATH);
    expect(getLastCodexActivity()).toBeNull();
  });

  it("should handle sqlite errors", async () => {
    const { existsSync } = await import("fs");
    const { execSync } = await import("child_process");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync)
      .mockImplementationOnce(() => { throw new Error("not found"); })
      .mockImplementationOnce(() => { throw new Error("sqlite failed"); });

    const { getLastCodexActivity } = await import(SESSION_PATH);
    expect(getLastCodexActivity()).toBeNull();
  });
});
