/** Format extracted all-caps or inconsistent chapter labels as readable title case. */
export function formatChapterTitle(title: string): string {
  return title
    .toLocaleLowerCase()
    .replace(/(^|[\s\-–—])\p{L}/gu, (match) => match.toLocaleUpperCase());
}
