import { createHash } from "node:crypto";

import { db } from "@daan/db";
import { bookChapter, narrationPreparationRun, preparedNarrationChunk } from "@daan/db/schema/book";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import OpenAI from "openai";

import { readConfig } from "../config";
import type { NarrationPreparationQuality } from "../config/schema";
import {
  buildNarrationPreparationRequest,
  parseNarrationPreparationResponse,
  selectNarrationPreparationWindow,
} from "./preparation-xml";
import { resetChapterNarration } from "./service";
import {
  getChapterSourceSegments,
  getCurrentPreparedChunks,
  getPreparationIdentity,
  NARRATION_PREPARATION_PROMPT_VERSION,
} from "./source";

export interface NarrationPreparationQueue {
  add(runId: string): Promise<string>;
  getActiveCount(): Promise<number>;
}

interface RunSnapshot {
  providerId: string;
  model: string;
  style: string;
  targetLanguage: string;
  quality: NarrationPreparationQuality;
  targetChunkCount: number;
  previousContextCount: number;
  futureContextCount: number;
  minimumCoveragePercent: number;
  maxNextItems: number;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function assertConfiguredPreparation() {
  const config = readConfig();
  const preparation = config.narrationPreparation;
  if (!preparation.enabled) throw new Error("Narration preparation is disabled");
  const provider = config.llmServices.find((service) => service.id === preparation.model.service);
  if (!provider) throw new Error("Narration preparation provider is not configured");
  if (!provider.models.some((model) => model.id === preparation.model.model)) {
    throw new Error("Narration preparation model is not configured for the selected provider");
  }
  return { config, preparation, provider };
}

function snapshotRun(run: typeof narrationPreparationRun.$inferSelect): RunSnapshot {
  return {
    providerId: run.providerId,
    model: run.model,
    style: run.style,
    targetLanguage: run.targetLanguage,
    quality: run.quality,
    targetChunkCount: run.targetChunkCount,
    previousContextCount: run.previousContextCount,
    futureContextCount: run.futureContextCount,
    minimumCoveragePercent: run.minimumCoveragePercent,
    maxNextItems: run.maxNextItems,
  };
}

function completionQuality(quality: NarrationPreparationQuality) {
  if (quality === "fast") return { temperature: 0.2, max_completion_tokens: 3_000 };
  if (quality === "high") return { temperature: 0.05, max_completion_tokens: 8_000 };
  return { temperature: 0.1, max_completion_tokens: 5_000 };
}

async function matchingReadyRuns(chapterId: string) {
  const config = readConfig();
  const identity = getPreparationIdentity(config);
  return db
    .select()
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
    )
    .orderBy(desc(narrationPreparationRun.createdAt));
}

export async function getNarrationPreparationRuns(chapterId: string) {
  return db
    .select()
    .from(narrationPreparationRun)
    .where(eq(narrationPreparationRun.chapterId, chapterId))
    .orderBy(desc(narrationPreparationRun.createdAt));
}

export async function getNarrationPreparationChunks(chapterId: string) {
  return db
    .select()
    .from(preparedNarrationChunk)
    .where(eq(preparedNarrationChunk.chapterId, chapterId))
    .orderBy(asc(preparedNarrationChunk.sourceStartIndex), asc(preparedNarrationChunk.outputIndex));
}

export async function getNarrationPreparationStats(chapterId: string) {
  const [sources, runs, currentChunks] = await Promise.all([
    getChapterSourceSegments(chapterId),
    matchingReadyRuns(chapterId),
    getCurrentPreparedChunks(chapterId, readConfig()),
  ]);
  const sourceHashes = new Set(sources.map((source) => source.preparationHash));
  const ready = new Set(
    currentChunks.flatMap((chunk) => chunk.sourceHashes).filter((hash) => sourceHashes.has(hash)),
  );
  const omitted = new Set<string>();
  for (const run of runs) {
    for (const hash of run.omittedSourceHashes) {
      if (sourceHashes.has(hash) && !ready.has(hash)) omitted.add(hash);
    }
  }
  return {
    total: sources.length,
    ready: ready.size,
    omitted: omitted.size,
    unprocessed: Math.max(0, sources.length - ready.size),
    nextUnprocessedIndex:
      sources.find((source) => !ready.has(source.preparationHash))?.index ?? null,
  };
}

export async function getNarrationPreparationChapterState(chapterId: string) {
  const [stats, chunks, runs] = await Promise.all([
    getNarrationPreparationStats(chapterId),
    getNarrationPreparationChunks(chapterId),
    getNarrationPreparationRuns(chapterId),
  ]);
  return { stats, chunks, runs };
}

async function deletePreparationRuns(runIds: string[]): Promise<void> {
  if (runIds.length === 0) return;
  await db.delete(narrationPreparationRun).where(inArray(narrationPreparationRun.id, runIds));
}

export async function resetChapterPreparation(chapterId: string): Promise<void> {
  await resetChapterNarration(chapterId);
  await db.delete(narrationPreparationRun).where(eq(narrationPreparationRun.chapterId, chapterId));
}

