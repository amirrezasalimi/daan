import OpenAI from "openai";
import { z } from "zod";

import { appConfigSchema, readConfig, writeConfig } from "../config";
import { publicProcedure } from "../index";

export const settingsRouter = {
  get: publicProcedure.handler(() => {
    return readConfig();
  }),

  update: publicProcedure.input(appConfigSchema).handler(({ input }) => {
    return writeConfig(input);
  }),

  listModels: publicProcedure
    .input(
      z.object({
        endpoint: z.string().min(1),
        apiKey: z.string().default(""),
      }),
    )
    .handler(async ({ input }) => {
      const openai = new OpenAI({
        baseURL: input.endpoint,
        apiKey: input.apiKey || "not-needed",
      });

      const response = await openai.models.list();
      const ids = response.data.map((model) => model.id).filter(Boolean);

      return { models: [...new Set(ids)].sort() };
    }),
};
