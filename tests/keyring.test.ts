import { describe, it, vi, expect } from "vitest";

vi.mock("keytar", () => ({
  default: {
    setPassword: vi.fn().mockResolvedValue(undefined),
    getPassword: vi.fn().mockResolvedValue(null),
    deletePassword: vi.fn().mockResolvedValue(true),
  },
}));

describe("keyring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("storeToken", () => {
    it("should store token for claude account", async () => {
      const keytar = await import("keytar");
      const { storeToken } = await import("../dist/keyring.js");

      await storeToken("claude", "sk-ant-test123");

      expect(keytar.default.setPassword).toHaveBeenCalledWith(
        "warmy",
        "claude-code",
        "sk-ant-test123"
      );
    });

    it("should store token for codex account", async () => {
      const keytar = await import("keytar");
      const { storeToken } = await import("../dist/keyring.js");

      await storeToken("codex", "sk-test456");

      expect(keytar.default.setPassword).toHaveBeenCalledWith(
        "warmy",
        "codex-cli",
        "sk-test456"
      );
    });
  });

  describe("getToken", () => {
    it("should return token for claude account", async () => {
      const keytar = await import("keytar");
      keytar.default.getPassword.mockResolvedValueOnce("sk-ant-token123");

      const { getToken } = await import("../dist/keyring.js");
      const result = await getToken("claude");

      expect(result).toBe("sk-ant-token123");
      expect(keytar.default.getPassword).toHaveBeenCalledWith("warmy", "claude-code");
    });

    it("should return token for codex account", async () => {
      const keytar = await import("keytar");
      keytar.default.getPassword.mockResolvedValueOnce("sk-token456");

      const { getToken } = await import("../dist/keyring.js");
      const result = await getToken("codex");

      expect(result).toBe("sk-token456");
      expect(keytar.default.getPassword).toHaveBeenCalledWith("warmy", "codex-cli");
    });

    it("should return null when token not found", async () => {
      const keytar = await import("keytar");
      keytar.default.getPassword.mockResolvedValueOnce(null);

      const { getToken } = await import("../dist/keyring.js");
      const result = await getToken("claude");

      expect(result).toBeNull();
    });
  });

  describe("removeToken", () => {
    it("should remove token for claude account", async () => {
      const keytar = await import("keytar");
      const { removeToken } = await import("../dist/keyring.js");

      const result = await removeToken("claude");

      expect(result).toBe(true);
      expect(keytar.default.deletePassword).toHaveBeenCalledWith("warmy", "claude-code");
    });

    it("should remove token for codex account", async () => {
      const keytar = await import("keytar");
      const { removeToken } = await import("../dist/keyring.js");

      const result = await removeToken("codex");

      expect(result).toBe(true);
      expect(keytar.default.deletePassword).toHaveBeenCalledWith("warmy", "codex-cli");
    });
  });

});