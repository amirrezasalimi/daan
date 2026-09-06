import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { bookRouter } from "./book";
import { settingsRouter } from "./settings";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  settings: settingsRouter,
  book: bookRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
