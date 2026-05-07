import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

const PROJECT_ROOT = "/home/slay/projects/codex-projects/warmy/warmy";
const CODEX_SRC_PATH = `${PROJECT_ROOT}/dist/warmup/openai.js`;

describe("warmupCodex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return success with reply on successful codex CLI call", async () => {
    const { execSync } = await import("child_process");
    vi.mocked(execSync).mockReturnValue("Warmed up!");

    const { warmupCodex } = await import(CODEX_SRC_PATH);
    const result = warmupCodex("Hello Claude. Howdy?");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("Warmed up!");
    expect(result.error).toBeNull();
  });

  it("should use the provided message in the codex command", async () => {
    const { execSync } = await import("child_process");
    vi.mocked(execSync).mockReturnValue("OK");

    const { warmupCodex } = await import(CODEX_SRC_PATH);
    warmupCodex("Custom message");

    expect(vi.mocked(execSync).mock.calls[0][0]).toContain("Custom message");
  });

  it("should return error when codex CLI fails", async () => {
    const { execSync } = await import("child_process");
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("Codex not found");
    });

    const { warmupCodex } = await import(CODEX_SRC_PATH);
    const result = warmupCodex("Hello");

    expect(result.success).toBe(false);
    expect(result.reply).toBeNull();
    expect(result.error).toBe("Codex not found");
  });

  it("should trim whitespace from CLI output", async () => {
    const { execSync } = await import("child_process");
    vi.mocked(execSync).mockReturnValue("  OK  \n");

    const { warmupCodex } = await import(CODEX_SRC_PATH);
    const result = warmupCodex("Hello");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("OK");
  });
});
