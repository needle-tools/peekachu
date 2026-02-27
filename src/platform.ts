import { platform } from "node:os";

export type Platform = "macos" | "linux" | "unsupported";

export function detectPlatform(): Platform {
  const p = platform();
  if (p === "darwin") return "macos";
  if (p === "linux") return "linux";
  return "unsupported";
}
