import { execFile } from "node:child_process";
import { promisify } from "node:util";
import OpenAI from "openai";
import { z } from "zod";

import { appConfigSchema, readConfig, socks5ProxySchema, writeConfig } from "../config";
import { publicProcedure } from "../index";

const DEEPGRAM_VOICES_URL = "https://developers.deepgram.com/docs/tts-models";
const execFileAsync = promisify(execFile);

async function listDeepgramVoices(proxy: { enabled: boolean; url: string }): Promise<string[]> {
  const args = ["curl", "-fsSL", "--max-time", "20"];

  if (proxy.enabled) {
    if (!/^socks5h?:\/\/[^\s]+$/i.test(proxy.url)) {
      throw new Error("Enter a valid SOCKS5 proxy URL");
    }
    args.push("--proxy", proxy.url);
  }

  args.push(DEEPGRAM_VOICES_URL);

  let html: string;
  try {
    const result = await execFileAsync(args[0], args.slice(1), {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    html = result.stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Deepgram voices";
    throw new Error(message);
  }

  const voices: string[] = [...new Set(html.match(/aura-[a-zA-Z0-9._-]+/g) ?? [])].sort();
  if (voices.length === 0) {
    throw new Error("No supported Deepgram voices were found");
  }

  return voices;
}

export const settingsRouter = {
  get: publicProcedure.handler(() => {
    return readConfig();
  }),

  update: publicProcedure.input(appConfigSchema).handler(({ input }) => {
    return writeConfig(input);
  }),

  listDeepgramVoices: publicProcedure
    .input(socks5ProxySchema)
    .handler(async ({ input }) => ({ voices: await listDeepgramVoices(input) })),

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
