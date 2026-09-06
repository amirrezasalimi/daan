import type { Context as HonoContext } from "hono";

import type { NarrationQueue } from "./narration/service";

export type CreateContextOptions = {
  context: HonoContext;
  narrationQueue: NarrationQueue;
};

export async function createContext(options: CreateContextOptions) {
  return {
    auth: null,
    session: null,
    narrationQueue: options.narrationQueue,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
