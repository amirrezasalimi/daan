import { createHash } from "node:crypto";

import { db } from "@daan/db";
import {
  bookChapter,
  bookChapterContent,
  narrationPreparationRun,
  preparedNarrationChunk,
} from "@daan/db/schema/book";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { AppConfig } from "../config/schema";
import { segmentChapterContent } from "./segments";

export const NARRATION_PREPARATION_PROMPT_VERSION = "narration-preparation-v1";

export interface NarrationSourceSegment {
  id: string;
  index: number;
  bookId: string;
  chapterId: string;
  chapterContentId: string;
  positionStart: number;
  positionEnd: number;
  originalContent: string;
  content: string;
  hash: string;
  preparationHash: string;
}

export interface EffectiveNarrationSegment extends NarrationSourceSegment {
  sourceStartIndex: number;
  sourceEndIndex: number;
  preparationProviderId: string | null;
  preparationModel: string | null;
  preparationStyle: string | null;
  preparationTargetLanguage: string | null;
}

export interface PreparationIdentity {
  providerId: string;
  model: string;
  style: string;
  targetLanguage: string;
  quality: "fast" | "balanced" | "high";
}

function hashValue(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function getPreparationIdentity(config: AppConfig): PreparationIdentity {
  const preparation = config.narrationPreparation;
  return {
    providerId: preparation.model.service,
    model: preparation.model.model,
    style: config.narrateStyle,
    targetLanguage: preparation.targetLanguage.trim(),
    quality: preparation.quality,
  };
}

export async function getChapterSourceSegments(
  chapterId: string,
): Promise<NarrationSourceSegment[]> {
  const [chapter] = await db.select().from(bookChapter).where(eq(bookChapter.id, chapterId));
  if (!chapter) throw new Error("Chapter not found");

  const contents = await db
    .select()
    .from(bookChapterContent)
    .where(eq(bookChapterContent.chapterId, chapterId))
    .orderBy(asc(bookChapterContent.index));

  let globalIndex = 0;
  return contents.flatMap((row) =>
    segmentChapterContent(row.content ?? "", chapter.title).map((segment) => {
      const index = globalIndex;
      globalIndex += 1;
      return {
        ...segment,
        id: `${row.id}:${segment.positionStart}:${segment.hash}`,
        preparationHash: hashValue(`${row.id}\0${segment.positionStart}\0${segment.hash}`),
        index,
        bookId: row.bookId,
        chapterId: row.chapterId,
        chapterContentId: row.id,
      };
    }),
  );
}

export async function getCurrentPreparedChunks(chapterId: string, config: AppConfig) {
  const identity = getPreparationIdentity(config);
  if (!config.narrationPreparation.enabled || !identity.providerId || !identity.model) return [];

  const runs = await db
    .select({ id: narrationPreparationRun.id })
    .from(narrationPreparationRun)
    .where(
      and(
        eq(narrationPreparationRun.chapterId, chapterId),
        eq(narrationPreparationRun.status, "ready"),
        eq(narrationPreparationRun.providerId, identity.providerId),
        eq(narrationPreparationRun.model, identity.model),
        eq(narrationPreparationRun.style, identity.style),
        eq(narrationPreparationRun.targetLanguage, identity.targetLanguage),
        eq(narrationPreparationRun.quality, identity.quality),
        eq(narrationPreparationRun.promptVersion, NARRATION_PREPARATION_PROMPT_VERSION),
      ),
    );
  if (runs.length === 0) return [];

  return db
    .select()
    .from(preparedNarrationChunk)
    .where(
      inArray(
        preparedNarrationChunk.runId,
        runs.map((run) => run.id),
      ),
    )
    .orderBy(asc(preparedNarrationChunk.sourceStartIndex), asc(preparedNarrationChunk.outputIndex));
}

export async function getEffectiveNarrationSegments(
  chapterId: string,
  config: AppConfig,
): Promise<EffectiveNarrationSegment[]> {
  const sources = await getChapterSourceSegments(chapterId);
  if (!config.narrationPreparation.enabled) {
    return sources.map((source) => ({
      ...source,
      sourceStartIndex: source.index,
      sourceEndIndex: source.index,
      preparationProviderId: null,
      preparationModel: null,
      preparationStyle: null,
      preparationTargetLanguage: null,
    }));
  }

  const chunks = await getCurrentPreparedChunks(chapterId, config);
  const valid = chunks
    .filter((chunk) => {
      const range = sources.slice(chunk.sourceStartIndex, chunk.sourceEndIndex + 1);
      return (
        range.length === chunk.sourceEndIndex - chunk.sourceStartIndex + 1 &&
        range.every((source, offset) => source.preparationHash === chunk.sourceHashes[offset])
      );
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  const groups = new Map<string, (typeof valid)[number][]>();
  for (const chunk of valid) {
    const key = `${chunk.runId}:${chunk.sourceStartIndex}:${chunk.sourceEndIndex}`;
    const group = groups.get(key) ?? [];
    group.push(chunk);
    groups.set(key, group);
  }
  const byStart = new Map<number, (typeof valid)[number][]>();
  const occupied = new Set<number>();
  for (const group of groups.values()) {
    const firstChunk = group[0]!;
    const indexes = Array.from(
      { length: firstChunk.sourceEndIndex - firstChunk.sourceStartIndex + 1 },
      (_, offset) => firstChunk.sourceStartIndex + offset,
    );
    if (indexes.some((index) => occupied.has(index))) continue;
    byStart.set(
      firstChunk.sourceStartIndex,
      group.sort((left, right) => left.outputIndex - right.outputIndex),
    );
    indexes.forEach((index) => occupied.add(index));
  }

  const effective: EffectiveNarrationSegment[] = [];
  for (let index = 0; index < sources.length; index += 1) {
    const preparedGroup = byStart.get(index);
    if (preparedGroup) {
      const firstPrepared = preparedGroup[0]!;
      const first = sources[index]!;
      const last = sources[firstPrepared.sourceEndIndex]!;
      const originalContent = sources
        .slice(index, firstPrepared.sourceEndIndex + 1)
        .map((source) => source.originalContent)
        .join("\n\n");
      for (const prepared of preparedGroup) {
        const provenanceHash = hashValue(
          [
            prepared.contentHash,
            prepared.providerId,
            prepared.model,
            prepared.style,
            prepared.targetLanguage,
            prepared.quality,
          ].join("\0"),
        );
        effective.push({
          ...first,
          index: effective.length,
          positionEnd: last.positionEnd,
          originalContent,
          content: prepared.content,
          hash: provenanceHash,
          sourceStartIndex: prepared.sourceStartIndex,
          sourceEndIndex: prepared.sourceEndIndex,
          preparationProviderId: prepared.providerId,
          preparationModel: prepared.model,
          preparationStyle: prepared.style,
          preparationTargetLanguage: prepared.targetLanguage || null,
        });
      }
      index = firstPrepared.sourceEndIndex;
      continue;
    }

    const source = sources[index]!;
    effective.push({
      ...source,
      index: effective.length,
      sourceStartIndex: source.index,
      sourceEndIndex: source.index,
      preparationProviderId: null,
      preparationModel: null,
      preparationStyle: null,
      preparationTargetLanguage: null,
    });
  }
  return effective;
}
