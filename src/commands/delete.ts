import { createProvider } from "../providers/index.js";

export async function deleteCommand(name: string): Promise<void> {
  const provider = createProvider();
  const deleted = await provider.delete(name);

  if (deleted) {
    process.stderr.write(`Secret "${name}" deleted.\n`);
  } else {
    process.stderr.write(`Secret "${name}" not found.\n`);
    process.exitCode = 1;
  }
}
