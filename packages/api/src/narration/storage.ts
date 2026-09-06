import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { findProjectRoot } from "../config/store";

function narrationDirectory(): string {
  return join(findProjectRoot(), "uploads", "narration");
}

export async function storeNarrationAudio(id: string, data: Uint8Array): Promise<string> {
  const directory = narrationDirectory();
  const path = join(directory, `${id}.mp3`);
  await mkdir(directory, { recursive: true });
  await writeFile(path, data);
  return relative(findProjectRoot(), path);
}

export async function removeNarrationAudio(path: string | null): Promise<void> {
  if (!path) return;
  const allowedDirectory = resolve(narrationDirectory());
  const absolutePath = resolve(findProjectRoot(), path);
  if (!absolutePath.startsWith(`${allowedDirectory}/`)) return;
  await rm(absolutePath, { force: true });
}

export function resolveNarrationAudio(path: string): string | null {
  const allowedDirectory = resolve(narrationDirectory());
  const absolutePath = resolve(findProjectRoot(), path);
  return absolutePath.startsWith(`${allowedDirectory}/`) ? absolutePath : null;
}
