import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

import { findProjectRoot } from "../config/store";
import type { SourceType } from "./types";

const MIME_TYPES: Record<SourceType, string> = {
  pdf: "application/pdf",
  ebook: "application/epub+zip",
};

function safeExtension(fileName: string, type: SourceType): string {
  const extension = extname(fileName).toLocaleLowerCase();
  if (type === "pdf" && extension === ".pdf") return extension;
  if (type === "ebook" && extension === ".epub") return extension;
  return type === "pdf" ? ".pdf" : ".epub";
}

export interface StoredBookSource {
  absolutePath: string;
  path: string;
  size: number;
  mimeType: string;
}

export async function storeBookSource(
  bookId: string,
  fileName: string,
  type: SourceType,
  data: Uint8Array,
): Promise<StoredBookSource> {
  const projectRoot = findProjectRoot();
  const uploadDirectory = join(projectRoot, "uploads");
  const absolutePath = join(uploadDirectory, `${bookId}${safeExtension(fileName, type)}`);

  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(absolutePath, data);

  return {
    absolutePath,
    path: relative(projectRoot, absolutePath),
    size: data.byteLength,
    mimeType: MIME_TYPES[type],
  };
}

export async function removeBookSource(path: string | null): Promise<void> {
  if (!path) return;
  const projectRoot = findProjectRoot();
  const uploadDirectory = resolve(projectRoot, "uploads");
  const absolutePath = resolve(projectRoot, path);
  if (!absolutePath.startsWith(`${uploadDirectory}/`)) return;
  await rm(absolutePath, { force: true });
}
