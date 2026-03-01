import { BrowserWindow, BrowserView } from "electrobun/bun";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { platform, homedir } from "node:os";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { PeekachuRPC } from "../shared/rpc-types.ts";

const execFileAsync = promisify(execFile);

const SERVICE_NAME = "peekachu";
const DEFAULT_PROJECT = "default";

type Platform = "macos" | "linux" | "windows" | "unsupported";

function detectPlatform(): Platform {
  const p = platform();
  if (p === "darwin") return "macos";
  if (p === "linux") return "linux";
  if (p === "win32") return "windows";
  return "unsupported";
}

const currentPlatform = detectPlatform();

// --- Metadata (comments + project tracking) ---

interface MetadataStore {
  projects?: string[];
  [key: string]: { comment?: string } | string[] | undefined;
}

function getConfigDir(): string {
  if (platform() === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "peekachu");
  }
  return join(homedir(), ".config", "peekachu");
}

function metadataPath(): string {
  return join(getConfigDir(), "metadata.json");
}

async function loadMetadata(): Promise<MetadataStore> {
  try {
    const raw = await readFile(metadataPath(), "utf-8");
    return JSON.parse(raw) as MetadataStore;
  } catch {
    return {};
  }
}

async function saveMetadata(data: MetadataStore): Promise<void> {
  const dir = getConfigDir();
  await mkdir(dir, { recursive: true });
  await writeFile(metadataPath(), JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// --- Keychain operations (direct, no CLI dependency) ---

function accountKey(name: string, project: string): string {
  return `${project}/${name}`;
}

function windowsTargetKey(name: string, project: string): string {
  return `${SERVICE_NAME}:${project}/${name}`;
}

async function runPowerShell(script: string): Promise<string> {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command", script,
  ]);
  return stdout.trim();
}

async function rawGet(account: string): Promise<string | null> {
  try {
    if (currentPlatform === "macos") {
      const { stdout } = await execFileAsync("security", [
        "find-generic-password", "-s", SERVICE_NAME, "-a", account, "-w",
      ]);
      return stdout.replace(/\n$/, "");
    } else if (currentPlatform === "linux") {
      const { stdout } = await execFileAsync("secret-tool", [
        "lookup", "service", SERVICE_NAME, "name", account,
      ]);
      return stdout.replace(/\n$/, "");
    }
    return null;
  } catch {
    return null;
  }
}

async function keychainGet(name: string, project: string): Promise<string | null> {
  const value = await rawGet(accountKey(name, project));
  if (value !== null) return value;
  // Fall back to legacy (unprefixed) key for the default project
  if (project === DEFAULT_PROJECT) {
    return rawGet(name);
  }
  return null;
}

