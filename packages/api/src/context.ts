import type { Context as HonoContext } from "hono";

import type { NarrationPreparationQueue } from "./narration/preparation-service";
import type { NarrationQueue } from "./narration/service";

export type CreateContextOptions = {
  context: HonoContext;
  narrationQueue: NarrationQueue;
  narrationPreparationQueue: NarrationPreparationQueue;
};

export async function createContext(options: CreateContextOptions) {
  return {
    auth: null,
    session: null,
    narrationQueue: options.narrationQueue,
    narrationPreparationQueue: options.narrationPreparationQueue,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
