import { describe, it, expect } from "vitest";
import { SecretScrubber } from "../../src/scrubber.js";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

function collect(scrubber: SecretScrubber, input: string | string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let result = "";
    const writable = new Writable({
      write(chunk, _enc, cb) {
        result += chunk.toString();
        cb();
      },
    });

    const chunks = Array.isArray(input) ? input : [input];
    const readable = new Readable({
      read() {
        for (const c of chunks) {
          this.push(Buffer.from(c));
        }
        this.push(null);
      },
    });

    pipeline(readable, scrubber, writable).then(() => resolve(result)).catch(reject);
  });
}

describe("SecretScrubber", () => {
  it("replaces a secret in a single chunk", async () => {
    const scrubber = new SecretScrubber([
      { name: "DB_PASSWORD", value: "hunter2" },
    ]);
    const result = await collect(scrubber, "password is hunter2 ok");
    expect(result).toBe("password is [REDACTED:DB_PASSWORD] ok");
  });

  it("replaces multiple occurrences", async () => {
    const scrubber = new SecretScrubber([
      { name: "TOKEN", value: "abc123" },
    ]);
    const result = await collect(scrubber, "abc123 and abc123 again");
    expect(result).toBe("[REDACTED:TOKEN] and [REDACTED:TOKEN] again");
  });

  it("replaces multiple different secrets", async () => {
    const scrubber = new SecretScrubber([
      { name: "DB_PASS", value: "secret1" },
      { name: "API_KEY", value: "secret2" },
    ]);
    const result = await collect(scrubber, "db=secret1 api=secret2");
    expect(result).toBe("db=[REDACTED:DB_PASS] api=[REDACTED:API_KEY]");
  });

  it("handles secret split across two chunks", async () => {
    const scrubber = new SecretScrubber([
      { name: "SECRET", value: "hunter2" },
    ]);
    // Split "hunter2" across chunks: "hun" + "ter2"
    const result = await collect(scrubber, ["before hun", "ter2 after"]);
    expect(result).toBe("before [REDACTED:SECRET] after");
  });

  it("handles secret split across multiple chunks", async () => {
    const scrubber = new SecretScrubber([
      { name: "SECRET", value: "abcdef" },
    ]);
    const result = await collect(scrubber, ["ab", "cd", "ef rest"]);
    expect(result).toBe("[REDACTED:SECRET] rest");
  });

  it("passes through text without secrets unchanged", async () => {
    const scrubber = new SecretScrubber([
      { name: "SECRET", value: "nothere" },
    ]);
    const result = await collect(scrubber, "hello world");
    expect(result).toBe("hello world");
  });

  it("handles empty input", async () => {
    const scrubber = new SecretScrubber([
      { name: "SECRET", value: "abc" },
    ]);
    const result = await collect(scrubber, "");
    expect(result).toBe("");
  });

  it("handles empty secrets list", async () => {
    const scrubber = new SecretScrubber([]);
    const result = await collect(scrubber, "hello world");
    expect(result).toBe("hello world");
  });

  it("handles secrets with special regex characters", async () => {
    const scrubber = new SecretScrubber([
      { name: "REGEX_SECRET", value: "pa$$w0rd.123" },
    ]);
    const result = await collect(scrubber, "value=pa$$w0rd.123!");
    expect(result).toBe("value=[REDACTED:REGEX_SECRET]!");
  });

  it("filters out empty secret values", async () => {
    const scrubber = new SecretScrubber([
      { name: "EMPTY", value: "" },
      { name: "REAL", value: "secret" },
    ]);
    const result = await collect(scrubber, "my secret here");
    expect(result).toBe("my [REDACTED:REAL] here");
  });
});
