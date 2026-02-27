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

describe("KeychainProvider", () => {
  let provider: KeychainProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new KeychainProvider();
  });

  describe("get", () => {
    it("returns secret value on success", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") cb(null, { stdout: "my-secret\n", stderr: "" });
        return {} as any;
      });

      const value = await provider.get("DB_PASSWORD");
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
  });

  describe("set", () => {
    it("calls security delete then add", async () => {
      const calls: string[][] = [];
      mockExecFile.mockImplementation((_cmd: any, args: any, cb: any) => {
        calls.push(args as string[]);
        if (typeof cb === "function") cb(null, { stdout: "", stderr: "" });
        return {} as any;
      });

      await provider.set("TOKEN", "abc123");
      expect(calls.length).toBe(2);
      expect(calls[0]).toContain("delete-generic-password");
      expect(calls[1]).toContain("add-generic-password");
    });
  });

  describe("delete", () => {
    it("returns true on success", async () => {
      mockExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
        if (typeof cb === "function") cb(null, { stdout: "", stderr: "" });
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
});
