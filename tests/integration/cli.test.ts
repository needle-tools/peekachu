import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);
const cliPath = resolve(import.meta.dirname, "../../dist/cli.mjs");

function cli(args: string[], env?: Record<string, string>) {
  return execFileAsync("node", [cliPath, ...args], {
    env: { ...process.env, ...env },
    timeout: 10000,
  });
}

describe("CLI integration", () => {
  it("shows help text", async () => {
    const { stdout } = await cli(["--help"]);
    expect(stdout).toContain("peekachu");
    expect(stdout).toContain("set");
    expect(stdout).toContain("run");
    expect(stdout).toContain("list");
    expect(stdout).toContain("delete");
    expect(stdout).toContain("status");
  });

  it("shows version", async () => {
    const { stdout } = await cli(["--version"]);
    expect(stdout.trim()).toBe("0.1.0");
  });

  it("status command shows platform info", async () => {
    const { stdout } = await cli(["status"]);
    expect(stdout).toContain("Platform:");
    expect(stdout).toContain("Provider:");
    expect(stdout).toContain("Node:");
  });
});
