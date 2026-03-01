import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectProject } from "../../src/project.js";

describe("detectProject", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "peekachu-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns 'default' when no .peekachu file exists", () => {
    expect(detectProject(tempDir)).toBe("default");
  });

  it("reads project name from .peekachu in cwd", () => {
    writeFileSync(join(tempDir, ".peekachu"), JSON.stringify({ project: "website" }));
    expect(detectProject(tempDir)).toBe("website");
  });

  it("walks up directory tree to find .peekachu", () => {
    writeFileSync(join(tempDir, ".peekachu"), JSON.stringify({ project: "myapp" }));
    const subDir = join(tempDir, "src", "commands");
    mkdirSync(subDir, { recursive: true });
    expect(detectProject(subDir)).toBe("myapp");
  });

  it("uses closest .peekachu when multiple exist", () => {
    writeFileSync(join(tempDir, ".peekachu"), JSON.stringify({ project: "root" }));
    const subDir = join(tempDir, "packages", "api");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, ".peekachu"), JSON.stringify({ project: "api" }));
    expect(detectProject(subDir)).toBe("api");
  });

  it("ignores invalid JSON in .peekachu", () => {
    writeFileSync(join(tempDir, ".peekachu"), "not json");
    expect(detectProject(tempDir)).toBe("default");
  });

  it("ignores .peekachu without project field", () => {
    writeFileSync(join(tempDir, ".peekachu"), JSON.stringify({ other: "field" }));
    expect(detectProject(tempDir)).toBe("default");
  });

  it("uses process.cwd() when no cwd argument given", () => {
    // Just verify it doesn't throw
    const result = detectProject();
    expect(typeof result).toBe("string");
  });
});
