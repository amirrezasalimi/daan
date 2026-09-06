import { createHash } from "node:crypto";

export interface NarrationSegment {
  index: number;
  positionStart: number;
  positionEnd: number;
  originalContent: string;
  content: string;
  hash: string;
}

const BLOCK_PATTERN = /<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const TAG_PATTERN = /<[^>]*>/g;
const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&apos;": "'",
  "&#39;": "'",
  "&gt;": ">",
  "&lt;": "<",
  "&nbsp;": " ",
  "&quot;": '"',
};

function decodeEntities(value: string): string {
  return value
    .replace(
      /&(amp|apos|#39|gt|lt|nbsp|quot);/gi,
      (entity) => ENTITY_MAP[entity.toLowerCase()] ?? entity,
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

export function normalizeTextForTts(value: string): string {
  const withoutControls = Array.from(decodeEntities(value), (character) => {
    const code = character.codePointAt(0) ?? 0;
    const allowedWhitespace = code === 9 || code === 10 || code === 13;
    return (code < 32 && !allowedWhitespace) || code === 127 ? "" : character;
  }).join("");

  return withoutControls
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/([\p{L}\p{N}])-\s*\n\s*([\p{Ll}])/gu, "$1$2")
    .replace(/[‐‑‒–—]/g, "—")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function hashSegment(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function segmentChapterContent(content: string, chapterTitle = ""): NarrationSegment[] {
  const candidates: Array<{ start: number; end: number; text: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = BLOCK_PATTERN.exec(content)) !== null) {
    const inner = match[2] ?? "";
    candidates.push({
      start: match.index,
      end: match.index + match[0].length,
      text: decodeEntities(inner.replace(/<br\s*\/?>/gi, "\n").replace(TAG_PATTERN, "")),
    });
  }

  if (candidates.length === 0) {
    let cursor = 0;
    for (const part of content.split(/\n{2,}/)) {
      const start = content.indexOf(part, cursor);
      const end = start + part.length;
      cursor = end;
      candidates.push({ start, end, text: part });
    }
  }

  const segments = candidates.flatMap((candidate) => {
    const originalContent = candidate.text.trim();
    const normalized = normalizeTextForTts(originalContent);
    if (!normalized) return [];
    return [
      {
        index: 0,
        positionStart: candidate.start,
        positionEnd: candidate.end,
        originalContent,
        content: normalized,
        hash: hashSegment(normalized),
      },
    ];
  });

  const normalizedTitle = normalizeTextForTts(chapterTitle).toLocaleLowerCase();
  if (normalizedTitle) {
    let combined = "";
    for (let index = 0; index < Math.min(3, segments.length); index += 1) {
      combined = normalizeTextForTts(`${combined} ${segments[index]!.content}`).toLocaleLowerCase();
      if (combined === normalizedTitle) {
        segments.splice(0, index + 1);
        break;
      }
      if (!normalizedTitle.startsWith(combined)) break;
    }
  }

  return segments.map((segment, index) => ({ ...segment, index }));
}
