import { DEFAULT_PROJECT } from "../../src/constants.js";
import type { SecretProvider } from "../../src/providers/types.js";

/**
 * In-memory secret provider for testing.
 * Keys are stored as `project/name` to mirror KeychainProvider.
 */
export class MockProvider implements SecretProvider {
  readonly name = "mock";
  private store = new Map<string, string>();

  private key(name: string, project?: string): string {
    return `${project ?? DEFAULT_PROJECT}/${name}`;
  }

  async get(name: string, project?: string): Promise<string | null> {
    return this.store.get(this.key(name, project)) ?? null;
  }

  async set(name: string, value: string, project?: string): Promise<void> {
    this.store.set(this.key(name, project), value);
  }

  async delete(name: string, project?: string): Promise<boolean> {
    return this.store.delete(this.key(name, project));
  }

  async list(project?: string): Promise<string[]> {
    const prefix = `${project ?? DEFAULT_PROJECT}/`;
    const names: string[] = [];
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        names.push(key.slice(prefix.length));
      }
    }
    return names;
  }

  async has(name: string, project?: string): Promise<boolean> {
    return this.store.has(this.key(name, project));
  }
}
