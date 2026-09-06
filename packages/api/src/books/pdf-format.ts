import type { StructuredTextItem } from "unpdf";

import { cleanChapterTitle } from "./chapter-title";
import {
  mergePdfLines,
  type PdfLine,
  weightedBodyFontSize,
} from "./pdf-layout";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRuns(line: PdfLine): string {
  return line.runs
    .map((run) => {
      const text = escapeHtml(run.text);
      return run.bold ? `<strong>${text}</strong>` : text;
    })
    .join(" ");
}

function headingLevel(line: PdfLine, bodySize: number): 2 | 3 | null {
  if (line.text.length > 120) return null;
  const ratio = line.fontSize / Math.max(1, bodySize);
  if (ratio >= 1.55) return 2;
  if (ratio >= 1.24) return 3;
  return null;
}

function isParagraphBreak(current: PdfLine[], next: PdfLine, bodySize: number): boolean {
  const previous = current.at(-1);
  if (!previous) return false;
  const verticalGap = previous.y - next.y;
  const indentChange = Math.abs(previous.x - next.x);
  return verticalGap > bodySize * 1.65 || indentChange > bodySize * 1.8;
}

function renderPage(lines: PdfLine[], bodySize: number): string {
  const output: string[] = [];
  let paragraph: PdfLine[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    output.push(`<p>${paragraph.map(renderRuns).join(" ")}</p>`);
    paragraph = [];
  };

  for (const line of lines) {
    const level = headingLevel(line, bodySize);
    if (level) {
      flushParagraph();
      const headingText = cleanChapterTitle(line.text);
      if (headingText !== "Untitled") {
        output.push(`<h${level}>${escapeHtml(headingText)}</h${level}>`);
      }
      continue;
    }

    if (isParagraphBreak(paragraph, line, bodySize)) flushParagraph();
    paragraph.push(line);
  }
  flushParagraph();
  return output.join("\n");
}

/**
 * Convert positioned PDF text into a trusted semantic subset:
 * h2, h3, p and strong. All source text is HTML-escaped first.
 */
export function formatPdfPages(
  pageItems: StructuredTextItem[][],
): string[] {
  const allLines = mergePdfLines(pageItems);
  const bodySize = weightedBodyFontSize(allLines.flat());
  return allLines.map((lines) => renderPage(lines, bodySize));
}
