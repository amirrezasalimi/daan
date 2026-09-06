import OpenAI from "openai";

import type { AppConfig, ModelRef } from "../config/schema";
import { detectChaptersFromPages } from "./heuristics";
import type { DetectedChapter } from "./types";

/**
 * Resolve a model reference against the configured services into an
 * OpenAI-compatible client + model id, or null when unavailable.
 */
export function resolveModel(
  config: AppConfig,
  ref: ModelRef,
): { client: OpenAI; model: string } | null {
  if (!ref.service || !ref.model) return null;
  const service = config.llmServices.find((s) => s.id === ref.service);
  if (!service) return null;

  const client = new OpenAI({
    baseURL: service.endpoint,
    apiKey: service.apiKey || "not-needed",
  });
  return { client, model: ref.model };
}

/** A compact per-page fingerprint used to prompt the model cheaply. */
function pageDigest(pages: string[]): string {
  return pages
    .map((page, i) => {
      const head = page
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(" | ")
        .slice(0, 160);
      return `[p${i + 1}] ${head}`;
    })
    .join("\n");
}

interface AiMarker {
  title: string;
  startPage: number;
}

/**
 * Use the configured extractChapters model to detect chapter titles and start
 * pages. Falls back to the local heuristic when the model or response fails.
 *
 * Only page digests (first lines of each page) are sent, keeping token usage
 * roughly linear and small even for large books.
 */
export async function detectChaptersWithAI(
  config: AppConfig,
  pages: string[],
): Promise<DetectedChapter[]> {
  const resolved = resolveModel(config, config.defaultModels.extractChapters);
  if (!resolved) return detectChaptersFromPages(pages);

  const digest = pageDigest(pages);
  const prompt = [
    "You are given the first lines of every page of a book, tagged [pN].",
    "Identify the real chapters (ignore headers/footers and running titles).",
    'Return ONLY JSON: {"chapters":[{"title":string,"startPage":number}]}.',
    "startPage is the [pN] where the chapter begins. Keep titles concise.",
    "",
    digest,
  ].join("\n");

  try {
    const response = await resolved.client.chat.completions.create({
      model: resolved.model,
      temperature: 0,
      messages: [
        { role: "system", content: "You extract book chapter structure as strict JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { chapters?: AiMarker[] };
    const markers = (parsed.chapters ?? [])
      .filter((m) => m && typeof m.startPage === "number" && m.title)
      .map((m) => ({
        title: String(m.title).trim().slice(0, 120),
        startPage: Math.min(Math.max(1, Math.floor(m.startPage)), pages.length),
      }))
      .sort((a, b) => a.startPage - b.startPage);

    if (markers.length === 0) return detectChaptersFromPages(pages);

    const chapters: DetectedChapter[] = [];
    for (let i = 0; i < markers.length; i += 1) {
      const marker = markers[i]!;
      const start = marker.startPage;
      const next = markers[i + 1];
      const end = next ? next.startPage - 1 : pages.length;
      const safeEnd = Math.max(start, end);
      const content = pages.slice(start - 1, safeEnd).join("\n\n").trim();
      chapters.push({ title: marker.title, startPage: start, endPage: safeEnd, content });
    }
    return chapters;
  } catch {
    return detectChaptersFromPages(pages);
  }
}
