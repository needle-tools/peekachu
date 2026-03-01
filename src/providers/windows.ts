import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SERVICE_NAME, DEFAULT_PROJECT } from "../constants.js";
import type { SecretProvider } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * Windows Credential Manager provider.
 * Uses PowerShell with Windows.Security.Credentials.PasswordVault (UWP API, Windows 10+).
 * Target name format: `peekachu:project/name`
 */
export class WindowsProvider implements SecretProvider {
  readonly name = "windows";

  private targetKey(name: string, project?: string): string {
    return `${SERVICE_NAME}:${project ?? DEFAULT_PROJECT}/${name}`;
  }

  private async runPowerShell(script: string): Promise<string> {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ]);
    return stdout.trim();
  }

  async get(name: string, project?: string): Promise<string | null> {
    const resolvedProject = project ?? DEFAULT_PROJECT;
    const target = this.targetKey(name, resolvedProject);
    try {
      const result = await this.runPowerShell(
        `$vault = New-Object Windows.Security.Credentials.PasswordVault; ` +
        `$cred = $vault.Retrieve('${SERVICE_NAME}', '${target}'); ` +
        `$cred.RetrievePassword(); ` +
        `Write-Output $cred.Password`,
      );
      return result || null;
    } catch {
      // Not found — fall back to legacy key for default project
      if (resolvedProject === DEFAULT_PROJECT) {
        const legacyTarget = `${SERVICE_NAME}:${name}`;
        try {
          const result = await this.runPowerShell(
            `$vault = New-Object Windows.Security.Credentials.PasswordVault; ` +
            `$cred = $vault.Retrieve('${SERVICE_NAME}', '${legacyTarget}'); ` +
            `$cred.RetrievePassword(); ` +
            `Write-Output $cred.Password`,
          );
          return result || null;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  async set(name: string, value: string, project?: string): Promise<void> {
    const target = this.targetKey(name, project);
    // Remove existing credential first, then add new one
    await this.runPowerShell(
      `$vault = New-Object Windows.Security.Credentials.PasswordVault; ` +
      `try { $old = $vault.Retrieve('${SERVICE_NAME}', '${target}'); $vault.Remove($old) } catch {}; ` +
      `$cred = New-Object Windows.Security.Credentials.PasswordCredential('${SERVICE_NAME}', '${target}', '${value.replace(/'/g, "''")}'); ` +
      `$vault.Add($cred)`,
    );
  }

  async delete(name: string, project?: string): Promise<boolean> {
    const resolvedProject = project ?? DEFAULT_PROJECT;
    const target = this.targetKey(name, resolvedProject);
    try {
      await this.runPowerShell(
        `$vault = New-Object Windows.Security.Credentials.PasswordVault; ` +
        `$cred = $vault.Retrieve('${SERVICE_NAME}', '${target}'); ` +
        `$vault.Remove($cred)`,
      );
      return true;
    } catch {
      // Fall back to legacy key for default project
      if (resolvedProject === DEFAULT_PROJECT) {
        const legacyTarget = `${SERVICE_NAME}:${name}`;
        try {
          await this.runPowerShell(
            `$vault = New-Object Windows.Security.Credentials.PasswordVault; ` +
            `$cred = $vault.Retrieve('${SERVICE_NAME}', '${legacyTarget}'); ` +
            `$vault.Remove($cred)`,
          );
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  async list(project?: string): Promise<string[]> {
    const resolvedProject = project ?? DEFAULT_PROJECT;
    const prefix = `${SERVICE_NAME}:${resolvedProject}/`;
    const isDefault = resolvedProject === DEFAULT_PROJECT;
    try {
      const output = await this.runPowerShell(
        `$vault = New-Object Windows.Security.Credentials.PasswordVault; ` +
        `$creds = $vault.FindAllByResource('${SERVICE_NAME}'); ` +
        `foreach ($c in $creds) { Write-Output $c.UserName }`,
      );
      if (!output) return [];
      const names: string[] = [];
      for (const line of output.split(/\r?\n/)) {
        const entry = line.trim();
        if (!entry) continue;
        if (entry.startsWith(prefix)) {
          names.push(entry.slice(prefix.length));
        } else if (isDefault && entry.startsWith(`${SERVICE_NAME}:`) && !entry.slice(SERVICE_NAME.length + 1).includes("/")) {
          names.push(entry.slice(SERVICE_NAME.length + 1));
        }
      }
      return names;
    } catch {
      return [];
    }
  }

  async listProjects(): Promise<string[]> {
    try {
      const output = await this.runPowerShell(
        `$vault = New-Object Windows.Security.Credentials.PasswordVault; ` +
        `$creds = $vault.FindAllByResource('${SERVICE_NAME}'); ` +
        `foreach ($c in $creds) { Write-Output $c.UserName }`,
      );
      if (!output) return [];
      const projects = new Set<string>();
      const servicePrefix = `${SERVICE_NAME}:`;
      for (const line of output.split(/\r?\n/)) {
        const entry = line.trim();
        if (!entry || !entry.startsWith(servicePrefix)) continue;
        const rest = entry.slice(servicePrefix.length);
        const slashIndex = rest.indexOf("/");
        if (slashIndex !== -1) {
          projects.add(rest.slice(0, slashIndex));
        } else {
          projects.add(DEFAULT_PROJECT);
        }
      }
      return [...projects].sort();
    } catch {
      return [];
    }
  }

  async has(name: string, project?: string): Promise<boolean> {
    const value = await this.get(name, project);
    return value !== null;
  }
}
