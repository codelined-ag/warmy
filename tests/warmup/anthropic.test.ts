import { describe, it, vi, beforeEach, expect } from "vitest";

const PROJECT_ROOT = "/home/slay/projects/codex-projects/warmy/warmy";
const CLAUDE_SRC_PATH = `${PROJECT_ROOT}/dist/warmup/anthropic.js`;

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

describe("warmupClaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("should return error when no OAuth token found", async () => {
    const { readFileSync } = await import("fs");
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error("file not found"); });

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    const result = await warmupClaude("Hello");

    expect(result.success).toBe(false);
    expect(result.error).toContain("No Claude Code OAuth token found");
  });

  it("should return success with reply on 200 response", async () => {
    const { readFileSync } = await import("fs");
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      claudeAiOauth: { accessToken: "sk-ant-oat01-test" }
    }));

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Warmed up!" }],
      }),
    } as any);

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    const result = await warmupClaude("Hello");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("Warmed up!");
    expect(result.error).toBeNull();
  });

  it("should return error on API failure", async () => {
    const { readFileSync } = await import("fs");
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      claudeAiOauth: { accessToken: "sk-ant-oat01-test" }
    }));

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: vi.fn().mockResolvedValue("Invalid token"),
    } as any);

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    const result = await warmupClaude("Hello");

    expect(result.success).toBe(false);
    expect(result.error).toContain("401");
  });

  it("should use custom message in API call", async () => {
    const { readFileSync } = await import("fs");
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      claudeAiOauth: { accessToken: "sk-ant-oat01-test" }
    }));

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "OK" }] }),
    } as any);

    const { warmupClaude } = await import(CLAUDE_SRC_PATH);
    await warmupClaude("Custom message");

    const callBody = JSON.parse((vi.mocked(global.fetch).mock.calls[0][1] as any).body);
    expect(callBody.messages[0].content).toBe("Custom message");
  });
});
