import { z } from "zod";

import {
  countChapterNarrations,
  failBrowserNarration,
  getNarrationSegments,
  getPendingBrowserNarrations,
  getReadyVoices,
  queueNarrationRange,
  resetChapterNarration,
} from "../narration/service";
import { publicProcedure } from "../index";

const selectionSchema = z.object({
  service: z.string(),
  model: z.string(),
  voice: z.string(),
});

export const narrationRouter = {
  getActiveWorkerCount: publicProcedure.handler(({ context }) =>
    context.narrationQueue.getActiveCount(),
  ),

  getReadyVoices: publicProcedure.handler(() => getReadyVoices()),

  countChapterNarrations: publicProcedure
    .input(z.object({ chapterId: z.string().min(1) }))
    .handler(({ input }) => countChapterNarrations(input.chapterId)),

  getSegments: publicProcedure
    .input(z.object({ chapterId: z.string().min(1), selection: selectionSchema }))
    .handler(({ input }) => getNarrationSegments(input.chapterId, input.selection)),

  getPendingBrowserNarrations: publicProcedure
    .input(z.object({ chapterId: z.string().min(1), selection: selectionSchema }))
    .handler(({ input }) => getPendingBrowserNarrations(input)),

  failBrowserNarration: publicProcedure
    .input(z.object({ recordId: z.string().min(1), message: z.string().min(1) }))
    .handler(async ({ input }) => {
      await failBrowserNarration(input.recordId, input.message);
      return { id: input.recordId };
    }),

  generate: publicProcedure
    .input(
      z.object({
        chapterId: z.string().min(1),
        startIndex: z.number().int().min(0),
        count: z.number().int().min(1).max(21),
        selection: selectionSchema,
        force: z.boolean().default(false),
      }),
    )
    .handler(({ input, context }) =>
      queueNarrationRange({ ...input, queue: context.narrationQueue }),
    ),

  reset: publicProcedure
    .input(z.object({ chapterId: z.string().min(1) }))
    .handler(async ({ input }) => {
      await resetChapterNarration(input.chapterId);
      return { chapterId: input.chapterId };
    }),
};
