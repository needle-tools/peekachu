import { createProvider, type ProviderType } from "../providers/index.js";
import { detectProject } from "../project.js";
import { run } from "../runner.js";
import type { ScrubberSecret } from "../scrubber.js";

export interface RunCommandOptions {
  env: string[];
  ci?: boolean;
  project?: string;
}

export async function runCommand(
  commandArgs: string[],
  options: RunCommandOptions,
): Promise<void> {
  if (commandArgs.length === 0) {
    process.stderr.write("Error: no command specified after --\n");
    process.exitCode = 1;
    return;
  }

  const envNames = options.env;
  if (!envNames || envNames.length === 0) {
    process.stderr.write("Error: at least one --env <name> is required\n");
    process.exitCode = 1;
    return;
  }

  const providerType: ProviderType = options.ci ? "ci" : "keychain";
  const provider = createProvider(providerType);
  const resolvedProject = options.project ?? detectProject();

  const secrets: ScrubberSecret[] = [];
  const envVars: Record<string, string> = {};

  for (const name of envNames) {
    const value = await provider.get(name, resolvedProject);
    if (value === null) {
      process.stderr.write(
        `Error: secret "${name}" not found in ${providerType} provider.\n`,
      );
      process.exitCode = 1;
      return;
    }
    secrets.push({ name, value });
    envVars[name] = value;
  }

  const [command, ...args] = commandArgs;
  const exitCode = await run({ command, args, secrets, env: envVars });
  process.exitCode = exitCode;
}
