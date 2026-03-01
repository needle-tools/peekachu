import { BrowserWindow, BrowserView } from "electrobun/bun";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";
import type { PeekachuRPC } from "../shared/rpc-types.ts";

const execFileAsync = promisify(execFile);

const SERVICE_NAME = "peekachu";
const DEFAULT_PROJECT = "default";

type Platform = "macos" | "linux" | "unsupported";

function detectPlatform(): Platform {
  const p = platform();
  if (p === "darwin") return "macos";
  if (p === "linux") return "linux";
  return "unsupported";
}

const currentPlatform = detectPlatform();

// --- Keychain operations (direct, no CLI dependency) ---

function accountKey(name: string, project: string): string {
  return `${project}/${name}`;
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
  unsupported: "None",
};

const rpc = BrowserView.defineRPC<PeekachuRPC>({
  maxRequestTime: 10000,
  handlers: {
    requests: {
      listProjects: async () => {
        return await keychainListProjects();
      },
      listSecrets: async ({ project }) => {
        return await keychainList(project);
      },
      setSecret: async ({ project, name, value }) => {
        await keychainSet(name, value, project);
      },
      deleteSecret: async ({ project, name }) => {
        return await keychainDelete(name, project);
      },
      getStatus: () => {
        return {
          platform: currentPlatform,
          provider: providerInfo[currentPlatform] ?? "Unknown",
          node: process.version,
        };
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
    width: 720,
    height: 560,
    x: 200,
    y: 200,
  },
  rpc,
});
