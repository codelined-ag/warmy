import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

const PROJECT_ROOT = "/home/slay/projects/experiments/warmy/warmy";
const CLAUDE_SRC_PATH = `${PROJECT_ROOT}/dist/warmup/anthropic.js`;

describe("warmupClaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return success with reply on successful claude CLI call", async () => {
    const { execSync } = await import("child_process");
    vi.mocked(execSync).mockReturnValue("Warmed up!");

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    const result = warmupClaude("Hello Claude. Howdy?");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("Warmed up!");
    expect(result.error).toBeNull();
  });

  it("should use the provided message in the claude command", async () => {
    const { execSync } = await import("child_process");
    vi.mocked(execSync).mockReturnValue("Hi!");

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    warmupClaude("Custom message");

    expect(vi.mocked(execSync).mock.calls[0][0]).toContain("Custom message");
  });

  it("should return error when claude CLI fails", async () => {
    const { execSync } = await import("child_process");
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("Claude not found");
    });

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    const result = warmupClaude("Hello");

    expect(result.success).toBe(false);
    expect(result.reply).toBeNull();
    expect(result.error).toBe("Claude not found");
  });

  it("should trim whitespace from CLI output", async () => {
    const { execSync } = await import("child_process");
    vi.mocked(execSync).mockReturnValue("  Warmed up!  \n");

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    const result = warmupClaude("Hello");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("Warmed up!");
  });
});
