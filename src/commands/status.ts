import { detectPlatform } from "../platform.js";

export function statusCommand(): void {
  const platform = detectPlatform();

  const providerInfo: Record<string, string> = {
    macos: "macOS Keychain (security CLI)",
    linux: "Linux Secret Service (secret-tool CLI)",
    unsupported: "None (unsupported platform)",
  };

  process.stdout.write(`Platform: ${platform}\n`);
  process.stdout.write(`Provider: ${providerInfo[platform]}\n`);
  process.stdout.write(`Node:     ${process.version}\n`);
}
