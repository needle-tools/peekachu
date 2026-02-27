import type { SecretProvider } from "./types.js";

/**
 * CI provider — reads secrets from existing environment variables.
 * Useful in CI/CD pipelines where secrets are already injected by the runner.
 * Only supports get/has/list; set/delete are no-ops.
 */
export class CIProvider implements SecretProvider {
  readonly name = "ci";
  private trackedNames: Set<string> = new Set();

  get(name: string): Promise<string | null> {
    const value = process.env[name];
    if (value !== undefined) {
      this.trackedNames.add(name);
    }
    return Promise.resolve(value ?? null);
  }

  set(_name: string, _value: string): Promise<void> {
    return Promise.reject(
      new Error("CI provider does not support setting secrets. Set them in your CI runner configuration."),
    );
  }

  delete(_name: string): Promise<boolean> {
    return Promise.reject(
      new Error("CI provider does not support deleting secrets."),
    );
  }

  list(): Promise<string[]> {
    return Promise.resolve([...this.trackedNames]);
  }

  has(name: string): Promise<boolean> {
    return Promise.resolve(process.env[name] !== undefined);
  }
}