async function keychainSet(name: string, value: string, project: string): Promise<void> {
  const account = accountKey(name, project);
  if (currentPlatform === "macos") {
    try {
      await execFileAsync("security", [
        "delete-generic-password", "-s", SERVICE_NAME, "-a", account,
      ]);
    } catch { /* didn't exist */ }
    await execFileAsync("security", [
      "add-generic-password", "-s", SERVICE_NAME, "-a", account, "-w", value, "-U",
    ]);
  } else if (currentPlatform === "linux") {
    await new Promise<void>((resolve, reject) => {
      const child = execFile("secret-tool", [
        "store", "--label", `${SERVICE_NAME}:${account}`,
        "service", SERVICE_NAME, "name", account,
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
      child.stdin!.write(value);
      child.stdin!.end();
    });
  } else if (currentPlatform === "windows") {
    const target = windowsTargetKey(name, project);
    await runPowerShell(
      `$vault = New-Object Windows.Security.Credentials.PasswordVault; ` +
      `try { $old = $vault.Retrieve('${SERVICE_NAME}', '${target}'); $vault.Remove($old) } catch {}; ` +
      `$cred = New-Object Windows.Security.Credentials.PasswordCredential('${SERVICE_NAME}', '${target}', '${value.replace(/'/g, "''")}'); ` +
      `$vault.Add($cred)`,
    );
  }
}

async function rawDelete(account: string): Promise<boolean> {
  try {
    if (currentPlatform === "macos") {
      await execFileAsync("security", [
        "delete-generic-password", "-s", SERVICE_NAME, "-a", account,
      ]);
      return true;
    } else if (currentPlatform === "linux") {
      await execFileAsync("secret-tool", [
        "clear", "service", SERVICE_NAME, "name", account,
      ]);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function keychainDelete(name: string, project: string): Promise<boolean> {
  if (currentPlatform === "windows") {
    const target = windowsTargetKey(name, project);
    try {
      await runPowerShell(
        `$vault = New-Object Windows.Security.Credentials.PasswordVault; ` +
        `$cred = $vault.Retrieve('${SERVICE_NAME}', '${target}'); ` +
        `$vault.Remove($cred)`,
      );
      return true;
    } catch {
      return false;
    }
  }
  if (await rawDelete(accountKey(name, project))) return true;
  if (project === DEFAULT_PROJECT) {
    return rawDelete(name);
  }
  return false;
}

async function keychainList(project: string): Promise<string[]> {
  const prefix = `${project}/`;
  const isDefault = project === DEFAULT_PROJECT;
  try {
    if (currentPlatform === "macos") {
      const { stdout } = await execFileAsync("security", ["dump-keychain"]);
      const names: string[] = [];
      const lines = stdout.split("\n");
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
    } else if (currentPlatform === "linux") {
      const { stdout } = await execFileAsync("secret-tool", [
        "search", "service", SERVICE_NAME,
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
    } else if (currentPlatform === "windows") {
      const winPrefix = `${SERVICE_NAME}:${prefix}`;
      const output = await runPowerShell(
        `$vault = New-Object Windows.Security.Credentials.PasswordVault; ` +
        `$creds = $vault.FindAllByResource('${SERVICE_NAME}'); ` +
        `foreach ($c in $creds) { Write-Output $c.UserName }`,
      );
      if (!output) return [];
      const names: string[] = [];
      for (const line of output.split(/\r?\n/)) {
        const entry = line.trim();
        if (!entry) continue;
        if (entry.startsWith(winPrefix)) {
          names.push(entry.slice(winPrefix.length));
        } else if (isDefault && entry.startsWith(`${SERVICE_NAME}:`) && !entry.slice(SERVICE_NAME.length + 1).includes("/")) {
          names.push(entry.slice(SERVICE_NAME.length + 1));
        }
      }
      return names;
    }
    return [];
  } catch {
    return [];
  }
}

async function keychainListProjects(): Promise<string[]> {
  try {
    if (currentPlatform === "macos") {
      const { stdout } = await execFileAsync("security", ["dump-keychain"]);
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
    } else if (currentPlatform === "linux") {
      const { stdout } = await execFileAsync("secret-tool", [
        "search", "service", SERVICE_NAME,
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
    } else if (currentPlatform === "windows") {
      const output = await runPowerShell(
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
    }
    return [];
  } catch {
    return [];
  }
}

// --- RPC setup ---

const providerInfo: Record<string, string> = {
  macos: "macOS Keychain",
  linux: "Linux Secret Service",
  windows: "Windows Credential Manager",
  unsupported: "None",
};

const rpc = BrowserView.defineRPC<PeekachuRPC>({
  maxRequestTime: 10000,
  handlers: {
    requests: {
      listProjects: async () => {
        const keychainProjects = await keychainListProjects();
        const data = await loadMetadata();
        const metadataProjects = data.projects ?? [];
        const merged = new Set([...keychainProjects, ...metadataProjects]);
        return [...merged].sort();
      },
      listSecrets: async ({ project }) => {
        return await keychainList(project);
      },
      setSecret: async ({ project, name, value }) => {
        await keychainSet(name, value, project);
      },
      deleteSecret: async ({ project, name }) => {
        const deleted = await keychainDelete(name, project);
        if (deleted) {
          const data = await loadMetadata();
          const key = `${project}/${name}`;
          if (key in data) {
            delete data[key];
            await saveMetadata(data);
          }
        }
        return deleted;
      },
      getStatus: () => {
        return {
          platform: currentPlatform,
          provider: providerInfo[currentPlatform] ?? "Unknown",
          node: process.version,
        };
      },
      getComments: async ({ project }) => {
        const data = await loadMetadata();
        const prefix = `${project}/`;
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(data)) {
          if (key === "projects") continue;
          if (key.startsWith(prefix) && value && typeof value === "object" && "comment" in value && value.comment) {
            result[key.slice(prefix.length)] = value.comment;
          }
        }
        return result;
      },
      setComment: async ({ project, name, comment }) => {
        const data = await loadMetadata();
        const key = `${project}/${name}`;
        if (comment) {
          data[key] = { ...(data[key] as { comment?: string } | undefined), comment };
        } else {
          delete data[key];
        }
        await saveMetadata(data);
      },
      createProject: async ({ project }) => {
        const data = await loadMetadata();
        const projects = data.projects ?? [];
        if (!projects.includes(project)) {
          data.projects = [...projects, project];
          await saveMetadata(data);
        }
      },
    },
    messages: {},
  },
});

// --- Create window ---

const win = new BrowserWindow({
  title: "Peekachu",
  url: "views://mainview/index.html",
  frame: {
    width: 880,
    height: 560,
    x: 200,
    y: 200,
  },
  rpc,
});
