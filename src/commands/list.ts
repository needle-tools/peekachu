import { createProvider } from "../providers/index.js";
import { detectProject } from "../project.js";
import { listComments } from "../metadata.js";

export async function listCommand(project?: string, showComments?: boolean): Promise<void> {
  const resolvedProject = project ?? detectProject();
  const provider = createProvider();
  const names = await provider.list(resolvedProject);

  if (names.length === 0) {
    process.stderr.write(`No secrets stored (project: ${resolvedProject}).\n`);
    return;
  }

  const comments = showComments ? await listComments(resolvedProject) : {};

  for (const name of names) {
    const comment = comments[name];
    if (comment) {
      process.stdout.write(`${name}  # ${comment}\n`);
    } else {
      process.stdout.write(`${name}\n`);
    }
  }
}
