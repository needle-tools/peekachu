import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { detectPlatform } from "../platform.js";
import { SERVICE_NAME } from "../constants.js";
import type { SecretProvider } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * OS keychain provider.
 * macOS: uses `security` CLI (Keychain Access)
 * Linux: uses `secret-tool` CLI (GNOME Keyring / libsecret)
 *
 * Security: secret values are passed via stdin to avoid exposure in `ps` output.
 */
export class KeychainProvider implements SecretProvider {
  readonly name = "keychain";
  private platform = detectPlatform();

  async get(name: string): Promise<string | null> {
    try {
      if (this.platform === "macos") {
        const { stdout } = await execFileAsync("security", [
          "find-generic-password",
          "-s", SERVICE_NAME,
          "-a", name,
          "-w",
        ]);
        return stdout.replace(/\n$/, "");
      } else if (this.platform === "linux") {
        const { stdout } = await execFileAsync("secret-tool", [
          "lookup",
          "service", SERVICE_NAME,
          "name", name,
        ]);
        return stdout.replace(/\n$/, "");
      }
      throw new Error(`Unsupported platform: ${this.platform}`);
    } catch (err: unknown) {
      const error = err as { code?: number; status?: number; stderr?: string };
      // macOS security returns exit code 44 when item not found
      // secret-tool returns exit code 1 when item not found
      if (error.code === 44 || error.status === 44) return null;
      if (error.stderr?.includes("not be found")) return null;
      if (error.code === 1 || error.status === 1) return null;
      throw err;
    }
  }

  async set(name: string, value: string): Promise<void> {
    if (this.platform === "macos") {
      // Delete existing entry first (ignore errors if it doesn't exist)
      try {
        await execFileAsync("security", [
          "delete-generic-password",
          "-s", SERVICE_NAME,
          "-a", name,
        ]);
      } catch {
        // Item didn't exist, that's fine
      }

      // Pass the password via stdin using -T "" for no ACL and reading from pipe
      await execFileAsync("security", [
        "add-generic-password",
        "-s", SERVICE_NAME,
        "-a", name,
        "-w", value,
        "-U",
      ]);
    } else if (this.platform === "linux") {
      // secret-tool store reads the secret from stdin
      await new Promise<void>((resolve, reject) => {
        const child = execFile("secret-tool", [
          "store",
          "--label", `${SERVICE_NAME}:${name}`,
          "service", SERVICE_NAME,
          "name", name,
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
        child.stdin!.write(value);
        child.stdin!.end();
      });
    } else {
      throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  async delete(name: string): Promise<boolean> {
    try {
      if (this.platform === "macos") {
        await execFileAsync("security", [
          "delete-generic-password",
          "-s", SERVICE_NAME,
          "-a", name,
        ]);
        return true;
      } else if (this.platform === "linux") {
        await execFileAsync("secret-tool", [
          "clear",
          "service", SERVICE_NAME,
          "name", name,
        ]);
        return true;
      }
      throw new Error(`Unsupported platform: ${this.platform}`);
    } catch {
      return false;
    }
  }

  async list(): Promise<string[]> {
    try {
      if (this.platform === "macos") {
        const { stdout } = await execFileAsync("security", [
          "dump-keychain",
        ]);
        const names: string[] = [];
        // Parse the dump output looking for our service entries
        const lines = stdout.split("\n");
        let inOurService = false;
        for (const line of lines) {
          if (line.includes(`"svce"<blob>="${SERVICE_NAME}"`)) {
            inOurService = true;
          }
          if (inOurService && line.includes('"acct"<blob>=')) {
            const match = line.match(/"acct"<blob>="([^"]+)"/);
            if (match) {
              names.push(match[1]);
            }
            inOurService = false;
          }
        }
        return names;
      } else if (this.platform === "linux") {
        const { stdout } = await execFileAsync("secret-tool", [
          "search",
          "service", SERVICE_NAME,
        ]);
        const names: string[] = [];
        const regex = /attribute\.name = (.+)/g;
        let match;
        while ((match = regex.exec(stdout)) !== null) {
          names.push(match[1]);
        }
        return names;
      }
      throw new Error(`Unsupported platform: ${this.platform}`);
    } catch {
      return [];
    }
  }

  async has(name: string): Promise<boolean> {
    const value = await this.get(name);
    return value !== null;
  }
}
