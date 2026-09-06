import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SERVER_URL: z.string().default("http://localhost:3006"),
  },
  runtimeEnv: {
    VITE_SERVER_URL: import.meta.env.VITE_SERVER_URL ?? "http://localhost:3006",
  },
  emptyStringAsUndefined: true,
});
