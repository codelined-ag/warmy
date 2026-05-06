import { describe, it, vi, beforeEach, expect } from "vitest";

global.fetch = vi.fn();

const PROJECT_ROOT = "/home/slay/projects/experiments/warmy/warmy";
const OPENAI_SRC_PATH = `${PROJECT_ROOT}/dist/warmup/openai.js`;

describe("warmupOpenAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return success with reply on 200 response", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: "Warmed up!",
            },
          },
        ],
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { warmupOpenAI } = await import(OPENAI_SRC_PATH);
    const result = await warmupOpenAI("sk-proj-test");

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

    const { warmupOpenAI } = await import(OPENAI_SRC_PATH);
    const result = await warmupOpenAI("sk-proj-invalid");

    expect(result.success).toBe(false);
    expect(result.reply).toBeNull();
    expect(result.error).toContain("401");
    expect(result.error).toContain("Unauthorized");
  });

  it("should return error on network failure", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    const { warmupOpenAI } = await import(OPENAI_SRC_PATH);
    const result = await warmupOpenAI("sk-proj-test");

    expect(result.success).toBe(false);
    expect(result.reply).toBeNull();
    expect(result.error).toBe("Network error");
  });

  it("should use gpt-5.3-cod model", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: "OK" } }],
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { warmupOpenAI } = await import(OPENAI_SRC_PATH);
    await warmupOpenAI("sk-proj-test");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
      })
    );
    const call = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.model).toBe("gpt-4o-mini");
  });

  it("should handle response with missing message content", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: "" } }],
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { warmupOpenAI } = await import(OPENAI_SRC_PATH);
    const result = await warmupOpenAI("sk-proj-test");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("");
  });

  it("should handle empty choices array", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [],
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { warmupOpenAI } = await import(OPENAI_SRC_PATH);
    const result = await warmupOpenAI("sk-proj-test");

    expect(result.success).toBe(true);
    expect(result.reply).toBe("(no text)");
  });
});