export async function resetBookPreparation(bookId: string): Promise<void> {
  await db.delete(narrationPreparationRun).where(eq(narrationPreparationRun.bookId, bookId));
}

export async function queueNarrationPreparation(input: {
  chapterId: string;
  startIndex: number;
  force: boolean;
  queue: NarrationPreparationQueue;
}) {
  const { config, preparation } = assertConfiguredPreparation();
  const sources = await getChapterSourceSegments(input.chapterId);
  const startIndex = Math.min(input.startIndex, sources.length);

  if (input.force && sources.length > startIndex) {
    const endIndex = Math.min(sources.length - 1, startIndex + preparation.maxNextItems - 1);
    const overlapping = await db
      .select({ id: narrationPreparationRun.id })
      .from(narrationPreparationRun)
      .where(
        and(
          eq(narrationPreparationRun.chapterId, input.chapterId),
          lte(narrationPreparationRun.targetStartIndex, endIndex),
          gte(narrationPreparationRun.targetEndIndex, startIndex),
        ),
      );
    await resetChapterNarration(input.chapterId);
    await deletePreparationRuns(overlapping.map((run) => run.id));
  }

  const prepared = await getCurrentPreparedChunks(input.chapterId, config);
  const covered = new Set(prepared.flatMap((chunk) => chunk.sourceHashes));
  const targets = sources
    .slice(startIndex)
    .filter((source) => input.force || !covered.has(source.preparationHash))
    .slice(0, preparation.maxNextItems);
  if (targets.length === 0) return { runId: null, jobId: null };

  const [chapter] = await db.select().from(bookChapter).where(eq(bookChapter.id, input.chapterId));
  if (!chapter) throw new Error("Chapter not found");
  const identity = getPreparationIdentity(config);
  const runId = crypto.randomUUID();
  const jobId = `narration-preparation:${runId}`;
  await db.insert(narrationPreparationRun).values({
    id: runId,
    bookId: chapter.bookId,
    chapterId: chapter.id,
    targetStartIndex: targets[0]!.index,
    targetEndIndex: targets.at(-1)!.index,
    targetSourceHashes: targets.map((source) => source.preparationHash),
    coveredSourceHashes: [],
    omittedSourceHashes: [],
    providerId: identity.providerId,
    model: identity.model,
    style: identity.style,
    targetLanguage: identity.targetLanguage,
    quality: identity.quality,
    targetChunkCount: preparation.targetChunkCount,
    previousContextCount: preparation.previousContextCount,
    futureContextCount: preparation.futureContextCount,
    minimumCoveragePercent: preparation.minimumCoveragePercent,
    maxNextItems: preparation.maxNextItems,
    promptVersion: NARRATION_PREPARATION_PROMPT_VERSION,
    jobId,
    status: "pending",
  });

  try {
    const queuedJobId = await input.queue.add(runId);
    if (queuedJobId !== jobId) {
      await db
        .update(narrationPreparationRun)
        .set({ jobId: queuedJobId, updatedAt: new Date() })
        .where(eq(narrationPreparationRun.id, runId));
    }
    return { runId, jobId: queuedJobId };
  } catch (error) {
    await db
      .update(narrationPreparationRun)
      .set({ status: "failed", error: String(error).slice(0, 500), updatedAt: new Date() })
      .where(eq(narrationPreparationRun.id, runId));
    throw error;
  }
}

export async function getRecoverableNarrationPreparationRunIds(): Promise<string[]> {
  const runs = await db
    .select({ id: narrationPreparationRun.id })
    .from(narrationPreparationRun)
    .where(inArray(narrationPreparationRun.status, ["pending", "processing"]));
  return runs.map((run) => run.id);
}

