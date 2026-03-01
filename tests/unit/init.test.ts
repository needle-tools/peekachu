import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("initCommand", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "peekachu-init-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it("creates .peekachu with given project name", async () => {
    const { initCommand } = await import("../../src/commands/init.js");
    initCommand("myproject");
    const content = readFileSync(join(tempDir, ".peekachu"), "utf-8");
    expect(JSON.parse(content)).toEqual({ project: "myproject" });
  });

  it("fails if .peekachu already exists", async () => {
    writeFileSync(join(tempDir, ".peekachu"), "{}");
    const { initCommand } = await import("../../src/commands/init.js");
    initCommand("myproject");
    expect(process.exitCode).toBe(1);
  });
});
