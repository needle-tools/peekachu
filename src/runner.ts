import { spawn } from "node:child_process";
import { SecretScrubber, type ScrubberSecret } from "./scrubber.js";

export interface RunOptions {
  command: string;
  args: string[];
  secrets: ScrubberSecret[];
  /** Extra env vars to inject (name → value) */
  env: Record<string, string>;
}

/**
 * Spawn a child process with secrets injected as env vars and
 * stdout/stderr scrubbed of secret values.
 *
 * Returns the child's exit code (or 1 on error).
 */
export function run(options: RunOptions): Promise<number> {
  const { command, args, secrets, env } = options;

  const stdoutScrubber = new SecretScrubber(secrets);
  const stderrScrubber = new SecretScrubber(secrets);

  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout!.pipe(stdoutScrubber).pipe(process.stdout);
  child.stderr!.pipe(stderrScrubber).pipe(process.stderr);

  // Forward signals to child
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
  const handlers = signals.map((sig) => {
    const handler = () => child.kill(sig);
    process.on(sig, handler);
    return { sig, handler };
  });

  return new Promise<number>((resolve) => {
    child.on("close", (code, signal) => {
      // Clean up signal handlers
      for (const { sig, handler } of handlers) {
        process.removeListener(sig, handler);
      }

      if (code !== null) {
        resolve(code);
      } else if (signal) {
        // Convert signal to exit code (128 + signal number)
        const signalCodes: Record<string, number> = {
          SIGHUP: 1,
          SIGINT: 2,
          SIGTERM: 15,
        };
        resolve(128 + (signalCodes[signal] ?? 15));
      } else {
        resolve(1);
      }
    });

    child.on("error", (err) => {
      process.stderr.write(`peekachu: failed to start command: ${err.message}\n`);
      resolve(1);
    });
  });
}
