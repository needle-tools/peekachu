import { describe, it, expect } from "vitest";
import { run } from "../../src/runner.js";

describe("runner", () => {
  it("runs a simple command and returns exit code 0", async () => {
    const code = await run({
      command: "echo",
      args: ["hello"],
      secrets: [],
      env: {},
    });
    expect(code).toBe(0);
  });

  it("returns non-zero exit code from failed command", async () => {
    const code = await run({
      command: "node",
      args: ["-e", "process.exit(42)"],
      secrets: [],
      env: {},
    });
    expect(code).toBe(42);
  });

  it("injects env vars into child process", async () => {
    const code = await run({
      command: "node",
      args: ["-e", 'process.stdout.write(process.env.MY_VAR || "missing")'],
      secrets: [],
      env: { MY_VAR: "injected-value" },
    });
    expect(code).toBe(0);
  });

  it("returns 1 for non-existent command", async () => {
    const code = await run({
      command: "nonexistent-command-12345",
      args: [],
      secrets: [],
      env: {},
    });
    expect(code).toBe(1);
  });
});
