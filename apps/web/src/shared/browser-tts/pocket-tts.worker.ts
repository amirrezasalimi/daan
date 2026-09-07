/// <reference lib="webworker" />

import { defaultDevice, init, numpy as np, tree } from "@jax-js/jax";
import { cachedFetch, safetensors, tokenizers } from "@jax-js/loaders";
import type { AudioPlayer, PocketTTS } from "@daan/pocket-tts";
import { fromSafetensors, playTTS, samplesToWav } from "@daan/pocket-tts";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

const WEIGHTS_URL =
  "https://huggingface.co/ekzhang/jax-js-models/resolve/main/kyutai-pocket-tts_b6369a24-fp16.safetensors";
const TOKENIZER_URL =
  "https://huggingface.co/kyutai/pocket-tts-without-voice-cloning/resolve/fbf8280/tokenizer.model";
const VOICE_URL_PREFIX =
  "https://huggingface.co/kyutai/pocket-tts-without-voice-cloning/resolve/fbf8280/embeddings";

interface LoadMessage {
  id: number;
  type: "load";
}

interface GenerateMessage {
  id: number;
  type: "generate";
  voice: string;
  text: string;
}

type RequestMessage = LoadMessage | GenerateMessage;

let model: PocketTTS | null = null;
let tokenizer: tokenizers.SentencePiece | null = null;
let deviceReady: Promise<void> | null = null;
interface VoiceEmbedding {
  data: Float32Array;
  shape: number[];
}

const voiceCache = new Map<string, VoiceEmbedding>();

function prepareTextPrompt(rawText: string): [string, number] {
  let text = rawText.trim();
  if (text === "") throw new Error("Text cannot be empty");
  text = text.replace(/\s+/g, " ");
  const numberOfWords = text.split(" ").length;
  const framesAfterEosGuess = numberOfWords <= 4 ? 5 : 3;
  text = text.replace(/^(\p{Ll})/u, (c) => c.toLocaleUpperCase());
  if (/[\p{L}\p{N}]$/u.test(text)) text = `${text}.`;
  if (text.split(" ").length < 5) text = " ".repeat(8) + text;
  return [text, framesAfterEosGuess];
}

async function ensureDevice(): Promise<void> {
  if (!deviceReady) {
    deviceReady = (async () => {
      if (!("gpu" in workerScope.navigator)) {
        throw new Error(
          "WebGPU is required for on-device speech but is not available in this browser.",
        );
      }
      const devices = await init("webgpu");
      if (!devices.includes("webgpu")) {
        throw new Error("WebGPU device initialization failed.");
      }
      defaultDevice("webgpu");
    })();
  }
  await deviceReady;
}

async function ensureModel(requestId: number): Promise<PocketTTS> {
  if (model) return model;
  await ensureDevice();
  const data = await cachedFetch(WEIGHTS_URL, undefined, (progress) => {
    const total = progress.totalBytes ?? 300 * 1024 * 1024;
    const percent = total > 0 ? Math.min(100, (progress.loadedBytes / total) * 100) : 0;
    workerScope.postMessage({
      id: requestId,
      type: "progress",
      progress: percent,
      status: "Downloading Pocket TTS weights",
    });
  });
  workerScope.postMessage({
    id: requestId,
    type: "progress",
    progress: 100,
    status: "Preparing model",
  });
  const weights = safetensors.parse(data);
  model = fromSafetensors(weights, np.float16);
  return model;
}

async function ensureTokenizer(): Promise<tokenizers.SentencePiece> {
  if (!tokenizer) tokenizer = await tokenizers.loadSentencePiece(TOKENIZER_URL);
  return tokenizer;
}

async function loadVoiceEmbedding(voice: string): Promise<VoiceEmbedding> {
  const cached = voiceCache.get(voice);
  if (cached) return cached;
  const data = await cachedFetch(`${VOICE_URL_PREFIX}/${voice}.safetensors`);
  const parsed = safetensors.parse(data);
  const audioPrompt = parsed.tensors.audio_prompt;
  if (!audioPrompt) throw new Error(`Unknown Pocket TTS voice "${voice}"`);
  const embedding = {
    data: audioPrompt.data as Float32Array<ArrayBuffer>,
    shape: [...audioPrompt.shape],
  };
  voiceCache.set(voice, embedding);
  return embedding;
}

function createCollectorPlayer(): AudioPlayer & { chunks: Float32Array[] } {
  const chunks: Float32Array[] = [];
  return {
    chunks,
    async playChunk(samples: Float32Array) {
      chunks.push(samples.slice());
    },
    async close() {},
    toWav() {
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      return samplesToWav(combined);
    },
    get context(): AudioContext {
      throw new Error("Pocket TTS worker player has no audio context");
    },
  };
}

workerScope.addEventListener("message", async (event: MessageEvent<RequestMessage>) => {
  const request = event.data;
  try {
    const ttsModel = await ensureModel(request.id);
    if (request.type === "load") {
      await ensureTokenizer();
      workerScope.postMessage({ id: request.id, type: "loaded" });
      return;
    }

    const sentencePiece = await ensureTokenizer();
    const [text, framesAfterEos] = prepareTextPrompt(request.text);
    const tokens = sentencePiece.encode(text);
    const voiceEmbedding = await loadVoiceEmbedding(request.voice);

    const voiceEmbed = np
      .array(new Float32Array(voiceEmbedding.data), {
        shape: voiceEmbedding.shape,
        dtype: np.float32,
      })
      .slice(0)
      .astype(np.float16);
    const tokensAr = np.array(tokens, { dtype: np.uint32 });
    let embeds = ttsModel.flowLM.conditionerEmbed.ref.slice(tokensAr);
    embeds = np.concatenate([voiceEmbed, embeds]);

    const player = createCollectorPlayer();
    await playTTS(player, tree.ref(ttsModel), embeds, {
      framesAfterEos,
      seed: null,
      temperature: 0.7,
      lsdDecodeSteps: 1,
      onProgress: (progress) => {
        workerScope.postMessage({
          id: request.id,
          type: "progress",
          progress: 100,
          status: `Generating audio (${progress.realTimeFactor.toFixed(1)}x real-time)`,
        });
      },
    });

    const blob = player.toWav();
    const buffer = await blob.arrayBuffer();
    workerScope.postMessage({ id: request.id, type: "result", audio: buffer }, [buffer]);
  } catch (error) {
    workerScope.postMessage({
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : "Local speech generation failed",
    });
  }
});
