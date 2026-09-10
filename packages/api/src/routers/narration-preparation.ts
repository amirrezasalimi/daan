import { z } from "zod";

import {
  getNarrationPreparationChapterState,
  getNarrationPreparationChunks,
  getNarrationPreparationRuns,
  getNarrationPreparationStats,
  queueNarrationPreparation,
  resetChapterPreparation,
} from "../narration/preparation-service";
import { publicProcedure } from "../index";

const chapterInput = z.object({ chapterId: z.string().min(1) });

export const narrationPreparationRouter = {
  getChapterState: publicProcedure
    .input(chapterInput)
    .handler(({ input }) => getNarrationPreparationChapterState(input.chapterId)),

  getChapterStats: publicProcedure
    .input(chapterInput)
    .handler(({ input }) => getNarrationPreparationStats(input.chapterId)),

  getChunks: publicProcedure
    .input(chapterInput)
    .handler(({ input }) => getNarrationPreparationChunks(input.chapterId)),

  getRuns: publicProcedure
    .input(chapterInput)
    .handler(({ input }) => getNarrationPreparationRuns(input.chapterId)),

  getActiveWorkerCount: publicProcedure.handler(({ context }) =>
    context.narrationPreparationQueue.getActiveCount(),
  ),

  prepare: publicProcedure
    .input(
      z.object({
        chapterId: z.string().min(1),
        startIndex: z.number().int().min(0),
        force: z.boolean().default(false),
      }),
    )
    .handler(({ input, context }) =>
      queueNarrationPreparation({ ...input, queue: context.narrationPreparationQueue }),
    ),

  resetChapter: publicProcedure.input(chapterInput).handler(async ({ input }) => {
    await resetChapterPreparation(input.chapterId);
    return { chapterId: input.chapterId };
  }),
};
