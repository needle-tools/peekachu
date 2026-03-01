import { createProvider } from "../providers/index.js";
import { promptSecret } from "../input.js";
import { detectProject } from "../project.js";
import { setComment, setCreatedAt } from "../metadata.js";

export async function setCommand(name: string, project?: string, comment?: string): Promise<void> {
  const resolvedProject = project ?? detectProject();
  const value = await promptSecret(name);

  if (!value) {
    process.stderr.write("Error: empty secret value.\n");
    process.exitCode = 1;
    return;
  }

  const provider = createProvider();
  await provider.set(name, value, resolvedProject);
  await setCreatedAt(name, resolvedProject);

  if (comment) {
    await setComment(name, comment, resolvedProject);
  }

  process.stderr.write(`Secret "${name}" stored successfully (project: ${resolvedProject}).\n`);
}
