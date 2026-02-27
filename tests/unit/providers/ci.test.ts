import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CIProvider } from "../../../src/providers/ci.js";

describe("CIProvider", () => {
  let provider: CIProvider;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    provider = new CIProvider();
    // Save and set test env vars
    savedEnv.TEST_SECRET = process.env.TEST_SECRET;
    process.env.TEST_SECRET = "my-secret-value";
  });

  afterEach(() => {
    // Restore env
    if (savedEnv.TEST_SECRET === undefined) {
      delete process.env.TEST_SECRET;
    } else {
      process.env.TEST_SECRET = savedEnv.TEST_SECRET;
    }
  });

  it("reads from process.env", async () => {
    const value = await provider.get("TEST_SECRET");
    expect(value).toBe("my-secret-value");
  });

  it("returns null for missing env var", async () => {
    const value = await provider.get("NONEXISTENT_VAR_12345");
    expect(value).toBeNull();
  });

  it("has returns true for existing env var", async () => {
    expect(await provider.has("TEST_SECRET")).toBe(true);
  });

  it("has returns false for missing env var", async () => {
    expect(await provider.has("NONEXISTENT_VAR_12345")).toBe(false);
  });

  it("tracks accessed names in list", async () => {
    await provider.get("TEST_SECRET");
    const names = await provider.list();
    expect(names).toContain("TEST_SECRET");
  });

  it("rejects set with helpful error", async () => {
    await expect(provider.set("X", "Y")).rejects.toThrow("CI provider");
  });

  it("rejects delete with helpful error", async () => {
    await expect(provider.delete("X")).rejects.toThrow("CI provider");
  });
});
