import type { SecretProvider } from "./types.js";
import { KeychainProvider } from "./keychain.js";
import { CIProvider } from "./ci.js";
import { WindowsProvider } from "./windows.js";
import { detectPlatform } from "../platform.js";

export type ProviderType = "keychain" | "ci";

export function createProvider(type?: ProviderType): SecretProvider {
  if (type === "ci") {
    return new CIProvider();
  }

  const platform = detectPlatform();
  if (platform === "windows") {
    return new WindowsProvider();
  }
  if (platform === "unsupported") {
    throw new Error(
      "Unsupported platform. Peekachu requires macOS (Keychain), Linux (libsecret), or Windows (Credential Manager).",
    );
  }

  return new KeychainProvider();
}

export { type SecretProvider } from "./types.js";
export { KeychainProvider } from "./keychain.js";
export { CIProvider } from "./ci.js";
export { WindowsProvider } from "./windows.js";
