import { createProvider } from "../providers/index.js";
import { promptSecret } from "../input.js";
import { detectProject } from "../project.js";

export async function setCommand(name: string, project?: string): Promise<void> {
  const resolvedProject = project ?? detectProject();
  const value = await promptSecret(name);

  if (!value) {
    process.stderr.write("Error: empty secret value.\n");
    process.exitCode = 1;
    return;
  }

  const provider = createProvider();
  await provider.set(name, value, resolvedProject);
  process.stderr.write(`Secret "${name}" stored successfully (project: ${resolvedProject}).\n`);
}
