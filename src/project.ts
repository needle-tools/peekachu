import { readFileSync } from "node:fs";
import { resolve, dirname, parse } from "node:path";
import { DEFAULT_PROJECT, CONFIG_FILENAME } from "./constants.js";

interface PeekachuConfig {
  project: string;
}

/**
 * Walk up the directory tree from `cwd` looking for a `.peekachu` config file.
 * Returns the project name if found, or `"default"`.
 */
export function detectProject(cwd?: string): string {
  let dir = resolve(cwd ?? process.cwd());

  while (true) {
    try {
      const configPath = resolve(dir, CONFIG_FILENAME);
      const raw = readFileSync(configPath, "utf-8");
      const config: PeekachuConfig = JSON.parse(raw);
      if (config.project && typeof config.project === "string") {
        return config.project;
      }
    } catch {
      // File doesn't exist or isn't valid JSON — keep walking up
    }

    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return DEFAULT_PROJECT;
}
