import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("child_process", () => ({
  spawnSync: vi.fn(),
}));

const PROJECT_ROOT = "/home/slay/projects/codex-projects/warmy/warmy";
const CLAUDE_SRC_PATH = `${PROJECT_ROOT}/dist/warmup/anthropic.js`;

describe("warmupClaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success and trims claude -p stdout", async () => {
    const { spawnSync } = await import("child_process");
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "  ok  \n",
      stderr: "",
      pid: 1,
      output: [],
      signal: null,
    } as any);

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    const result = await warmupClaude("Hello");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("ok");
    expect(result.error).toBeNull();
  });

  it("invokes claude with -p, --model, --setting-sources user, and the message as a separate argv entry", async () => {
    const { spawnSync } = await import("child_process");
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "ok",
      stderr: "",
      pid: 1,
      output: [],
      signal: null,
    } as any);

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    await warmupClaude("Custom message");

    const call = vi.mocked(spawnSync).mock.calls[0];
    const args = call[1] as string[];
    expect(args).toContain("-p");
    expect(args).toContain("--model");
    expect(args).toContain("--setting-sources");
    expect(args).toContain("user");
    expect(args).toContain("Custom message");
    const opts = call[2] as { shell?: boolean };
    expect(opts.shell).toBe(false);
  });

  it("returns error when claude exits non-zero, surfacing stderr first line", async () => {
    const { spawnSync } = await import("child_process");
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "Authentication failed\nstack trace line 2",
      pid: 1,
      output: [],
      signal: null,
    } as any);

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    const result = await warmupClaude("Hello");

    expect(result.success).toBe(false);
    expect(result.reply).toBeNull();
    expect(result.error).toBe("Authentication failed");
  });

  it("returns error when spawn itself fails (claude binary missing)", async () => {
    const { spawnSync } = await import("child_process");
    vi.mocked(spawnSync).mockReturnValue({
      status: null,
      stdout: "",
      stderr: "",
      pid: 0,
      output: [],
      signal: null,
      error: Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" }),
    } as any);

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    const result = await warmupClaude("Hello");

    expect(result.success).toBe(false);
    expect(result.error).toContain("ENOENT");
  });
});
