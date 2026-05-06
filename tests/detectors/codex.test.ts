import { describe, it, vi, beforeEach, expect, afterEach } from "vitest";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { execSync } from "child_process";

const PROJECT_ROOT = "/home/slay/projects/experiments/warmy/warmy";
const CODEX_SRC_PATH = `${PROJECT_ROOT}/dist/detectors/codex.js`;

vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual("fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

vi.mock("os", async () => {
  const actual = await vi.importActual("os");
  return {
    ...actual,
    homedir: () => "/home/user",
  };
});

vi.mock("child_process", async () => {
  const actual = await vi.importActual("child_process");
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

describe("detectCodexCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null tokens when auth.json does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const { detectCodexCredentials } = await import(CODEX_SRC_PATH);
    const result = await detectCodexCredentials();

    expect(result.apiKey).toBeNull();
    expect(result.accessToken).toBeNull();
  });

  it("should return null when auth.json is invalid JSON", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue("not json");

    const { detectCodexCredentials } = await import(CODEX_SRC_PATH);
    const result = await detectCodexCredentials();

    expect(result.apiKey).toBeNull();
    expect(result.accessToken).toBeNull();
  });

  it("should extract OPENAI_API_KEY from auth.json", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      OPENAI_API_KEY: "sk-proj-abc123xyz",
      auth_mode: "apiKey",
    }));

    const { detectCodexCredentials } = await import(CODEX_SRC_PATH);
    const result = await detectCodexCredentials();

    expect(result.apiKey).toBe("sk-proj-abc123xyz");
    expect(result.accessToken).toBeNull();
  });

  it("should extract access_token from tokens object", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      auth_mode: "chatgpt",
      tokens: {
        access_token: "chatgpt_access_token_abc123",
      },
    }));

    const { detectCodexCredentials } = await import(CODEX_SRC_PATH);
    const result = await detectCodexCredentials();

    expect(result.apiKey).toBeNull();
    expect(result.accessToken).toBe("chatgpt_access_token_abc123");
  });

  it("should extract both apiKey and accessToken when both present", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      OPENAI_API_KEY: "sk-proj-abc123",
      auth_mode: "chatgpt",
      tokens: {
        access_token: "chatgpt_token",
      },
    }));

    const { detectCodexCredentials } = await import(CODEX_SRC_PATH);
    const result = await detectCodexCredentials();

    expect(result.apiKey).toBe("sk-proj-abc123");
    expect(result.accessToken).toBe("chatgpt_token");
  });

  it("should return null for non-sk API keys", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      OPENAI_API_KEY: "not-an-sk-key",
    }));

    const { detectCodexCredentials } = await import(CODEX_SRC_PATH);
    const result = await detectCodexCredentials();

    expect(result.apiKey).toBeNull();
  });

  it("should handle CODEX_HOME environment variable", async () => {
    process.env.CODEX_HOME = "/custom/path/.codex";
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      OPENAI_API_KEY: "sk-proj-custom",
    }));

    const { detectCodexCredentials } = await import(CODEX_SRC_PATH);
    const result = await detectCodexCredentials();

    expect(result.apiKey).toBe("sk-proj-custom");

    delete process.env.CODEX_HOME;
  });

  it("should return null when tokens.access_token is not a string", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      tokens: {
        access_token: null,
      },
    }));

    const { detectCodexCredentials } = await import(CODEX_SRC_PATH);
    const result = await detectCodexCredentials();

    expect(result.accessToken).toBeNull();
  });
});

describe("isCodexInstalled", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return true when codex --version succeeds", async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(""));

    const { isCodexInstalled } = await import(CODEX_SRC_PATH);
    const result = isCodexInstalled();

    expect(result).toBe(true);
  });

  it("should return false when codex --version fails", async () => {
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error("not found");
    });

    const { isCodexInstalled } = await import(CODEX_SRC_PATH);
    const result = isCodexInstalled();

    expect(result).toBe(false);
  });
});