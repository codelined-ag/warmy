import { describe, it, vi, beforeEach, expect, afterEach } from "vitest";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { execSync } from "child_process";

const PROJECT_ROOT = "/home/slay/projects/codex-projects/warmy/warmy";
const CLAUDE_SRC_PATH = `${PROJECT_ROOT}/dist/detectors/claude.js`;

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

describe("detectClaudeCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null tokens when credentials file does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const { detectClaudeCredentials } = await import(CLAUDE_SRC_PATH);
    const result = await detectClaudeCredentials();

    expect(result.apiKey).toBeNull();
    expect(result.oauthToken).toBeNull();
  });

  it("should return null when credentials file is invalid JSON", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue("not json");

    const { detectClaudeCredentials } = await import(CLAUDE_SRC_PATH);
    const result = await detectClaudeCredentials();

    expect(result.apiKey).toBeNull();
    expect(result.oauthToken).toBeNull();
  });

  it("should extract API key from credentials file", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      anthropic: {
        credentials: {
          key: "sk-ant-api03-abc123xyz",
        },
      },
    }));

    const { detectClaudeCredentials } = await import(CLAUDE_SRC_PATH);
    const result = await detectClaudeCredentials();

    expect(result.apiKey).toBe("sk-ant-api03-abc123xyz");
    expect(result.oauthToken).toBeNull();
  });

  it("should return null for non-anthropic keys", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      anthropic: {
        credentials: {
          key: "sk-other-key",
        },
      },
    }));

    const { detectClaudeCredentials } = await import(CLAUDE_SRC_PATH);
    const result = await detectClaudeCredentials();

    expect(result.apiKey).toBeNull();
  });

  it("should return null when anthropic.credentials is missing", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      azure: {
        credentials: {
          key: "some-key",
        },
      },
    }));

    const { detectClaudeCredentials } = await import(CLAUDE_SRC_PATH);
    const result = await detectClaudeCredentials();

    expect(result.apiKey).toBeNull();
  });

  it("should handle empty credentials object", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({}));

    const { detectClaudeCredentials } = await import(CLAUDE_SRC_PATH);
    const result = await detectClaudeCredentials();

    expect(result.apiKey).toBeNull();
  });
});

describe("isClaudeInstalled", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return true when claude --version succeeds", async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(""));

    const { isClaudeInstalled } = await import(CLAUDE_SRC_PATH);
    const result = isClaudeInstalled();

    expect(result).toBe(true);
  });

  it("should return false when claude --version fails", async () => {
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error("not found");
    });

    const { isClaudeInstalled } = await import(CLAUDE_SRC_PATH);
    const result = isClaudeInstalled();

    expect(result).toBe(false);
  });
});