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

const PROJECT_ROOT = "/home/slay/projects/codex-projects/warmy/warmy";
const SESSION_PATH = `${PROJECT_ROOT}/dist/detectors/session.js`;

describe("getNextClaudeWarmup", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 0 when sessions dir missing", async () => {
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockImplementation((p: string) => {
      if (p.toString().includes("history.jsonl")) return false;
      return true;
    });

    const { getNextClaudeWarmup } = await import(SESSION_PATH);
    expect(getNextClaudeWarmup()).toBe(0);
  });

  it("should return 0 when history file empty", async () => {
    const { existsSync, readFileSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("");

    const { getNextClaudeWarmup } = await import(SESSION_PATH);
    expect(getNextClaudeWarmup()).toBe(0);
  });
});

describe("getNextCodexWarmup", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 0 when db missing", async () => {
    const { existsSync, readdirSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readdirSync).mockReturnValue([] as any);

    const { getNextCodexWarmup } = await import(SESSION_PATH);
    expect(getNextCodexWarmup()).toBe(0);
  });

  it("should return 0 when ~/.codex has no logs_*.sqlite at all", async () => {
    const { existsSync, readdirSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([
      "auth.json",
      "config.toml",
      "history.jsonl",
    ] as any);

    const { getNextCodexWarmup } = await import(SESSION_PATH);
    expect(getNextCodexWarmup()).toBe(0);
  });

  it("picks the highest-versioned logs_*.sqlite when codex bumps schema", async () => {
    const { existsSync, readdirSync } = await import("fs");
    const { execSync } = await import("child_process");

    vi.mocked(readdirSync).mockReturnValue([
      "logs_1.sqlite",
      "logs_2.sqlite",
      "auth.json",
    ] as any);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockReturnValue("" as any);

    const { getNextCodexWarmup } = await import(SESSION_PATH);
    getNextCodexWarmup();

    const calls = vi.mocked(execSync).mock.calls.map((c) => String(c[0]));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.includes("logs_2.sqlite"))).toBe(true);
    expect(calls.some((c) => c.includes("logs_1.sqlite"))).toBe(false);
  });
});
