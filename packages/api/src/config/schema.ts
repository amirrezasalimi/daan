import { z } from "zod";

/**
 * A single model exposed by an LLM service.
 */
export const modelSchema = z.object({
  name: z.string().min(1),
  id: z.string().min(1),
  supportTools: z.boolean().default(false),
  supportVision: z.boolean().default(false),
});
export type ModelConfig = z.infer<typeof modelSchema>;

/**
 * An LLM provider (OpenAI-compatible endpoint) and its available models.
 */
export const llmServiceSchema = z.object({
  id: z
    .string()
    .min(1)
    .default(() => crypto.randomUUID()),
  name: z.string().min(1),
  endpoint: z.string().min(1),
  apiKey: z.string().default(""),
  models: z.array(modelSchema).default([]),
});
export type LlmServiceConfig = z.infer<typeof llmServiceSchema>;

/**
 * Narration/voice styles available for generated audio or reading.
 */
export const NARRATE_STYLES = [
  "neutral",
  "conversational",
  "dramatic",
  "calm",
  "cheerful",
] as const;
export type NarrateStyle = (typeof NARRATE_STYLES)[number];

/**
 * How chapters are detected when importing a book source.
 * - "auto": fast, local heuristic (table of contents / headings).
 * - "ai": use the configured extractChapters model.
 */
export const EXTRACT_CHAPTER_MODES = ["auto", "ai"] as const;
export type ExtractChapterMode = (typeof EXTRACT_CHAPTER_MODES)[number];

/**
 * A model reference: which service and model id to use for a given task.
 * `service` holds the LLM service id (not its display name).
 */
export const modelRefSchema = z.object({
  service: z.string().default(""),
  model: z.string().default(""),
});
export type ModelRef = z.infer<typeof modelRefSchema>;

/**
 * Default models used for specific tasks.
 */
export const defaultModelsSchema = z.object({
  chat: modelRefSchema.default({ service: "", model: "" }),
  extractChapters: modelRefSchema.default({ service: "", model: "" }),
});
export type DefaultModels = z.infer<typeof defaultModelsSchema>;

/**
 * Root application configuration persisted to `config.yaml`.
 */
export const appConfigSchema = z.object({
  llmServices: z.array(llmServiceSchema).default([]),
  extractChapterMode: z.enum(EXTRACT_CHAPTER_MODES).default("auto"),
  narrateWithAI: z.boolean().default(false),
  narrateStyle: z.enum(NARRATE_STYLES).default("neutral"),
  defaultModels: defaultModelsSchema.default({
    chat: { service: "", model: "" },
    extractChapters: { service: "", model: "" },
  }),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

export const DEFAULT_CONFIG: AppConfig = {
  llmServices: [],
  extractChapterMode: "auto",
  narrateWithAI: false,
  narrateStyle: "neutral",
  defaultModels: {
    chat: { service: "", model: "" },
    extractChapters: { service: "", model: "" },
  },
};
