import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { detectPlatform } from "./platform.js";

const execFileAsync = promisify(execFile);

/**
 * Prompt the user for a secret value using a native OS dialog.
 * Falls back to reading from /dev/tty (not stdin, which the AI controls).
 */
export async function promptSecret(name: string): Promise<string> {
  const platform = detectPlatform();

  if (platform === "macos") {
    try {
      return await promptWithOsascript(name);
    } catch {
      // Fall back to TTY
    }
  }

  return await promptFromTTY(name);
}

async function promptWithOsascript(name: string): Promise<string> {
  const script = `
    set result to display dialog "Enter secret value for: ${name}" ¬
      default answer "" ¬
      with title "peekachu" ¬
      with hidden answer
    return text returned of result
  `;

  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  return stdout.replace(/\n$/, "");
}

async function promptFromTTY(name: string): Promise<string> {
  // Read from /dev/tty directly — this bypasses stdin,
  // which may be controlled by the AI agent
  const ttyStream = createReadStream("/dev/tty");
  const rl = createInterface({
    input: ttyStream,
    terminal: false,
  });

  process.stderr.write(`Enter secret value for ${name}: `);

  try {
    const line = await new Promise<string>((resolve, reject) => {
      rl.once("line", resolve);
      rl.once("error", reject);
      rl.once("close", () => reject(new Error("Input closed without a value")));
    });
    return line;
  } finally {
    rl.close();
    ttyStream.destroy();
  }
}
