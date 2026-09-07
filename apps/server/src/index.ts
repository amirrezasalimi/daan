import { createContext } from "@daan/api/context";
import { completeBrowserNarration, getNarrationAudioPath } from "@daan/api/narration/service";
import { appRouter } from "@daan/api/routers/index";
import { desktopOrigins, env } from "@daan/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { initializeQueues, narrationQueue, shutdownQueues } from "./queue";

await initializeQueues();

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: [env.CORS_ORIGIN, "http://localhost:3007", ...desktopOrigins],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.post("/narration/browser-audio/:id", async (c) => {
  const audio = new Uint8Array(await c.req.arrayBuffer());
  if (audio.byteLength === 0 || audio.byteLength > 20 * 1024 * 1024) {
    return c.json({ error: "Invalid local narration audio" }, 400);
  }
  await completeBrowserNarration(c.req.param("id"), audio);
  return c.json({ id: c.req.param("id") });
});

app.get("/narration/audio/:id", async (c) => {
  const path = await getNarrationAudioPath(c.req.param("id"));
  if (!path) return c.notFound();

  const file = Bun.file(path);
  if (!(await file.exists())) return c.notFound();
  return new Response(file, {
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Type": path.endsWith(".wav") ? "audio/wav" : "audio/mpeg",
    },
  });
});

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c, narrationQueue });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get("/", (c) => {
  return c.text("OK");
});

const port = Number(process.env.PORT) || 3006;

process.on("SIGINT", async () => {
  await shutdownQueues();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdownQueues();
  process.exit(0);
});

export default {
  port,
  fetch: app.fetch,
};