export async function processNarrationPreparation(runId: string): Promise<void> {
  const [run] = await db
    .select()
    .from(narrationPreparationRun)
    .where(eq(narrationPreparationRun.id, runId));
  if (!run || run.status === "ready") return;

  await db.delete(preparedNarrationChunk).where(eq(preparedNarrationChunk.runId, runId));
  await db
    .update(narrationPreparationRun)
    .set({ status: "processing", error: null, startedAt: new Date(), completedAt: null })
    .where(eq(narrationPreparationRun.id, runId));

  try {
    const config = readConfig();
    const provider = config.llmServices.find((service) => service.id === run.providerId);
    if (!provider) throw new Error("Snapshotted narration preparation provider is unavailable");
    if (!provider.models.some((model) => model.id === run.model)) {
      throw new Error("Snapshotted narration preparation model is unavailable");
    }
    const sources = await getChapterSourceSegments(run.chapterId);
    const sourceByHash = new Map(sources.map((source) => [source.preparationHash, source]));
    const targetSources = run.targetSourceHashes.map((hash) => {
      const source = sourceByHash.get(hash);
      if (!source) throw new Error("Chapter source changed after run was queued");
      return source;
    });
    const snapshot = snapshotRun(run);
    const priorChunks = await getCurrentPreparedChunks(run.chapterId, {
      ...config,
      narrateStyle: snapshot.style as typeof config.narrateStyle,
      narrationPreparation: {
        ...config.narrationPreparation,
        enabled: true,
        model: { service: snapshot.providerId, model: snapshot.model },
        targetLanguage: snapshot.targetLanguage,
        quality: snapshot.quality,
      },
    });
    const processedByHash = new Map<string, string>();
    const priorGroups = new Map<string, typeof priorChunks>();
    for (const chunk of priorChunks) {
      const key = `${chunk.runId}:${chunk.sourceStartIndex}:${chunk.sourceEndIndex}`;
      const group = priorGroups.get(key) ?? [];
      group.push(chunk);
      priorGroups.set(key, group);
    }
    for (const group of priorGroups.values()) {
      const ordered = group.sort((left, right) => left.outputIndex - right.outputIndex);
      const lastHash = ordered[0]?.sourceHashes.at(-1);
      if (lastHash)
        processedByHash.set(lastHash, ordered.map((chunk) => chunk.content).join("\n\n"));
    }
    const client = new OpenAI({
      baseURL: provider.endpoint,
      apiKey: provider.apiKey || "not-needed",
    });
    const covered: string[] = [];
    const omitted: string[] = [];
    let outputIndex = 0;

    for (let offset = 0; offset < targetSources.length;) {
      const targets = [targetSources[offset]!];
      while (targets.length < snapshot.targetChunkCount) {
        const candidate = targetSources[offset + targets.length];
        if (!candidate || candidate.index !== targets.at(-1)!.index + 1) break;
        targets.push(candidate);
      }
      offset += targets.length;
      const firstIndex = targets[0]!.index;
      const sourceView = sources.map((source) => ({
        id: source.id,
        hash: source.preparationHash,
        originalContent: source.content,
        processedContent: processedByHash.get(source.preparationHash) ?? null,
      }));
      const window = selectNarrationPreparationWindow({
        sources: sourceView,
        startIndex: firstIndex,
        targetCount: targets.length,
        previousContextCount: snapshot.previousContextCount,
        futureContextCount: snapshot.futureContextCount,
      });
      window.targets = targets.map((source) => ({
        id: source.id,
        hash: source.preparationHash,
        originalContent: source.content,
      }));
      const request = buildNarrationPreparationRequest({
        window,
        style: snapshot.style,
        targetLanguage: snapshot.targetLanguage || null,
        quality: snapshot.quality,
        minimumCoverage: snapshot.minimumCoveragePercent / 100,
      });
      const response = await client.chat.completions.create({
        model: snapshot.model,
        ...completionQuality(snapshot.quality),
        messages: [
          { role: "system", content: "Return only strict XML for narration preparation." },
          { role: "user", content: request },
        ],
      });
      const parsed = parseNarrationPreparationResponse({
        xml: response.choices[0]?.message.content ?? "",
        targetHashes: targets.map((source) => source.preparationHash),
        minimumCoverage: snapshot.minimumCoveragePercent / 100,
      });
      const indexByHash = new Map(targets.map((source) => [source.preparationHash, source.index]));
      const processedContext = new Map<string, { lastHash: string; parts: string[] }>();
      for (const output of parsed.outputChunks) {
        const indexes = output.sourceHashes.map((hash) => indexByHash.get(hash));
        if (indexes.some((index) => index === undefined))
          throw new Error("Prepared output has unknown source");
        const numericIndexes = indexes as number[];
        const sourceStartIndex = Math.min(...numericIndexes);
        const sourceEndIndex = Math.max(...numericIndexes);
        if (
          sourceEndIndex - sourceStartIndex + 1 !== numericIndexes.length ||
          numericIndexes.some((index, itemIndex) => index !== sourceStartIndex + itemIndex)
        ) {
          throw new Error("Prepared output chunks must cover ordered contiguous source chunks");
        }
        await db.insert(preparedNarrationChunk).values({
          id: crypto.randomUUID(),
          runId,
          bookId: run.bookId,
          chapterId: run.chapterId,
          outputIndex,
          sourceStartIndex,
          sourceEndIndex,
          sourceHashes: output.sourceHashes,
          content: output.content,
          contentHash: hashContent(output.content),
          providerId: snapshot.providerId,
          model: snapshot.model,
          style: snapshot.style,
          targetLanguage: snapshot.targetLanguage,
          quality: snapshot.quality,
        });
        outputIndex += 1;
        const contextKey = output.sourceHashes.join("\0");
        const context = processedContext.get(contextKey) ?? {
          lastHash: output.sourceHashes.at(-1)!,
          parts: [],
        };
        context.parts.push(output.content);
        processedContext.set(contextKey, context);
      }
      for (const context of processedContext.values()) {
        processedByHash.set(context.lastHash, context.parts.join("\n\n"));
      }
      covered.push(...parsed.coveredSourceHashes);
      omitted.push(...parsed.omittedSourceHashes);
    }

    await db
      .update(narrationPreparationRun)
      .set({
        coveredSourceHashes: covered,
        omittedSourceHashes: omitted,
        status: "ready",
        error: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(narrationPreparationRun.id, runId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Narration preparation failed";
    await db
      .update(narrationPreparationRun)
      .set({ status: "failed", error: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(narrationPreparationRun.id, runId));
    throw error;
  }
}
