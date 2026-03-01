import { Command } from "commander";
import { setCommand } from "./commands/set.js";
import { listCommand } from "./commands/list.js";
import { deleteCommand } from "./commands/delete.js";
import { runCommand } from "./commands/run.js";
import { statusCommand } from "./commands/status.js";
import { initCommand } from "./commands/init.js";

const program = new Command();

program
  .name("peekachu")
  .description("Password manager for AIs — store secrets in OS keychain, inject into processes, scrub output")
  .version("0.1.0");

program
  .command("set <name>")
  .description("Store a secret (prompts via native OS dialog)")
  .option("-p, --project <project>", "Project namespace")
  .action(async (name: string, options: { project?: string }) => {
    await setCommand(name, options.project);
  });

program
  .command("list")
  .description("List stored secret names (never values)")
  .option("-p, --project <project>", "Project namespace")
  .action(async (options: { project?: string }) => {
    await listCommand(options.project);
  });

program
  .command("delete <name>")
  .description("Delete a stored secret")
  .option("-p, --project <project>", "Project namespace")
  .action(async (name: string, options: { project?: string }) => {
    await deleteCommand(name, options.project);
  });

program
  .command("run")
  .description("Run a command with secrets injected and output scrubbed")
  .option("-e, --env <name...>", "Secret name(s) to inject as env vars")
  .option("--ci", "CI mode: read secrets from environment, scrub only")
  .option("-p, --project <project>", "Project namespace")
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

program
  .command("init")
  .description("Create a .peekachu project config in the current directory")
  .argument("[project]", "Project name (defaults to directory name)")
  .action((project?: string) => {
    initCommand(project);
  });

program.parseAsync().catch((err) => {
  process.stderr.write(`peekachu: ${err.message}\n`);
  process.exitCode = 1;
});
