import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

const PROJECT_ROOT = "/home/slay/projects/codex-projects/warmy/warmy";
const CODEX_SRC_PATH = `${PROJECT_ROOT}/dist/warmup/openai.js`;

describe("warmupCodex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return success with reply on successful codex CLI call", async () => {
    const { spawnSync } = await import("child_process");
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "Warmed up!",
      stderr: "",
      pid: 1,
      output: [],
      signal: null,
    } as any);

    const { warmupCodex } = await import(CODEX_SRC_PATH);
    const result = warmupCodex("Hello Claude. Howdy?");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("Warmed up!");
    expect(result.error).toBeNull();
  });

  it("should pass the message as a separate argv entry (no shell)", async () => {
    const { spawnSync } = await import("child_process");
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "OK",
      stderr: "",
      pid: 1,
      output: [],
      signal: null,
    } as any);

    const { warmupCodex } = await import(CODEX_SRC_PATH);
    warmupCodex("Custom message");

    const call = vi.mocked(spawnSync).mock.calls[0];
    const args = call[1] as string[];
    expect(args).toContain("Custom message");
    const opts = call[2] as { shell?: boolean };
    expect(opts.shell).toBe(false);
  });

  it("should return error when codex CLI exits non-zero", async () => {
    const { spawnSync } = await import("child_process");
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "Codex not found",
      pid: 1,
      output: [],
      signal: null,
    } as any);

    const { warmupCodex } = await import(CODEX_SRC_PATH);
    const result = warmupCodex("Hello");

    expect(result.success).toBe(false);
    expect(result.reply).toBeNull();
    expect(result.error).toContain("Codex not found");
  });

  it("should trim whitespace from CLI output", async () => {
    const { spawnSync } = await import("child_process");
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "  OK  \n",
      stderr: "",
      pid: 1,
      output: [],
      signal: null,
    } as any);

    const { warmupCodex } = await import(CODEX_SRC_PATH);
    const result = warmupCodex("Hello");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("OK");
  });
});
