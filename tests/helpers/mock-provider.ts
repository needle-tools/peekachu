import type { SecretProvider } from "../../src/providers/types.js";

/**
 * In-memory secret provider for testing.
 */
export class MockProvider implements SecretProvider {
  readonly name = "mock";
  private store = new Map<string, string>();

  async get(name: string): Promise<string | null> {
    return this.store.get(name) ?? null;
  }

  async set(name: string, value: string): Promise<void> {
    this.store.set(name, value);
  }

  async delete(name: string): Promise<boolean> {
    return this.store.delete(name);
  }

  async list(): Promise<string[]> {
    return [...this.store.keys()];
  }

  async has(name: string): Promise<boolean> {
    return this.store.has(name);
  }
}
