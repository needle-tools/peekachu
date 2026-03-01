import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { CONFIG_FILENAME } from "../constants.js";

export function initCommand(project?: string): void {
  const configPath = resolve(process.cwd(), CONFIG_FILENAME);

  if (existsSync(configPath)) {
    process.stderr.write(`${CONFIG_FILENAME} already exists in this directory.\n`);
    process.exitCode = 1;
    return;
  }

  const projectName = project ?? resolve(process.cwd()).split("/").pop() ?? "default";
  const config = { project: projectName };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  process.stderr.write(`Created ${CONFIG_FILENAME} with project "${projectName}".\n`);
}
