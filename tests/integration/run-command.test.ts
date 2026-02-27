import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);
const cliPath = resolve(import.meta.dirname, "../../dist/cli.js");

function cli(args: string[], env?: Record<string, string>) {
  return execFileAsync("node", [cliPath, ...args], {
    env: { ...process.env, ...env },
    timeout: 10000,
  });
}

describe("run command (CI mode)", () => {
  it("scrubs secret from stdout", async () => {
    const { stdout } = await cli(
      ["run", "--ci", "--env", "TEST_SECRET", "--", "echo", "the password is s3cret!"],
      { TEST_SECRET: "s3cret!" },
    );
    expect(stdout).not.toContain("s3cret!");
    expect(stdout).toContain("[REDACTED:TEST_SECRET]");
  });

  it("scrubs multiple secrets from stdout", async () => {
    const { stdout } = await cli(
      [
        "run", "--ci",
        "--env", "SECRET_A",
        "--env", "SECRET_B",
        "--",
        "echo", "a=alpha b=beta",
      ],
      { SECRET_A: "alpha", SECRET_B: "beta" },
    );
    expect(stdout).not.toContain("alpha");
    expect(stdout).not.toContain("beta");
    expect(stdout).toContain("[REDACTED:SECRET_A]");
    expect(stdout).toContain("[REDACTED:SECRET_B]");
  });

  it("scrubs secret from stderr", async () => {
    const { stderr } = await cli(
      [
        "run", "--ci", "--env", "MY_TOKEN", "--",
        "node", "-e", "process.stderr.write('token=abc123xyz\\n')",
      ],
      { MY_TOKEN: "abc123xyz" },
    );
    expect(stderr).not.toContain("abc123xyz");
    expect(stderr).toContain("[REDACTED:MY_TOKEN]");
  });

  it("passes environment variable to child process", async () => {
    const { stdout } = await cli(
      [
        "run", "--ci", "--env", "INJECTED_VAR", "--",
        "node", "-e", "process.stdout.write(process.env.INJECTED_VAR)",
      ],
      { INJECTED_VAR: "secret-val" },
    );
    // The child process writes the secret, but it should be scrubbed
    expect(stdout).not.toContain("secret-val");
    expect(stdout).toContain("[REDACTED:INJECTED_VAR]");
  });

  it("preserves exit code from child process", async () => {
    try {
      await cli(
        ["run", "--ci", "--env", "X", "--", "node", "-e", "process.exit(42)"],
        { X: "dummy" },
      );
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.code).toBe(42);
    }
  });

  it("errors when secret not found in CI mode", async () => {
    try {
      await cli(
        ["run", "--ci", "--env", "NONEXISTENT_SECRET_XYZ", "--", "echo", "hi"],
      );
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.stderr).toContain("not found");
    }
  });
});
