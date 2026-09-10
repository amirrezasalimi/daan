import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { bookRouter } from "./book";
import { narrationPreparationRouter } from "./narration-preparation";
import { narrationRouter } from "./narration";
import { settingsRouter } from "./settings";
import { systemRouter } from "./system";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  settings: settingsRouter,
  book: bookRouter,
  narration: narrationRouter,
  narrationPreparation: narrationPreparationRouter,
  system: systemRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
