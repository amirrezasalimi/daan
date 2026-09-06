import { z } from "zod";

import {
  getNarrationSegments,
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

  getSegments: publicProcedure
    .input(z.object({ chapterId: z.string().min(1), selection: selectionSchema }))
    .handler(({ input }) => getNarrationSegments(input.chapterId, input.selection)),

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
