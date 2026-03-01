import { platform } from "node:os";

export type Platform = "macos" | "linux" | "windows" | "unsupported";

export function detectPlatform(): Platform {
  const p = platform();
  if (p === "darwin") return "macos";
  if (p === "linux") return "linux";
  if (p === "win32") return "windows";
  return "unsupported";
}
