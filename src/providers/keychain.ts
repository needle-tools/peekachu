import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { detectPlatform } from "../platform.js";
import { SERVICE_NAME, DEFAULT_PROJECT } from "../constants.js";
import type { SecretProvider } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * OS keychain provider.
 * macOS: uses `security` CLI (Keychain Access)
 * Linux: uses `secret-tool` CLI (GNOME Keyring / libsecret)
 *
 * Account field uses `project/name` format for namespace scoping.
 * Security: secret values are passed via stdin to avoid exposure in `ps` output.
 */
export class KeychainProvider implements SecretProvider {
  readonly name = "keychain";
  private platform = detectPlatform();

  /** Build the keychain account key: `project/name` */
  private accountKey(name: string, project?: string): string {
    return `${project ?? DEFAULT_PROJECT}/${name}`;
  }

  private async rawGet(account: string): Promise<string | null> {
    try {
      if (this.platform === "macos") {
        const { stdout } = await execFileAsync("security", [
          "find-generic-password",
          "-s", SERVICE_NAME,
          "-a", account,
          "-w",
        ]);
        return stdout.replace(/\n$/, "");
      } else if (this.platform === "linux") {
        const { stdout } = await execFileAsync("secret-tool", [
          "lookup",
          "service", SERVICE_NAME,
          "name", account,
        ]);
        return stdout.replace(/\n$/, "");
      }
      throw new Error(`Unsupported platform: ${this.platform}`);
    } catch (err: unknown) {
      const error = err as { code?: number; status?: number; stderr?: string };
      if (error.code === 44 || error.status === 44) return null;
      if (error.stderr?.includes("not be found")) return null;
      if (error.code === 1 || error.status === 1) return null;
      throw err;
    }
  }

  async get(name: string, project?: string): Promise<string | null> {
    const resolvedProject = project ?? DEFAULT_PROJECT;
    // Try namespaced key first
    const value = await this.rawGet(this.accountKey(name, resolvedProject));
    if (value !== null) return value;
    // Fall back to legacy (unprefixed) key for the default project
    if (resolvedProject === DEFAULT_PROJECT) {
      return this.rawGet(name);
    }
    return null;
  }

  async set(name: string, value: string, project?: string): Promise<void> {
    const account = this.accountKey(name, project);
    if (this.platform === "macos") {
      // Delete existing entry first (ignore errors if it doesn't exist)
      try {
        await execFileAsync("security", [
          "delete-generic-password",
          "-s", SERVICE_NAME,
          "-a", account,
        ]);
      } catch {
        // Item didn't exist, that's fine
      }

      await execFileAsync("security", [
        "add-generic-password",
        "-s", SERVICE_NAME,
        "-a", account,
        "-w", value,
        "-U",
      ]);
    } else if (this.platform === "linux") {
      await new Promise<void>((resolve, reject) => {
        const child = execFile("secret-tool", [
          "store",
          "--label", `${SERVICE_NAME}:${account}`,
          "service", SERVICE_NAME,
          "name", account,
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

  private async rawDelete(account: string): Promise<boolean> {
    try {
      if (this.platform === "macos") {
        await execFileAsync("security", [
          "delete-generic-password",
          "-s", SERVICE_NAME,
          "-a", account,
        ]);
        return true;
      } else if (this.platform === "linux") {
        await execFileAsync("secret-tool", [
          "clear",
          "service", SERVICE_NAME,
          "name", account,
        ]);
        return true;
      }
      throw new Error(`Unsupported platform: ${this.platform}`);
    } catch {
      return false;
    }
  }

  async delete(name: string, project?: string): Promise<boolean> {
    const resolvedProject = project ?? DEFAULT_PROJECT;
    if (await this.rawDelete(this.accountKey(name, resolvedProject))) return true;
    // Fall back to legacy (unprefixed) key for the default project
    if (resolvedProject === DEFAULT_PROJECT) {
      return this.rawDelete(name);
    }
    return false;
  }

  async list(project?: string): Promise<string[]> {
    const resolvedProject = project ?? DEFAULT_PROJECT;
    const prefix = `${resolvedProject}/`;
    const isDefault = resolvedProject === DEFAULT_PROJECT;
    try {
      if (this.platform === "macos") {
        const { stdout } = await execFileAsync("security", [
          "dump-keychain",
        ]);
        const names: string[] = [];
        const lines = stdout.split("\n");
        // In dump-keychain output, "acct" appears before "svce" (alphabetical).
        // So we save the pending account and emit it when we confirm the service.
        let pendingAccount: string | null = null;
        for (const line of lines) {
          if (line.includes('"acct"<blob>=')) {
            const match = line.match(/"acct"<blob>="([^"]+)"/);
            pendingAccount = match ? match[1] : null;
          }
          if (line.includes(`"svce"<blob>="${SERVICE_NAME}"`) && pendingAccount !== null) {
            if (pendingAccount.startsWith(prefix)) {
              names.push(pendingAccount.slice(prefix.length));
            } else if (isDefault && !pendingAccount.includes("/")) {
              names.push(pendingAccount);
            }
            pendingAccount = null;
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
          const account = match[1];
          if (account.startsWith(prefix)) {
            names.push(account.slice(prefix.length));
          } else if (isDefault && !account.includes("/")) {
            names.push(account);
          }
        }
        return names;
      }
      throw new Error(`Unsupported platform: ${this.platform}`);
    } catch {
      return [];
    }
  }

  /**
   * List all distinct project names that have secrets stored.
   */
  async listProjects(): Promise<string[]> {
    try {
      if (this.platform === "macos") {
        const { stdout } = await execFileAsync("security", [
          "dump-keychain",
        ]);
        const projects = new Set<string>();
        const lines = stdout.split("\n");
        let pendingAccount: string | null = null;
        for (const line of lines) {
          if (line.includes('"acct"<blob>=')) {
            const match = line.match(/"acct"<blob>="([^"]+)"/);
            pendingAccount = match ? match[1] : null;
          }
          if (line.includes(`"svce"<blob>="${SERVICE_NAME}"`) && pendingAccount !== null) {
            const slashIndex = pendingAccount.indexOf("/");
            if (slashIndex !== -1) {
              projects.add(pendingAccount.slice(0, slashIndex));
            } else {
              projects.add(DEFAULT_PROJECT);
            }
            pendingAccount = null;
          }
        }
        return [...projects].sort();
      } else if (this.platform === "linux") {
        const { stdout } = await execFileAsync("secret-tool", [
          "search",
          "service", SERVICE_NAME,
        ]);
        const projects = new Set<string>();
        const regex = /attribute\.name = (.+)/g;
        let match;
        while ((match = regex.exec(stdout)) !== null) {
          const slashIndex = match[1].indexOf("/");
          if (slashIndex !== -1) {
            projects.add(match[1].slice(0, slashIndex));
          } else {
            projects.add(DEFAULT_PROJECT);
          }
        }
        return [...projects].sort();
      }
      throw new Error(`Unsupported platform: ${this.platform}`);
    } catch {
      return [];
    }
  }

  async has(name: string, project?: string): Promise<boolean> {
    const value = await this.get(name, project);
    return value !== null;
  }
}
