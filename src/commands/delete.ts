import { createProvider } from "../providers/index.js";
import { detectProject } from "../project.js";

export async function deleteCommand(name: string, project?: string): Promise<void> {
  const resolvedProject = project ?? detectProject();
  const provider = createProvider();
  const deleted = await provider.delete(name, resolvedProject);

  if (deleted) {
    process.stderr.write(`Secret "${name}" deleted (project: ${resolvedProject}).\n`);
  } else {
    process.stderr.write(`Secret "${name}" not found (project: ${resolvedProject}).\n`);
    process.exitCode = 1;
  }
}
