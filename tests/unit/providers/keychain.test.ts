import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process before importing the module
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("../../src/platform.js", () => ({
  detectPlatform: () => "macos",
}));

import { KeychainProvider } from "../../../src/providers/keychain.js";
import { execFile } from "node:child_process";

const mockExecFile = vi.mocked(execFile);

// Helper: build a realistic dump-keychain entry (acct before svce, alphabetical)
function dumpEntry(service: string, account: string): string {
  return [
    'class: "genp"',
    "attributes:",
    `    0x00000007 <blob>="${service}"`,
    `    "acct"<blob>="${account}"`,
    '    "cdat"<timedate>=0x00',
    `    "svce"<blob>="${service}"`,
    '    "type"<uint32>=<NULL>',
  ].join("\n");
}

describe("KeychainProvider", () => {
  let provider: KeychainProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new KeychainProvider();
  });

  describe("get", () => {
    it("returns secret value on success (default project)", async () => {
      mockExecFile.mockImplementation((_cmd: any, args: any, cb: any) => {
        if (typeof cb === "function") {
          expect(args).toContain("default/DB_PASSWORD");
          cb(null, { stdout: "my-secret\n", stderr: "" });
        }
        return {} as any;
      });

      const value = await provider.get("DB_PASSWORD");
      expect(value).toBe("my-secret");
    });

    it("returns secret value with explicit project", async () => {
      mockExecFile.mockImplementation((_cmd: any, args: any, cb: any) => {
        if (typeof cb === "function") {
          expect(args).toContain("website/DB_PASSWORD");
          cb(null, { stdout: "my-secret\n", stderr: "" });
        }
        return {} as any;
      });

      const value = await provider.get("DB_PASSWORD", "website");
      expect(value).toBe("my-secret");
    });

    it("returns null when secret not found", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") {
          const err = Object.assign(new Error("not found"), { code: 44 });
          cb(err, { stdout: "", stderr: "" });
        }
        return {} as any;
      });

      const value = await provider.get("MISSING");
      expect(value).toBeNull();
    });

    it("falls back to legacy unprefixed key for default project", async () => {
      let callCount = 0;
      mockExecFile.mockImplementation((_cmd: any, args: any, cb: any) => {
        if (typeof cb === "function") {
          callCount++;
          if (callCount === 1) {
            expect(args).toContain("default/LEGACY_SECRET");
            const err = Object.assign(new Error("not found"), { code: 44 });
            cb(err, { stdout: "", stderr: "" });
          } else {
            expect(args).toContain("LEGACY_SECRET");
            cb(null, { stdout: "legacy-value\n", stderr: "" });
          }
        }
        return {} as any;
      });

      const value = await provider.get("LEGACY_SECRET");
      expect(value).toBe("legacy-value");
      expect(callCount).toBe(2);
    });

    it("does not fall back to legacy key for non-default project", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") {
          const err = Object.assign(new Error("not found"), { code: 44 });
          cb(err, { stdout: "", stderr: "" });
        }
        return {} as any;
      });

      const value = await provider.get("LEGACY_SECRET", "website");
      expect(value).toBeNull();
    });
  });

  describe("set", () => {
    it("calls security delete then add with project/name account", async () => {
      const calls: string[][] = [];
      mockExecFile.mockImplementation((_cmd: any, args: any, cb: any) => {
        calls.push(args as string[]);
        if (typeof cb === "function") cb(null, { stdout: "", stderr: "" });
        return {} as any;
      });

      await provider.set("TOKEN", "abc123", "myapp");
      expect(calls.length).toBe(2);
      expect(calls[0]).toContain("delete-generic-password");
      expect(calls[0]).toContain("myapp/TOKEN");
      expect(calls[1]).toContain("add-generic-password");
      expect(calls[1]).toContain("myapp/TOKEN");
    });
  });

  describe("delete", () => {
    it("returns true on success", async () => {
      mockExecFile.mockImplementation((_cmd: any, args: any, cb: any) => {
        if (typeof cb === "function") {
          expect(args).toContain("default/TOKEN");
          cb(null, { stdout: "", stderr: "" });
        }
        return {} as any;
      });

      expect(await provider.delete("TOKEN")).toBe(true);
    });

    it("returns false when not found", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") cb(new Error("not found"), { stdout: "", stderr: "" });
        return {} as any;
      });

      expect(await provider.delete("MISSING")).toBe(false);
    });
  });

  describe("list", () => {
    it("filters secrets by project prefix", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") {
          cb(null, {
            stdout: [
              dumpEntry("peekachu", "website/DB_PASSWORD"),
              dumpEntry("peekachu", "website/API_KEY"),
              dumpEntry("peekachu", "default/OTHER"),
            ].join("\n"),
            stderr: "",
          });
        }
        return {} as any;
      });

      const names = await provider.list("website");
      expect(names).toEqual(["DB_PASSWORD", "API_KEY"]);
    });

    it("lists default project secrets by default", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") {
          cb(null, {
            stdout: [
              dumpEntry("peekachu", "default/SECRET_A"),
              dumpEntry("peekachu", "website/SECRET_B"),
            ].join("\n"),
            stderr: "",
          });
        }
        return {} as any;
      });

      const names = await provider.list();
      expect(names).toEqual(["SECRET_A"]);
    });

    it("includes legacy unprefixed entries in default project", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") {
          cb(null, {
            stdout: [
              dumpEntry("peekachu", "default/NEW_SECRET"),
              dumpEntry("peekachu", "LEGACY_SECRET"),
              dumpEntry("peekachu", "website/OTHER"),
            ].join("\n"),
            stderr: "",
          });
        }
        return {} as any;
      });

      const names = await provider.list();
      expect(names).toEqual(["NEW_SECRET", "LEGACY_SECRET"]);
    });

    it("does not include legacy entries for non-default project", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") {
          cb(null, {
            stdout: [
              dumpEntry("peekachu", "LEGACY_SECRET"),
              dumpEntry("peekachu", "website/SCOPED"),
            ].join("\n"),
            stderr: "",
          });
        }
        return {} as any;
      });

      const names = await provider.list("website");
      expect(names).toEqual(["SCOPED"]);
    });

    it("ignores entries from other services", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") {
          cb(null, {
            stdout: [
              dumpEntry("peekachu", "default/MY_SECRET"),
              dumpEntry("other-app", "default/NOT_OURS"),
            ].join("\n"),
            stderr: "",
          });
        }
        return {} as any;
      });

      const names = await provider.list();
      expect(names).toEqual(["MY_SECRET"]);
    });
  });

  describe("listProjects", () => {
    it("returns unique project names sorted", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") {
          cb(null, {
            stdout: [
              dumpEntry("peekachu", "website/DB_PASSWORD"),
              dumpEntry("peekachu", "api/API_KEY"),
              dumpEntry("peekachu", "website/OTHER"),
              dumpEntry("peekachu", "default/GLOBAL"),
            ].join("\n"),
            stderr: "",
          });
        }
        return {} as any;
      });

      const projects = await provider.listProjects();
      expect(projects).toEqual(["api", "default", "website"]);
    });

    it("includes default when legacy unprefixed entries exist", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") {
          cb(null, {
            stdout: [
              dumpEntry("peekachu", "LEGACY_SECRET"),
              dumpEntry("peekachu", "website/SCOPED"),
            ].join("\n"),
            stderr: "",
          });
        }
        return {} as any;
      });

      const projects = await provider.listProjects();
      expect(projects).toEqual(["default", "website"]);
    });
  });
});
