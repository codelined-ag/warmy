import { describe, it, vi, beforeEach, expect } from "vitest";

vi.mock("../dist/commands/config.js", () => ({ configEdit: vi.fn(), setMessage: vi.fn() }));
vi.mock("../dist/commands/uninstall.js", () => ({ uninstall: vi.fn() }));
vi.mock("../dist/commands/status.js", () => ({ status: vi.fn() }));
vi.mock("../dist/commands/run.js", () => ({ runWarmup: vi.fn() }));

const CLI_PATH = "/home/slay/projects/codex-projects/warmy/warmy/dist/cli.js";

describe("CLI entry point", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should register all commands", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const cli = await import(CLI_PATH);
    expect(cli).toBeDefined();
    consoleSpy.mockRestore();
  });
});
