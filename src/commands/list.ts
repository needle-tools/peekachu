import { createProvider } from "../providers/index.js";
import { detectProject } from "../project.js";

export async function listCommand(project?: string): Promise<void> {
  const resolvedProject = project ?? detectProject();
  const provider = createProvider();
  const names = await provider.list(resolvedProject);

  if (names.length === 0) {
    process.stderr.write(`No secrets stored (project: ${resolvedProject}).\n`);
    return;
  }

  for (const name of names) {
    process.stdout.write(`${name}\n`);
  }
}
