import { db } from "@daan/db";
import { bookChapter, bookChapterContent, bookChapterContentNarration } from "@daan/db/schema/book";
import { and, asc, eq, inArray } from "drizzle-orm";

import { readConfig } from "../config";
import { generateSpeech } from "./generate";
import { segmentChapterContent } from "./segments";
import { removeNarrationAudio, resolveNarrationAudio, storeNarrationAudio } from "./storage";

export interface NarrationSelection {
  service: string;
  model: string;
  voice: string;
}

export interface NarrationQueue {
  add(recordId: string): Promise<string>;
  getActiveCount(): Promise<number>;
}

async function chapterSegments(chapterId: string) {
  const [chapter] = await db.select().from(bookChapter).where(eq(bookChapter.id, chapterId));
  if (!chapter) throw new Error("Chapter not found");
  const contents = await db
    .select()
    .from(bookChapterContent)
    .where(eq(bookChapterContent.chapterId, chapterId))
    .orderBy(asc(bookChapterContent.index));

  let offset = 0;
  return contents.flatMap((row) => {
    const segments = segmentChapterContent(row.content ?? "", chapter.title).map((segment) => ({
      ...segment,
      index: offset + segment.index,
      chapterContentId: row.id,
      bookId: row.bookId,
      chapterId: row.chapterId,
    }));
    offset += segments.length;
    return segments;
  });
}

export async function getNarrationSegments(chapterId: string, selection: NarrationSelection) {
  const segments = await chapterSegments(chapterId);
  const records = selection.service
    ? await db
        .select()
        .from(bookChapterContentNarration)
        .where(
          and(
            eq(bookChapterContentNarration.chapterId, chapterId),
            eq(bookChapterContentNarration.ttsServiceId, selection.service),
            eq(bookChapterContentNarration.model, selection.model),
            eq(bookChapterContentNarration.voice, selection.voice),
          ),
        )
        .orderBy(asc(bookChapterContentNarration.paragraphIndex))
    : [];
  const byIdentity = new Map(
    records.map((record) => [
      `${record.chapterContentId}:${record.positionStart}:${record.contentHash}`,
      record,
    ]),
  );

  return segments.map((segment) => {
    const record = byIdentity.get(
      `${segment.chapterContentId}:${segment.positionStart}:${segment.hash}`,
    );
    return {
      index: segment.index,
      positionStart: segment.positionStart,
      positionEnd: segment.positionEnd,
      originalContent: segment.originalContent,
      content: segment.content,
      hash: segment.hash,
      narrationId: record?.id ?? null,
      status: record?.status ?? "missing",
      error: record?.error ?? null,
      audioUrl:
        record?.status === "ready"
          ? `/narration/audio/${record.id}?v=${record.updatedAt.getTime()}`
          : null,
    };
  });
}

