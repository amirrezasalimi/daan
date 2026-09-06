import type { AppConfig } from "../config/schema";
import { detectChaptersWithAI } from "./ai";
import { parseEpub } from "./epub";
import { parsePdf } from "./pdf";
import type { ParsedBook, SourceType } from "./types";

export * from "./types";
export { parsePdf } from "./pdf";
export { parseEpub } from "./epub";
export { detectChaptersFromPages } from "./heuristics";

/**
 * Parse a raw book source into pages + chapters. When the config selects the
 * "ai" extraction mode, chapter detection is delegated to the configured model,
 * with a graceful fallback to the local heuristic.
 */
export async function parseBookSource(
  data: Uint8Array,
  type: SourceType,
  config: AppConfig,
): Promise<ParsedBook> {
  const parsed = type === "pdf" ? await parsePdf(data) : parseEpub(data);

  if (config.extractChapterMode === "ai") {
    parsed.chapters = await detectChaptersWithAI(config, parsed.pages);
  }

  return parsed;
}
