import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("../../src/platform.js", () => ({
  detectPlatform: () => "windows",
}));

import { WindowsProvider } from "../../../src/providers/windows.js";
import { execFile } from "node:child_process";

const mockExecFile = vi.mocked(execFile);

function mockPowerShell(output: string) {
  mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
    if (typeof cb === "function") {
      cb(null, { stdout: output + "\n", stderr: "" });
    }
    return {} as any;
  });
}

function mockPowerShellError() {
  mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
    if (typeof cb === "function") {
      cb(new Error("not found"), { stdout: "", stderr: "" });
    }
    return {} as any;
  });
}

describe("WindowsProvider", () => {
  let provider: WindowsProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new WindowsProvider();
  });

  describe("get", () => {
    it("returns secret value on success", async () => {
      mockPowerShell("my-secret");
      const value = await provider.get("DB_PASSWORD");
      expect(value).toBe("my-secret");
    });

    it("returns secret value with explicit project", async () => {
      mockPowerShell("my-secret");
      const value = await provider.get("DB_PASSWORD", "website");
      expect(value).toBe("my-secret");
    });

    it("returns null when secret not found", async () => {
      mockPowerShellError();
      const value = await provider.get("MISSING", "website");
      expect(value).toBeNull();
    });
  });

  describe("set", () => {
    it("calls powershell to store credential", async () => {
      mockPowerShell("");
      await provider.set("TOKEN", "abc123", "myapp");
      expect(mockExecFile).toHaveBeenCalledTimes(1);
      const args = (mockExecFile as any).mock.calls[0][1];
      expect(args).toContain("-Command");
      const script = args[args.length - 1];
      expect(script).toContain("peekachu:myapp/TOKEN");
    });
  });

  describe("delete", () => {
    it("returns true on success", async () => {
      mockPowerShell("");
      expect(await provider.delete("TOKEN")).toBe(true);
    });

    it("returns false when not found", async () => {
      mockPowerShellError();
      expect(await provider.delete("MISSING", "website")).toBe(false);
    });
  });

  describe("list", () => {
    it("filters secrets by project prefix", async () => {
      mockPowerShell(
        "peekachu:website/DB_PASSWORD\npeekachu:website/API_KEY\npeekachu:default/OTHER",
      );
      const names = await provider.list("website");
      expect(names).toEqual(["DB_PASSWORD", "API_KEY"]);
    });

    it("lists default project secrets by default", async () => {
      mockPowerShell(
        "peekachu:default/SECRET_A\npeekachu:website/SECRET_B",
      );
      const names = await provider.list();
      expect(names).toEqual(["SECRET_A"]);
    });

    it("returns empty array on error", async () => {
      mockPowerShellError();
      const names = await provider.list();
      expect(names).toEqual([]);
    });
  });

  describe("listProjects", () => {
    it("returns unique project names sorted", async () => {
      mockPowerShell(
        "peekachu:website/DB_PASSWORD\npeekachu:api/API_KEY\npeekachu:website/OTHER\npeekachu:default/GLOBAL",
      );
      const projects = await provider.listProjects();
      expect(projects).toEqual(["api", "default", "website"]);
    });

    it("returns empty array on error", async () => {
      mockPowerShellError();
      const projects = await provider.listProjects();
      expect(projects).toEqual([]);
    });
  });

  describe("has", () => {
    it("returns true when secret exists", async () => {
      mockPowerShell("value");
      expect(await provider.has("TOKEN")).toBe(true);
    });

    it("returns false when secret does not exist", async () => {
      mockPowerShellError();
      expect(await provider.has("MISSING", "website")).toBe(false);
    });
  });
});
