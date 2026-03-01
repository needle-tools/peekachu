export const SERVICE_NAME = "peekachu";
export const DEFAULT_PROJECT = "default";
export const CONFIG_FILENAME = ".peekachu";

export function redactedPlaceholder(name: string): string {
  return `[REDACTED:${name}]`;
}
