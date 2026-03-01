import { createProvider } from "../providers/index.js";
import { detectProject } from "../project.js";
import { deleteComment } from "../metadata.js";

export async function deleteCommand(name: string, project?: string): Promise<void> {
  const resolvedProject = project ?? detectProject();
  const provider = createProvider();
  const deleted = await provider.delete(name, resolvedProject);

  if (deleted) {
    await deleteComment(name, resolvedProject);
    process.stderr.write(`Secret "${name}" deleted (project: ${resolvedProject}).\n`);
  } else {
    process.stderr.write(`Secret "${name}" not found (project: ${resolvedProject}).\n`);
    process.exitCode = 1;
  }
}
