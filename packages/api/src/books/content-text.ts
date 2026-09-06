const BLOCK_END = /<\/(?:h[1-6]|p|div|li|blockquote)>/gi;
const LINE_BREAK = /<br\s*\/?>/gi;
const TAG = /<[^>]*>/g;

/** Convert our stored semantic HTML subset (or legacy plain text) to text. */
export function contentToPlainText(content: string): string {
  return content
    .replace(BLOCK_END, "\n")
    .replace(LINE_BREAK, "\n")
    .replace(TAG, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
