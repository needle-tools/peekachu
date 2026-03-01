import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir, platform } from "node:os";

interface SecretMetadata {
  comment?: string;
  createdAt?: string;
}

interface MetadataStore {
  projects?: string[];
  [key: string]: SecretMetadata | string[] | undefined;
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

export async function loadMetadata(): Promise<MetadataStore> {
  try {
    const raw = await readFile(metadataPath(), "utf-8");
    return JSON.parse(raw) as MetadataStore;
  } catch {
    return {};
  }
}

export async function saveMetadata(data: MetadataStore): Promise<void> {
  const dir = getConfigDir();
  await mkdir(dir, { recursive: true });
  await writeFile(metadataPath(), JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function secretKey(name: string, project?: string): string {
  return `${project ?? "default"}/${name}`;
}

export async function getComment(name: string, project?: string): Promise<string | undefined> {
  const data = await loadMetadata();
  const entry = data[secretKey(name, project)] as SecretMetadata | undefined;
  return entry?.comment;
}

export async function setComment(name: string, comment: string, project?: string): Promise<void> {
  const data = await loadMetadata();
  const key = secretKey(name, project);
  data[key] = { ...(data[key] as SecretMetadata | undefined), comment };
  await saveMetadata(data);
}

export async function setCreatedAt(name: string, project?: string): Promise<void> {
  const data = await loadMetadata();
  const key = secretKey(name, project);
  const existing = data[key] as SecretMetadata | undefined;
  if (!existing?.createdAt) {
    data[key] = { ...existing, createdAt: new Date().toISOString() };
    await saveMetadata(data);
  }
}

export async function deleteComment(name: string, project?: string): Promise<void> {
  const data = await loadMetadata();
  const key = secretKey(name, project);
  if (key in data) {
    delete data[key];
    await saveMetadata(data);
  }
}

export async function listComments(project?: string): Promise<Record<string, string>> {
  const data = await loadMetadata();
  const prefix = `${project ?? "default"}/`;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "projects") continue;
    if (key.startsWith(prefix) && value && typeof value === "object" && "comment" in value && value.comment) {
      result[key.slice(prefix.length)] = value.comment;
    }
  }
  return result;
}

export async function listSecretMeta(project?: string): Promise<Record<string, { comment?: string; createdAt?: string }>> {
  const data = await loadMetadata();
  const prefix = `${project ?? "default"}/`;
  const result: Record<string, { comment?: string; createdAt?: string }> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "projects") continue;
    if (key.startsWith(prefix) && value && typeof value === "object") {
      const meta = value as SecretMetadata;
      if (meta.comment || meta.createdAt) {
        result[key.slice(prefix.length)] = { comment: meta.comment, createdAt: meta.createdAt };
      }
    }
  }
  return result;
}

export async function addProject(name: string): Promise<void> {
  const data = await loadMetadata();
  const projects = data.projects ?? [];
  if (!projects.includes(name)) {
    data.projects = [...projects, name];
    await saveMetadata(data);
  }
}

export async function listKnownProjects(): Promise<string[]> {
  const data = await loadMetadata();
  return data.projects ?? [];
}
