import { describe, it, vi, beforeEach, expect } from "vitest";

global.fetch = vi.fn();

const PROJECT_ROOT = "/home/slay/projects/experiments/warmy/warmy";
const ANTHROPIC_SRC_PATH = `${PROJECT_ROOT}/dist/warmup/anthropic.js`;

describe("warmupAnthropic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return success with reply on 200 response", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Warmed up!" }],
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { warmupAnthropic } = await import(ANTHROPIC_SRC_PATH);
    const result = await warmupAnthropic("sk-ant-api03-test", "Hello");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("Warmed up!");
    expect(result.error).toBeNull();
  });

  it("should return error on non-200 response", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: vi.fn().mockResolvedValue("Invalid API key"),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { warmupAnthropic } = await import(ANTHROPIC_SRC_PATH);
    const result = await warmupAnthropic("sk-ant-api03-invalid");

    expect(result.success).toBe(false);
    expect(result.reply).toBeNull();
    expect(result.error).toContain("401");
    expect(result.error).toContain("Unauthorized");
  });

  it("should return error on network failure", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    const { warmupAnthropic } = await import(ANTHROPIC_SRC_PATH);
    const result = await warmupAnthropic("sk-ant-api03-test");

    expect(result.success).toBe(false);
    expect(result.reply).toBeNull();
    expect(result.error).toBe("Network error");
  });

  it("should use default warmup message when none provided", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Warmed up!" }],
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { warmupAnthropic } = await import(ANTHROPIC_SRC_PATH);
    await warmupAnthropic("sk-ant-api03-test");

    const call = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
    expect(body.messages[0].content).toContain("automated warm-up");
  });

  it("should use custom message when provided", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "OK" }],
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { warmupAnthropic } = await import(ANTHROPIC_SRC_PATH);
    await warmupAnthropic("sk-ant-api03-test", "Custom message");

    const call = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
    expect(body.messages[0].content).toBe("Custom message");
  });

  it("should handle response with no text content block", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [],
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { warmupAnthropic } = await import(ANTHROPIC_SRC_PATH);
    const result = await warmupAnthropic("sk-ant-api03-test");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("(no text)");
  });
});