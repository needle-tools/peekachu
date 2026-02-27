import { Transform, type TransformCallback } from "node:stream";
import { redactedPlaceholder } from "./constants.js";

export interface ScrubberSecret {
  name: string;
  value: string;
}

/**
 * A Transform stream that replaces secret values with redacted placeholders.
 *
 * Uses a sliding window buffer of (maxSecretLength - 1) bytes to handle
 * secrets that may be split across chunk boundaries.
 */
export class SecretScrubber extends Transform {
  private secrets: ScrubberSecret[];
  private buffer: string = "";
  private maxSecretLength: number;

  constructor(secrets: ScrubberSecret[]) {
    super({ decodeStrings: true, encoding: "utf-8" });
    // Filter out empty secrets to avoid infinite replacement loops
    this.secrets = secrets.filter((s) => s.value.length > 0);
    this.maxSecretLength = this.secrets.reduce(
      (max, s) => Math.max(max, s.value.length),
      0,
    );
  }

  _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.buffer += chunk.toString("utf-8");

    if (this.secrets.length === 0) {
      const out = this.buffer;
      this.buffer = "";
      callback(null, out);
      return;
    }

    // Scrub complete matches in the full buffer first, then keep a
    // sliding window tail of (maxSecretLength - 1) chars so that
    // partial matches spanning chunk boundaries are caught next time.
    const scrubbed = this.scrub(this.buffer);
    const keepLength = this.maxSecretLength - 1;

    if (scrubbed.length <= keepLength) {
      this.buffer = scrubbed;
      callback();
      return;
    }

    const output = scrubbed.slice(0, scrubbed.length - keepLength);
    this.buffer = scrubbed.slice(scrubbed.length - keepLength);

    callback(null, output);
  }

  _flush(callback: TransformCallback): void {
    if (this.buffer.length > 0) {
      callback(null, this.scrub(this.buffer));
    } else {
      callback();
    }
    this.buffer = "";
  }

  private scrub(text: string): string {
    let result = text;
    for (const secret of this.secrets) {
      result = result.replaceAll(secret.value, redactedPlaceholder(secret.name));
    }
    return result;
  }
}
