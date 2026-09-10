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

export const TTS_PROVIDERS = ["openai-compatible", "deepgram", "browser-local"] as const;
export type TtsProvider = (typeof TTS_PROVIDERS)[number];

export const ttsModelSchema = z.object({
  name: z.string().min(1),
  id: z.string().min(1),
  voices: z.array(z.string().min(1)).default([]),
});
export type TtsModelConfig = z.infer<typeof ttsModelSchema>;

export const ttsServiceSchema = z.object({
  id: z
    .string()
    .min(1)
    .default(() => crypto.randomUUID()),
  name: z.string().min(1),
  provider: z.enum(TTS_PROVIDERS),
  endpoint: z.string().min(1),
  apiKey: z.string().default(""),
  models: z.array(ttsModelSchema).default([]),
});
export type TtsServiceConfig = z.infer<typeof ttsServiceSchema>;

export const socks5ProxySchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().default("socks5h://127.0.0.1:10808"),
});
export type Socks5ProxyConfig = z.infer<typeof socks5ProxySchema>;

export const ttsModelRefSchema = z.object({
  service: z.string().default(""),
  model: z.string().default(""),
  voice: z.string().default(""),
});
export type TtsModelRef = z.infer<typeof ttsModelRefSchema>;

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

export const NARRATION_PREPARATION_QUALITIES = ["fast", "balanced", "high"] as const;
export type NarrationPreparationQuality = (typeof NARRATION_PREPARATION_QUALITIES)[number];

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

export const narrationPreparationSchema = z.object({
  enabled: z.boolean().default(false),
  model: modelRefSchema.default({ service: "", model: "" }),
  targetLanguage: z.string().max(100).default(""),
  targetChunkCount: z.number().int().min(1).max(20).default(3),
  previousContextCount: z.number().int().min(0).max(20).default(2),
  futureContextCount: z.number().int().min(0).max(20).default(3),
  minimumCoveragePercent: z.number().int().min(1).max(100).default(80),
  maxNextItems: z.number().int().min(1).max(100).default(20),
  quality: z.enum(NARRATION_PREPARATION_QUALITIES).default("balanced"),
});
export type NarrationPreparationConfig = z.infer<typeof narrationPreparationSchema>;

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
  ttsServices: z.array(ttsServiceSchema).default([]),
  socks5Proxy: socks5ProxySchema.default({
    enabled: false,
    url: "socks5h://127.0.0.1:10808",
  }),
  extractChapterMode: z.enum(EXTRACT_CHAPTER_MODES).default("auto"),
  narrateWithAI: z.boolean().default(false),
  narrateAheadCount: z.number().int().min(0).max(20).default(3),
  narrateStyle: z.enum(NARRATE_STYLES).default("neutral"),
  readerContentFontSize: z.number().int().min(14).max(28).default(19),
  narrationPreparation: narrationPreparationSchema.default({
    enabled: false,
    model: { service: "", model: "" },
    targetLanguage: "",
    targetChunkCount: 3,
    previousContextCount: 2,
    futureContextCount: 3,
    minimumCoveragePercent: 80,
    maxNextItems: 20,
    quality: "balanced",
  }),
  defaultTtsModel: ttsModelRefSchema.default({ service: "", model: "", voice: "" }),
  defaultModels: defaultModelsSchema.default({
    chat: { service: "", model: "" },
    extractChapters: { service: "", model: "" },
  }),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

export const BUILTIN_KOKORO_SERVICE: TtsServiceConfig = {
  id: "browser-kokoro",
  name: "Kokoro (on-device)",
  provider: "browser-local",
  endpoint: "browser://kokoro",
  apiKey: "",
  models: [
    {
      id: "onnx-community/Kokoro-82M-v1.0-ONNX#webgpu-fp32",
      name: "Kokoro 82M v1.0 (WebGPU fp32)",
      voices: [
        "af_heart",
        "af_alloy",
        "af_aoede",
        "af_bella",
        "af_jessica",
        "af_kore",
        "af_nicole",
        "af_nova",
        "af_river",
        "af_sarah",
        "af_sky",
        "am_adam",
        "am_echo",
        "am_eric",
        "am_fenrir",
        "am_liam",
        "am_michael",
        "am_onyx",
        "am_puck",
        "am_santa",
        "bf_alice",
        "bf_emma",
        "bf_isabella",
        "bf_lily",
        "bm_daniel",
        "bm_fable",
        "bm_george",
        "bm_lewis",
      ],
    },
  ],
};

export const BUILTIN_POCKET_TTS_SERVICE: TtsServiceConfig = {
  id: "browser-pocket-tts",
  name: "Pocket TTS (on-device)",
  provider: "browser-local",
  endpoint: "browser://pocket-tts",
  apiKey: "",
  models: [
    {
      id: "kyutai/pocket-tts",
      name: "Kyutai Pocket TTS (fp16, WebGPU)",
      voices: ["alba", "azelma", "cosette", "eponine", "fantine", "javert", "jean", "marius"],
    },
  ],
};

export const DEFAULT_CONFIG: AppConfig = {
  llmServices: [],
  ttsServices: [BUILTIN_KOKORO_SERVICE, BUILTIN_POCKET_TTS_SERVICE],
  socks5Proxy: {
    enabled: false,
    url: "socks5h://127.0.0.1:10808",
  },
  extractChapterMode: "auto",
  narrateWithAI: false,
  narrateAheadCount: 3,
  narrateStyle: "neutral",
  readerContentFontSize: 19,
  narrationPreparation: {
    enabled: false,
    model: { service: "", model: "" },
    targetLanguage: "",
    targetChunkCount: 3,
    previousContextCount: 2,
    futureContextCount: 3,
    minimumCoveragePercent: 80,
    maxNextItems: 20,
    quality: "balanced",
  },
  defaultTtsModel: {
    service: BUILTIN_KOKORO_SERVICE.id,
    model: BUILTIN_KOKORO_SERVICE.models[0]!.id,
    voice: "af_heart",
  },
  defaultModels: {
    chat: { service: "", model: "" },
    extractChapters: { service: "", model: "" },
  },
};
