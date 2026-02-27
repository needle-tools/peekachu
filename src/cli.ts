import { Command } from "commander";
import { setCommand } from "./commands/set.js";
import { listCommand } from "./commands/list.js";
import { deleteCommand } from "./commands/delete.js";
import { runCommand } from "./commands/run.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("peekachu")
  .description("Password manager for AIs — store secrets in OS keychain, inject into processes, scrub output")
  .version("0.1.0");

program
  .command("set <name>")
  .description("Store a secret (prompts via native OS dialog)")
  .action(async (name: string) => {
    await setCommand(name);
  });

program
  .command("list")
  .description("List stored secret names (never values)")
  .action(async () => {
    await listCommand();
  });

program
  .command("delete <name>")
  .description("Delete a stored secret")
  .action(async (name: string) => {
    await deleteCommand(name);
  });

program
  .command("run")
  .description("Run a command with secrets injected and output scrubbed")
  .option("-e, --env <name...>", "Secret name(s) to inject as env vars")
  .option("--ci", "CI mode: read secrets from environment, scrub only")
  .argument("<command...>", "Command to run (after --)")
  .action(async (commandArgs: string[], options) => {
    await runCommand(commandArgs, options);
  });

program
  .command("status")
  .description("Show platform and provider info")
  .action(() => {
    statusCommand();
  });

program.parseAsync().catch((err) => {
  process.stderr.write(`peekachu: ${err.message}\n`);
  process.exitCode = 1;
});
