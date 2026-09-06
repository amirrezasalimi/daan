import { unzipSync } from "fflate";

import type { DetectedChapter, ParsedBook } from "./types";

const decoder = new TextDecoder("utf-8");

interface EpubFiles {
  [path: string]: Uint8Array;
}

function readText(files: EpubFiles, path: string): string | null {
  const entry = files[path] ?? files[path.replace(/^\//, "")];
  return entry ? decoder.decode(entry) : null;
}

/** Strip HTML tags to plain text while preserving paragraph breaks. */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"))
    ?? tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"));
  return match?.[1] ?? null;
}

/** Resolve a path relative to the directory of the OPF file. */
function resolvePath(base: string, relative: string): string {
  const decoded = decodeURIComponent(relative.split("#")[0] ?? "");
  const parts = base.split("/").slice(0, -1);
  for (const segment of decoded.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== "." && segment !== "") parts.push(segment);
  }
  return parts.join("/");
}

/** Locate the OPF package document via META-INF/container.xml. */
function findOpfPath(files: EpubFiles): string | null {
  const container = readText(files, "META-INF/container.xml");
  if (!container) return null;
  const rootfile = container.match(/<rootfile[^>]*full-path\s*=\s*["']([^"']+)["']/i);
  return rootfile?.[1] ?? null;
}

interface Manifest {
  [id: string]: { href: string; mediaType: string };
}

function parseManifest(opf: string, opfPath: string): Manifest {
  const manifest: Manifest = {};
  const items = opf.match(/<item\b[^>]*>/gi) ?? [];
  for (const item of items) {
    const id = attr(item, "id");
    const href = attr(item, "href");
    const mediaType = attr(item, "media-type") ?? "";
    if (id && href) {
      manifest[id] = { href: resolvePath(opfPath, href), mediaType };
    }
  }
  return manifest;
}

function parseSpine(opf: string, manifest: Manifest): string[] {
  const spineBlock = opf.match(/<spine\b[^>]*>([\s\S]*?)<\/spine>/i)?.[1] ?? "";
  const refs = spineBlock.match(/<itemref\b[^>]*>/gi) ?? [];
  const hrefs: string[] = [];
  for (const ref of refs) {
    const idref = attr(ref, "idref");
    if (idref && manifest[idref]) hrefs.push(manifest[idref].href);
  }
  return hrefs;
}

/** Map a document href to the spine index it belongs to. */
function spineIndexFor(href: string, spine: string[]): number {
  const clean = decodeURIComponent(href.split("#")[0] ?? "");
  return spine.findIndex((s) => s.endsWith(clean) || clean.endsWith(s));
}

/**
 * Parse the NAV (EPUB3) or NCX (EPUB2) table of contents into ordered
 * { title, spineIndex } markers.
 */
function parseToc(
  files: EpubFiles,
  opf: string,
  opfPath: string,
  manifest: Manifest,
  spine: string[],
): { title: string; spineIndex: number }[] {
  const markers: { title: string; spineIndex: number }[] = [];

  // EPUB3 nav document.
  const navItem = Object.values(manifest).find((m) =>
    /nav/i.test(m.href) || m.mediaType === "application/xhtml+xml",
  );
  const navId = opf.match(/properties\s*=\s*["'][^"']*nav[^"']*["'][^>]*href\s*=\s*["']([^"']+)["']/i);

  let navHref: string | null = null;
  if (navId?.[1]) navHref = resolvePath(opfPath, navId[1]);
  else if (navItem && /nav/i.test(navItem.href)) navHref = navItem.href;

  if (navHref) {
    const nav = readText(files, navHref);
    if (nav) {
      const links = nav.match(/<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi) ?? [];
      for (const link of links) {
        const href = attr(link, "href");
        const title = htmlToText(link).trim();
        if (!href || !title) continue;
        const idx = spineIndexFor(resolvePath(navHref, href), spine);
        if (idx >= 0) markers.push({ title, spineIndex: idx });
      }
    }
  }

  // EPUB2 NCX fallback.
  if (markers.length === 0) {
    const ncx = Object.values(manifest).find((m) => m.mediaType === "application/x-dtbncx+xml");
    const ncxText = ncx ? readText(files, ncx.href) : null;
    if (ncxText && ncx) {
      const points = ncxText.match(/<navPoint\b[\s\S]*?<\/navPoint>/gi) ?? [];
      for (const point of points) {
        const title = point.match(/<text>([\s\S]*?)<\/text>/i)?.[1]?.trim();
        const src = point.match(/<content\b[^>]*src\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!title || !src) continue;
        const idx = spineIndexFor(resolvePath(ncx.href, src), spine);
        if (idx >= 0) markers.push({ title: htmlToText(title), spineIndex: idx });
      }
    }
  }

  const seen = new Set<number>();
  return markers
    .sort((a, b) => a.spineIndex - b.spineIndex)
    .filter((m) => (seen.has(m.spineIndex) ? false : seen.add(m.spineIndex)));
}

/**
 * Parse an EPUB buffer into per-section pages and chapters. Each spine document
 * becomes one "page"; the table of contents (or spine order) defines chapters.
 */
export function parseEpub(data: Uint8Array): ParsedBook {
  const files = unzipSync(data) as EpubFiles;

  const opfPath = findOpfPath(files);
  if (!opfPath) {
    throw new Error("Invalid EPUB: missing package document");
  }
  const opf = readText(files, opfPath) ?? "";

  const title = opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim();
  const author = opf.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]?.trim();

  const manifest = parseManifest(opf, opfPath);
  const spine = parseSpine(opf, manifest);

  const pages = spine.map((href) => {
    const raw = readText(files, href);
    return raw ? htmlToText(raw) : "";
  });

  const toc = parseToc(files, opf, opfPath, manifest, spine);

  const markers = toc.length > 0
    ? toc
    : spine.map((_, i) => ({ title: `Section ${i + 1}`, spineIndex: i }));

  if ((markers[0]?.spineIndex ?? 0) > 0) {
    markers.unshift({ title: "Front matter", spineIndex: 0 });
  }

  const chapters: DetectedChapter[] = markers.map((marker, i) => {
    const start = marker.spineIndex;
    const next = markers[i + 1];
    const end = next ? next.spineIndex - 1 : spine.length - 1;
    const safeEnd = Math.max(start, end);
    const content = pages.slice(start, safeEnd + 1).join("\n\n").trim();
    return {
      title: marker.title || `Section ${i + 1}`,
      startPage: start + 1,
      endPage: safeEnd + 1,
      content,
    };
  });

  return {
    title: title || "",
    author: author || undefined,
    pages,
    chapters,
  };
}
