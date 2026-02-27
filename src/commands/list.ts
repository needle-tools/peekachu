import { createProvider } from "../providers/index.js";

export async function listCommand(): Promise<void> {
  const provider = createProvider();
  const names = await provider.list();

  if (names.length === 0) {
    process.stderr.write("No secrets stored.\n");
    return;
  }

  for (const name of names) {
    process.stdout.write(`${name}\n`);
  }
}
