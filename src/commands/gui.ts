import { spawn, execFileSync } from "child_process";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

export async function guiCommand(): Promise<void> {
  // Resolve the gui/ directory relative to the package root
  const __filename = fileURLToPath(import.meta.url);
  const packageRoot = resolve(dirname(__filename), "..", "..");
  const guiDir = resolve(packageRoot, "gui");

  // Check that bun is available (required by Electrobun)
  try {
    execFileSync("bun", ["--version"], { stdio: "ignore" });
  } catch {
    process.stderr.write(
      "peekachu gui requires bun. Install it: https://bun.sh\n",
    );
    process.exitCode = 1;
    return;
  }

  // Check that the gui/ directory exists
  if (!existsSync(guiDir)) {
    process.stderr.write(
      `GUI directory not found at ${guiDir}\n` +
        "The GUI is not bundled with the npm package. Clone the repo to use it.\n",
    );
    process.exitCode = 1;
    return;
  }

  // Spawn `bun start` in the gui/ directory
  const child = spawn("bun", ["start"], {
    cwd: guiDir,
    stdio: "inherit",
  });

  const code = await new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });

  if (code !== null && code !== 0) {
    process.exitCode = code;
  }
}
