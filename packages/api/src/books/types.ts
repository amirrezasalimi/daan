/**
 * A chapter detected in a book source, with an optional page range and the
 * plain-text content that falls within it.
 */
export interface DetectedChapter {
  title: string;
  /** 1-based inclusive page (PDF) or spine index (EPUB). */
  startPage: number;
  /** 1-based inclusive page (PDF) or spine index (EPUB). */
  endPage: number;
  /** Extracted plain-text content for the chapter, if available. */
  content: string;
}

/**
 * The normalised result of parsing a book source into pages and chapters.
 */
export interface ParsedBook {
  title: string;
  author?: string;
  /** Plain text of each page/section, in reading order (0-based array). */
  pages: string[];
  chapters: DetectedChapter[];
}

export type SourceType = "pdf" | "ebook";
