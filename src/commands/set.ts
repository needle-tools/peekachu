import { createProvider } from "../providers/index.js";
import { promptSecret } from "../input.js";

export async function setCommand(name: string): Promise<void> {
  const value = await promptSecret(name);

  if (!value) {
    process.stderr.write("Error: empty secret value.\n");
    process.exitCode = 1;
    return;
  }

  const provider = createProvider();
  await provider.set(name, value);
  process.stderr.write(`Secret "${name}" stored successfully.\n`);
}