export async function queueNarrationRange(input: {
  chapterId: string;
  startIndex: number;
  count: number;
  selection: NarrationSelection;
  force: boolean;
  queue: NarrationQueue;
}) {
  if (!input.selection.service || !input.selection.model || !input.selection.voice) {
    throw new Error("Select a narration model and voice first");
  }
  const config = readConfig();
  const service = config.ttsServices.find((item) => item.id === input.selection.service);
  if (!service) throw new Error("Narration service not found");
  const configuredModel = service.models.find((model) => model.id === input.selection.model);
  if (!configuredModel) throw new Error("The selected narration model is not configured");
  if (
    service.provider === "deepgram" &&
    !/^aura-(?:\d+-)?[a-z0-9]+-[a-z]{2}$/i.test(input.selection.model)
  ) {
    throw new Error("The selected Deepgram voice is not a valid Aura model");
  }

  const segments = await chapterSegments(input.chapterId);
  const selected = segments.slice(input.startIndex, input.startIndex + Math.max(1, input.count));
  for (const segment of selected) {
    const conditions = and(
      eq(bookChapterContentNarration.chapterContentId, segment.chapterContentId),
      eq(bookChapterContentNarration.positionStart, segment.positionStart),
      eq(bookChapterContentNarration.contentHash, segment.hash),
      eq(bookChapterContentNarration.ttsServiceId, input.selection.service),
      eq(bookChapterContentNarration.model, input.selection.model),
      eq(bookChapterContentNarration.voice, input.selection.voice),
    );
    const [existing] = await db.select().from(bookChapterContentNarration).where(conditions);
    if (existing && !input.force && ["pending", "processing", "ready"].includes(existing.status)) {
      continue;
    }

    let recordId = existing?.id;
    if (existing) {
      await removeNarrationAudio(existing.audioPath);
      await db
        .update(bookChapterContentNarration)
        .set({
          paragraphIndex: segment.index,
          positionStart: segment.positionStart,
          positionEnd: segment.positionEnd,
          content: segment.content,
          originalContent: segment.originalContent,
          audioPath: null,
          status: "pending",
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(bookChapterContentNarration.id, existing.id));
    } else {
      recordId = crypto.randomUUID();
      await db.insert(bookChapterContentNarration).values({
        id: recordId,
        bookId: segment.bookId,
        chapterId: segment.chapterId,
        chapterContentId: segment.chapterContentId,
        paragraphIndex: segment.index,
        positionStart: segment.positionStart,
        positionEnd: segment.positionEnd,
        ttsServiceId: input.selection.service,
        model: input.selection.model,
        voice: input.selection.voice,
        content: segment.content,
        originalContent: segment.originalContent,
        contentHash: segment.hash,
        status: "pending",
      });
    }
    const jobId = await input.queue.add(recordId!);
    await db
      .update(bookChapterContentNarration)
      .set({ jobId })
      .where(eq(bookChapterContentNarration.id, recordId!));
  }

  return getNarrationSegments(input.chapterId, input.selection);
}

export async function getRecoverableNarrationIds(): Promise<string[]> {
  const records = await db
    .select({ id: bookChapterContentNarration.id })
    .from(bookChapterContentNarration)
    .where(inArray(bookChapterContentNarration.status, ["pending", "processing"]));
  return records.map((record) => record.id);
}

export async function processNarration(recordId: string): Promise<void> {
  const [record] = await db
    .select()
    .from(bookChapterContentNarration)
    .where(eq(bookChapterContentNarration.id, recordId));
  if (!record) return;

  await db
    .update(bookChapterContentNarration)
    .set({ status: "processing", error: null, updatedAt: new Date() })
    .where(eq(bookChapterContentNarration.id, recordId));

  try {
    const config = readConfig();
    const service = config.ttsServices.find((item) => item.id === record.ttsServiceId);
    if (!service) throw new Error("Narration service not found");
    const audio = await generateSpeech({
      service,
      model: record.model,
      voice: record.voice,
      text: record.content,
      proxy: config.socks5Proxy,
    });
    const audioPath = await storeNarrationAudio(record.id, audio);
    const [current] = await db
      .select({ id: bookChapterContentNarration.id })
      .from(bookChapterContentNarration)
      .where(eq(bookChapterContentNarration.id, recordId));
    if (!current) {
      await removeNarrationAudio(audioPath);
      return;
    }
    await db
      .update(bookChapterContentNarration)
      .set({ audioPath, status: "ready", error: null, updatedAt: new Date() })
      .where(eq(bookChapterContentNarration.id, recordId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Narration generation failed";
    await db
      .update(bookChapterContentNarration)
      .set({ status: "failed", error: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(bookChapterContentNarration.id, recordId));
    throw error;
  }
}

export async function getNarrationAudioPath(recordId: string): Promise<string | null> {
  const [record] = await db
    .select({ path: bookChapterContentNarration.audioPath })
    .from(bookChapterContentNarration)
    .where(eq(bookChapterContentNarration.id, recordId));
  return record?.path ? resolveNarrationAudio(record.path) : null;
}

export async function getReadyVoices(): Promise<
  Array<{ service: string; model: string; voice: string }>
> {
  const records = await db
    .selectDistinct({
      service: bookChapterContentNarration.ttsServiceId,
      model: bookChapterContentNarration.model,
      voice: bookChapterContentNarration.voice,
    })
    .from(bookChapterContentNarration)
    .where(eq(bookChapterContentNarration.status, "ready"));
  return records;
}

async function removeNarrationRecords(records: Array<{ id: string; audioPath: string | null }>) {
  await Promise.all(records.map((record) => removeNarrationAudio(record.audioPath)));
  for (const record of records) {
    await db
      .delete(bookChapterContentNarration)
      .where(eq(bookChapterContentNarration.id, record.id));
  }
}

export async function resetChapterNarration(chapterId: string): Promise<void> {
  const records = await db
    .select()
    .from(bookChapterContentNarration)
    .where(eq(bookChapterContentNarration.chapterId, chapterId));
  await removeNarrationRecords(records);
}

export async function resetBookNarration(bookId: string): Promise<void> {
  const records = await db
    .select()
    .from(bookChapterContentNarration)
    .where(eq(bookChapterContentNarration.bookId, bookId));
  await removeNarrationRecords(records);
}

export async function resetChapterContentNarration(chapterContentId: string): Promise<void> {
  const records = await db
    .select()
    .from(bookChapterContentNarration)
    .where(eq(bookChapterContentNarration.chapterContentId, chapterContentId));
  await removeNarrationRecords(records);
}
