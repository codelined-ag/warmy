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
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(false);

    const { getNextCodexWarmup } = await import(SESSION_PATH);
    expect(getNextCodexWarmup()).toBe(0);
  });
});
